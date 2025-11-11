"""Database operations for ARGO data upload."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pyarrow as pa
import pyarrow.ipc as ipc

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
        data = {
            "float_id": int(metadata.float_id),
            "wmo_number": metadata.float_id,
            "float_type": metadata.float_model,
            "deployment_date": metadata.launch_date,
            "deployment_lat": metadata.launch_lat,
            "deployment_lon": metadata.launch_lon,
            "status": metadata.deployment_status or "ACTIVE",
            "created_at": metadata.metadata_updated_at,
            "updated_at": datetime.now(),
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
        data = {
            "float_id": int(float_id),
            "current_lat": latitude,
            "current_lon": longitude,
            "cycle_number": cycle_number,
            "last_update": profile_time,
            "last_temp": temperature,
            "last_salinity": salinity,
            "updated_at": datetime.now(),
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        logger.debug("Uploading float position", float_id=float_id, cycle=cycle_number)
        return self.db.upsert_dict(
            table_name="argo_float_positions",
            data=data,
            conflict_column="float_id",
        )

    def upload_position_timeseries(
        self,
        float_id: str,
        trajectory_data: list[dict[str, Any]] | dict[str, Any],
    ) -> int:
        """Upload trajectory timeseries to database.

        Args:
            float_id: Float ID
            trajectory_data: List of position records or single dict

        Returns:
            Number of records inserted
        """
        # Handle single dict or list
        if isinstance(trajectory_data, dict):
            trajectory_data = [trajectory_data]

        if not trajectory_data:
            return 0

        records = []
        for point in trajectory_data:
            record = {
                "float_id": int(float_id),
                "lat": point.get("latitude"),
                "lon": point.get("longitude"),
                "time": point.get("time"),
                "cycle": point.get("cycle"),
            }
            # Remove None values
            record = {k: v for k, v in record.items() if v is not None}
            if "lat" in record and "lon" in record:
                records.append(record)

        if not records:
            return 0

        logger.info(
            "Uploading trajectory timeseries", float_id=float_id, count=len(records)
        )
        return self.db.bulk_insert_dict(
            table_name="argo_positions_timeseries",
            data=records,
        )

    def upload_profile(self, profile: ProfileData) -> Optional[int]:
        """Upload a single profile to database.

        Args:
            profile: Profile data

        Returns:
            Profile ID if successful, None otherwise
        """
        # Insert profile metadata
        profile_data = {
            "float_id": int(profile.float_id),
            "cycle": profile.cycle_number,
            "profile_time": profile.profile_time,
            "surface_lat": profile.latitude,
            "surface_lon": profile.longitude,
            "max_depth": int(profile.max_depth) if profile.max_depth else None,
            "quality_flag": profile.quality_status,
            "created_at": datetime.now(),
        }

        # Add measurements as JSONB (store as array for the JSONB column)
        if profile.measurements:
            measurements_array = [
                m.model_dump(exclude_none=True) for m in profile.measurements
            ]
            profile_data["measurements"] = json.dumps(measurements_array)
        else:
            profile_data["measurements"] = json.dumps([])

        try:
            with self.db.get_cursor() as cursor:
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
                        measurements = EXCLUDED.measurements,
                        created_at = EXCLUDED.created_at
                    RETURNING id
                    """,
                    profile_data,
                )
                result = cursor.fetchone()
                if result:
                    profile_id = result[0]
                    logger.debug(
                        "Profile uploaded",
                        float_id=profile.float_id,
                        cycle=profile.cycle_number,
                        profile_id=profile_id,
                    )
                    return profile_id
                return None
        except Exception as e:
            logger.exception(
                "Profile upload failed",
                float_id=profile.float_id,
                cycle=profile.cycle_number,
                error=str(e),
            )
            return None

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
                        profile_data = {
                            "float_id": int(profile.float_id),
                            "cycle": profile.cycle_number,
                            "profile_time": profile.profile_time,
                            "surface_lat": profile.latitude,
                            "surface_lon": profile.longitude,
                            "max_depth": profile.max_depth,
                            "quality_flag": profile.quality_status,
                            "created_at": datetime.now(),
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
            return 0

    def upload_profiles_arrow(
        self,
        profiles: list[ProfileData],
        arrow_file: Optional[Path] = None,
    ) -> int:
        """Upload profiles using Apache Arrow for efficiency.

        Args:
            profiles: List of profile data
            arrow_file: Optional Arrow file path (reads if provided)

        Returns:
            Number of profiles uploaded
        """
        if arrow_file and arrow_file.exists():
            # Read from Arrow file
            with open(arrow_file, "rb") as f:
                reader = ipc.open_stream(f)
                table = reader.read_all()
                logger.info("Arrow file loaded", path=str(arrow_file), rows=len(table))
        else:
            # Convert profiles to Arrow table
            table = self._profiles_to_arrow(profiles)

        # For now, convert to dict and use batch insert
        # (Direct Arrow COPY would require schema alignment)
        profile_dicts = table.to_pydict()
        records = [
            {
                "float_id": int(profile_dicts["float_id"][i]),
                "cycle": int(profile_dicts["cycle_number"][i]),
                "profile_time": profile_dicts["profile_time"][i],
                "surface_lat": profile_dicts["latitude"][i],
                "surface_lon": profile_dicts["longitude"][i],
                "max_depth": profile_dicts["max_depth"][i],
                "quality_flag": profile_dicts["quality_status"][i],
                "created_at": datetime.now(),
            }
            for i in range(len(table))
        ]

        return self.db.bulk_insert_dict(
            table_name="argo_profiles",
            data=records,
        )

    def _profiles_to_arrow(self, profiles: list[ProfileData]) -> pa.Table:
        """Convert profiles to Apache Arrow table.

        Args:
            profiles: List of profile data

        Returns:
            Arrow table
        """
        data = {
            "float_id": [p.float_id for p in profiles],
            "cycle_number": [p.cycle_number for p in profiles],
            "profile_time": [p.profile_time for p in profiles],
            "latitude": [p.latitude for p in profiles],
            "longitude": [p.longitude for p in profiles],
            "max_depth": [p.max_depth for p in profiles],
            "quality_status": [p.quality_status for p in profiles],
        }

        return pa.Table.from_pydict(data)

    def update_float_stats(self, float_id: str) -> bool:
        """Recalculate and update float statistics.

        Args:
            float_id: Float ID

        Returns:
            True if successful
        """
        query = """
            INSERT INTO argo_float_stats (
                float_id, avg_temp, temp_min, temp_max,
                depth_range_min, depth_range_max, profile_count,
                last_updated, updated_at
            )
            SELECT
                float_id,
                AVG((elem->>'temperature')::float) as avg_temp,
                MIN((elem->>'temperature')::float) as temp_min,
                MAX((elem->>'temperature')::float) as temp_max,
                MIN(max_depth) as depth_range_min,
                MAX(max_depth) as depth_range_max,
                COUNT(DISTINCT cycle) as profile_count,
                NOW() as last_updated,
                NOW() as updated_at
            FROM argo_profiles,
                 jsonb_array_elements(measurements) as elem
            WHERE float_id = %(float_id)s
              AND elem->>'temperature' IS NOT NULL
            GROUP BY float_id
            ON CONFLICT (float_id) DO UPDATE SET
                avg_temp = EXCLUDED.avg_temp,
                temp_min = EXCLUDED.temp_min,
                temp_max = EXCLUDED.temp_max,
                depth_range_min = EXCLUDED.depth_range_min,
                depth_range_max = EXCLUDED.depth_range_max,
                profile_count = EXCLUDED.profile_count,
                last_updated = EXCLUDED.last_updated,
                updated_at = EXCLUDED.updated_at
        """

        try:
            self.db.execute_query(query, params={"float_id": int(float_id)})
            logger.info("Float stats updated", float_id=float_id)
            return True
        except Exception as e:
            logger.exception("Stats update failed", float_id=float_id, error=str(e))
            return False

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
        data = {
            "float_id": int(float_id),
            "operation": operation,
            "status": status,
            "message": message,
            "error_details": json.dumps(error_details) if error_details else None,
            "processing_time_ms": processing_time_ms,
            "created_at": datetime.now(),
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

    def upload_profile_measurements(
        self,
        profile_id: int,
        measurements: list[dict[str, Any]],
    ) -> int:
        """Upload normalized profile measurements.

        Args:
            profile_id: Profile ID from argo_profiles
            measurements: List of measurement dictionaries

        Returns:
            Number of measurements inserted
        """
        if not measurements:
            return 0

        records = []
        for m in measurements:
            record = {
                "profile_id": profile_id,
                "depth": m.get("depth"),
                "temperature": m.get("temperature"),
                "salinity": m.get("salinity"),
                "oxygen": m.get("oxygen"),
                "chlorophyll": m.get("chlorophyll"),
                "created_at": datetime.now(),
            }

            # Add QC flags if available
            if "qc_flags" in m and m["qc_flags"]:
                qc = m["qc_flags"]
                if isinstance(qc, dict):
                    record["qc_temp"] = qc.get("temperature")
                    record["qc_salinity"] = qc.get("salinity")
                    record["qc_oxygen"] = qc.get("oxygen")
                    record["qc_chlorophyll"] = qc.get("chlorophyll")

            # Remove None values except QC flags (they can be null)
            record = {
                k: v for k, v in record.items() if v is not None or k.startswith("qc_")
            }

            if "depth" in record:
                records.append(record)

        if not records:
            return 0

        logger.debug(
            "Uploading profile measurements",
            profile_id=profile_id,
            count=len(records),
        )
        return self.db.bulk_insert_dict(
            table_name="argo_profile_measurements",
            data=records,
        )

    def upload_float_sensors(
        self,
        float_id: str,
        sensor_data: list[dict[str, Any]],
    ) -> int:
        """Upload float sensor calibration data.

        Args:
            float_id: Float ID
            sensor_data: List of sensor configuration dictionaries

        Returns:
            Number of sensor records inserted
        """
        if not sensor_data:
            return 0

        records = []
        for sensor in sensor_data:
            record = {
                "float_id": int(float_id),
                "sensor_type": sensor.get("sensor_type"),
                "sensor_maker": sensor.get("sensor_maker"),
                "sensor_model": sensor.get("sensor_model"),
                "sensor_serial_no": sensor.get("sensor_serial_no"),
                "parameter_name": sensor.get("parameter_name"),
                "units": sensor.get("units"),
                "accuracy": sensor.get("accuracy"),
                "resolution": sensor.get("resolution"),
                "calibration_date": sensor.get("calibration_date"),
                "calibration_comment": sensor.get("calibration_comment"),
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }

            # Handle calibration data as JSONB
            if "calibration_data" in sensor and sensor["calibration_data"]:
                record["calibration_data"] = json.dumps(sensor["calibration_data"])

            # Remove None values
            record = {k: v for k, v in record.items() if v is not None}

            if "sensor_type" in record:
                records.append(record)

        if not records:
            return 0

        logger.info(
            "Uploading float sensors",
            float_id=float_id,
            count=len(records),
        )
        return self.db.bulk_insert_dict(
            table_name="argo_float_sensors",
            data=records,
        )

    def log_file_sync(
        self,
        float_id: str,
        file_name: str,
        local_path: str,
        file_size: Optional[int] = None,
        remote_modified_time: Optional[datetime] = None,
        sync_status: str = "SYNCED",
    ) -> bool:
        """Log file sync to manifest.

        Args:
            float_id: Float ID
            file_name: Name of the file
            local_path: Local file path
            file_size: File size in bytes
            remote_modified_time: Remote modification time
            sync_status: Sync status (SYNCED, PENDING, FAILED)

        Returns:
            True if successful
        """
        data = {
            "float_id": int(float_id),
            "file_name": file_name,
            "local_path": local_path,
            "file_size": file_size,
            "remote_modified_time": remote_modified_time,
            "local_modified_time": datetime.now(),
            "sync_status": sync_status,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        try:
            return (
                self.db.bulk_insert_dict(
                    table_name="sync_manifest",
                    data=[data],
                )
                > 0
            )
        except Exception as e:
            logger.error("Failed to log file sync", error=str(e))
            return False
