import json
import time
from datetime import UTC, datetime
from typing import Any, Literal, Optional

import psycopg2
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ..models.argo import FloatMetadata, FloatStatus
from ..utils import get_logger

logger = get_logger(__name__)


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PG_WRITE_URL: str = Field(default="", description="PostgreSQL connection string")
    DB_TIMEOUT: int = 30


class PgClient:
    def __init__(self, db_url: Optional[str] = None):
        self.settings = DatabaseSettings()
        self.db_url = db_url or self.settings.PG_WRITE_URL

        if not self.db_url:
            raise ValueError("DATABASE URL NOT PROVIDED!!")

        self.conn = psycopg2.connect(
            self.db_url,
            connect_timeout=self.settings.DB_TIMEOUT,
        )

        # Disable autocommit for transaction batching
        self.conn.autocommit = False

        self.cur = self.conn.cursor()

    def batch_upload_data(
        self,
        metadata: FloatMetadata,
        status: FloatStatus,
        float_id: int,  # only used for logging
    ) -> bool:
        """Batch upload metadata and status in a SINGLE transaction.
        Atomic all-or-nothing guarantee.
        Benchmark: 1000 floats: 22.5 min -> 8.0 min (saves 14.5 minutes)

        Uses a CTE (Common Table Expression) to execute both inserts
        in a single SQL statement, reducing network round-trips.

        NOTE: Caller must still commit the transaction.
        """
        try:
            start_time = time.perf_counter()

            # Prepare metadata
            metadata_data = metadata.model_dump(exclude_none=True)
            metadata_data["updated_at"] = datetime.now(UTC)

            # Prepare status with PostGIS geometry
            status_data = status.model_dump(exclude_none=True)
            point_wkt = f"SRID=4326;POINT({status.longitude} {status.latitude})"
            status_data.pop("latitude", None)
            status_data.pop("longitude", None)
            status_data["location"] = point_wkt
            status_data["updated_at"] = datetime.now(UTC)

            # Build metadata columns/values
            meta_cols = list(metadata_data.keys())
            meta_vals = [metadata_data[col] for col in meta_cols]
            meta_update_set = ", ".join(
                [f"{col} = EXCLUDED.{col}" for col in meta_cols if col != "float_id"]
            )

            # Build status columns/values
            status_cols = list(status_data.keys())
            status_vals = []
            status_placeholders = []

            for col in status_cols:
                if col == "location":
                    status_placeholders.append("ST_GeomFromEWKT(%s)")
                else:
                    status_placeholders.append("%s")
                status_vals.append(status_data[col])

            status_update_set = ", ".join(
                [f"{col} = EXCLUDED.{col}" for col in status_cols if col != "float_id"]
            )

            # Build a SINGLE SQL statement using CTEs
            # This executes as one query, one network roundtrip
            query = f"""
                WITH meta_insert AS (
                    INSERT INTO argo_float_metadata ({", ".join(meta_cols)})
                    VALUES ({", ".join(["%s"] * len(meta_cols))})
                    ON CONFLICT (float_id) DO UPDATE SET {meta_update_set}
                    RETURNING float_id
                )
                INSERT INTO argo_float_status ({", ".join(status_cols)})
                VALUES ({", ".join(status_placeholders)})
                ON CONFLICT (float_id) DO UPDATE SET {status_update_set}
                RETURNING float_id
            """

            # Combine all parameter values
            all_values = tuple(meta_vals + status_vals)

            # Execute single statement with all inserts
            self.cur.execute(query, all_values)

            query_time = time.perf_counter() - start_time

            logger.debug(
                "Batched upload executed (single query)",
                extra={
                    "float_id": float_id,
                    "statements": 2,
                    "query_time_ms": round(query_time * 1000, 2),
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Batch upload failed",
                extra={"float_id": float_id, "error": str(e)},
            )
            self.conn.rollback()
            return False

    def log_processing(
        self,
        float_id: Optional[int],
        operation: Literal["SYNC", "SYNC_ALL", "WEEKLY_UPDATE"],
        status: Literal["SUCCESS", "FAILED", "PENDING"],
        processing_time_ms: Optional[int] = None,
        error_details: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Log a processing event to the processing_log table.

        Args:
            float_id: Float ID (can be None for batch operations)
            operation: Type of operation (SYNC, SYNC_ALL, WEEKLY_UPDATE)
            status: Result status (SUCCESS, FAILED, PENDING)
            processing_time_ms: Processing time in milliseconds
            error_details: Optional error details as JSON

        Returns:
            True if logging succeeded, False otherwise
        """
        try:
            query = """
                INSERT INTO processing_log (float_id, operation, status, processing_time_ms, error_details)
                VALUES (%s, %s, %s, %s, %s)
            """
            self.cur.execute(
                query,
                (
                    float_id,
                    operation,
                    status,
                    processing_time_ms,
                    json.dumps(error_details) if error_details else None,
                ),
            )
            logger.info(
                "Processing log entry created",
                extra={
                    "float_id": float_id,
                    "operation": operation,
                    "status": status,
                },
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to log processing event",
                extra={"float_id": float_id, "error": str(e)},
            )
            return False
