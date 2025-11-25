import json
from datetime import datetime, timezone
from typing import Optional

from ..models.argo import FloatMetadata, ProfileData
from ..utils import get_logger
from .connector import NeonDBConnector

logger = get_logger(__name__)


class ArgoDataUploader:
    """Upload ARGO data to Neon database with Arrow optimization."""

    def __init__(self, db_connector: Optional[NeonDBConnector] = None):
        """Initialize uploader.

        Args:
            db_connector: Database connector (creates new if not provided)
        """
        self.db = db_connector or NeonDBConnector()

    def upload_float_metadata(self, metadata: FloatMetadata) -> bool:
        """Upload float metadata to database.

        Args:
            metadata: Float metadata object

        Returns:
            True if successful
        """
        try:
            float_id_int = int(metadata.float_id)
        except (ValueError, TypeError) as e:
            logger.error(
                "Invalid float_id format for metadata upload",
                float_id=metadata.float_id,
                error=str(e),
            )
            return False

        data = {
            "float_id": float_id_int,
            "wmo_number": metadata.float_id,
            "float_type": metadata.float_model,
            "deployment_date": metadata.launch_date,
            "deployment_lat": metadata.launch_lat,
            "deployment_lon": metadata.launch_lon,
            "status": metadata.deployment_status or "ACTIVE",
            "created_at": metadata.metadata_updated_at,
            "updated_at": datetime.now(timezone.utc),
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        logger.info("Uploading float metadata", float_id=metadata.float_id)
        return self.db.upsert_dict(
            table_name="argo_float_metadata",
            data=data,
            conflict_column="float_id",
        )

    def upload_float_position(
        self,
        float_id: str,
        latitude: float,
        longitude: float,
        cycle_number: int,
        profile_time: datetime,
        temperature: Optional[float] = None,
        salinity: Optional[float] = None,
    ) -> bool:
        """Upload current float position.

        Args:
            float_id: Float ID
            latitude: Current latitude
            longitude: Current longitude
            cycle_number: Current cycle number
            profile_time: Time of measurement
            temperature: Surface temperature
            salinity: Surface salinity

        Returns:
            True if successful
        """
        try:
            float_id_int = int(float_id)
        except (ValueError, TypeError) as e:
            logger.error(
                "Invalid float_id format for position upload",
                float_id=float_id,
                error=str(e),
            )
            return False

        data = {
            "float_id": float_id_int,
            "current_lat": latitude,
            "current_lon": longitude,
            "cycle_number": cycle_number,
            "last_update": profile_time,
            "last_temp": temperature,
            "last_salinity": salinity,
            "updated_at": datetime.now(timezone.utc),
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        logger.debug("Uploading float position", float_id=float_id, cycle=cycle_number)
        return self.db.upsert_dict(
            table_name="argo_float_positions",
            data=data,
            conflict_column="float_id",
        )

    def upload_profiles_batch(self, profiles: list[ProfileData]) -> int:
        """Upload multiple profiles efficiently using a single transaction.

        Args:
            profiles: List of profile data

        Returns:
            Number of profiles uploaded
        """
        if not profiles:
            return 0

        success_count = 0

        # Use a single transaction for all profiles
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cursor:
                    for profile in profiles:
                        # Prepare profile data
                        try:
                            float_id_int = int(profile.float_id)
                        except (ValueError, TypeError) as e:
                            logger.warning(
                                "Invalid float_id in profile, skipping",
                                float_id=profile.float_id,
                                cycle=profile.cycle_number,
                                error=str(e),
                            )
                            continue

                        profile_data = {
                            "float_id": float_id_int,
                            "cycle": profile.cycle_number,
                            "profile_time": profile.profile_time,
                            "surface_lat": profile.latitude,
                            "surface_lon": profile.longitude,
                            "max_depth": profile.max_depth,
                            "quality_flag": profile.quality_status,
                            "created_at": datetime.now(timezone.utc),
                        }

                        # Add measurements as JSONB
                        if profile.measurements:
                            profile_data["measurements"] = json.dumps(
                                [
                                    m.model_dump(exclude_none=True)
                                    for m in profile.measurements
                                ]
                            )

                        try:
                            cursor.execute(
                                """
                                INSERT INTO argo_profiles
                                (float_id, cycle, profile_time, surface_lat, surface_lon,
                                 max_depth, quality_flag, measurements, created_at)
                                VALUES (%(float_id)s, %(cycle)s, %(profile_time)s, %(surface_lat)s,
                                        %(surface_lon)s, %(max_depth)s, %(quality_flag)s,
                                        %(measurements)s::jsonb, %(created_at)s)
                                ON CONFLICT (float_id, cycle) DO UPDATE SET
                                    profile_time = EXCLUDED.profile_time,
                                    surface_lat = EXCLUDED.surface_lat,
                                    surface_lon = EXCLUDED.surface_lon,
                                    max_depth = EXCLUDED.max_depth,
                                    quality_flag = EXCLUDED.quality_flag,
                                    measurements = EXCLUDED.measurements
                                """,
                                profile_data,
                            )
                            success_count += 1
                        except Exception as e:
                            logger.warning(
                                "Failed to upload profile",
                                float_id=profile.float_id,
                                cycle=profile.cycle_number,
                                error=str(e),
                            )
                            continue

                    # Commit happens automatically when exiting context
                    logger.info(
                        "Batch profile upload completed",
                        total=len(profiles),
                        success=success_count,
                    )
                    return success_count

        except Exception as e:
            logger.exception("Batch profile upload failed", error=str(e))
            # Re-raise to let caller distinguish connection failures vs processing failures
            raise

    def log_processing(
        self,
        float_id: str,
        operation: str,
        status: str,
        message: Optional[str] = None,
        error_details: Optional[dict] = None,
        processing_time_ms: Optional[int] = None,
    ) -> bool:
        """Log processing operation.

        Args:
            float_id: Float ID
            operation: Operation name
            status: Status (success, error, etc)
            message: Optional message
            error_details: Optional error details
            processing_time_ms: Processing time in milliseconds

        Returns:
            True if successful
        """
        try:
            float_id_int = int(float_id)
        except (ValueError, TypeError) as e:
            logger.error(
                "Invalid float_id format for logging", float_id=float_id, error=str(e)
            )
            return False

        data = {
            "float_id": float_id_int,
            "operation": operation,
            "status": status,
            "message": message,
            "error_details": json.dumps(error_details) if error_details else None,
            "processing_time_ms": processing_time_ms,
            "created_at": datetime.now(timezone.utc),
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        try:
            return (
                self.db.bulk_insert_dict(
                    table_name="processing_log",
                    data=[data],
                )
                > 0
            )
        except Exception as e:
            logger.error("Failed to log processing", error=str(e))
            return False
