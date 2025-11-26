"""ARGO float processing operations.

This module orchestrates downloading, parsing, and uploading ARGO float data.

Two entry points exist for processing floats:
1. SINGLE FLOAT MODE (main.py -> process_single_float):
2. BATCH MODE (main.py -> process_batch_floats):

Both modes use the same optimized upload path:
- upload_to_database() ->  db.upload_float_profiles() -> execute_values with pre-serialized JSONB
- Aggregate parser pre-serializes measurements to JSON string once
- execute_values sends all rows in a single round-trip
- ON CONFLICT handles upserts without separate SELECT queries
"""

import time
from pathlib import Path
from typing import Optional

from .config import settings
from .db import ArgoDataUploader
from .models.argo import FloatMetadata
from .utils import get_logger
from .workers.argo_sync import ArgoSyncWorker
from .workers.netcdf_processor.netcdf_parser import NetCDFParserWorker

logger = get_logger(__name__)


async def download_float_data(
    float_id: str,
    skip_download: bool = False,
) -> dict:
    """Download aggregate NetCDF files for a float via HTTPS.

    Downloads from IFREMER ARGO repository:
    - {float_id}_prof.nc  (all profiles)
    - {float_id}_meta.nc  (metadata)
    - {float_id}_Rtraj.nc (trajectory)

    Args:
        float_id: Float ID to download
        skip_download: Use cached files instead

    Returns:
        dict with success status and sync_result
    """
    sync_result = {}
    if not skip_download:
        logger.info("Starting download", float_id=float_id)
        sync_worker = ArgoSyncWorker()
        sync_result = await sync_worker.sync(float_ids=[float_id])

        if sync_result.get("errors", 0) > 0:
            error_msg = f"Download failed for float {float_id}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "sync_result": sync_result,
            }

        logger.info(
            "Download completed",
            float_id=float_id,
            files=sync_result.get("files_downloaded", 0),
        )
    else:
        logger.info("Skipping download (using cached files)", float_id=float_id)

    return {"success": True, "sync_result": sync_result}


def process_netcdf_files(float_id: str) -> dict:
    """Parse NetCDF aggregate files and extract profile data.

    Parses:
    - {float_id}_prof.nc  -> profiles with measurements (pre-serialized JSONB)
    - {float_id}_meta.nc  -> float metadata (deployment info)
    - {float_id}_Rtraj.nc -> trajectory positions

    Args:
        float_id: Float ID to process

    Returns:
        dict with profiles (list of dicts), metadata, trajectory
    """
    logger.info("Starting NetCDF processing", float_id=float_id)
    parser_worker = NetCDFParserWorker()
    process_result = parser_worker.process_directory(float_id)

    if not process_result.get("profiles"):
        error_msg = f"No profiles found for float {float_id}"
        logger.warning(error_msg)
        return {
            "success": False,
            "error": error_msg,
            "process_result": process_result,
        }

    # Aggregate parser returns dicts with pre-serialized measurements_json
    profiles = process_result["profiles"]
    metadata = process_result.get("metadata")
    trajectory_dict = process_result.get("trajectory")

    # Extract positions list from trajectory dict
    trajectory = []
    if trajectory_dict and isinstance(trajectory_dict, dict):
        trajectory = trajectory_dict.get("positions", [])

    logger.info(
        "NetCDF processing completed",
        float_id=float_id,
        profiles=len(profiles),
        trajectory_points=len(trajectory),
    )

    return {
        "success": True,
        "profiles": profiles,
        "metadata": metadata,
        "trajectory": trajectory,
        "process_result": process_result,
    }


def upload_to_database(
    float_id: str,
    profiles: list[dict],
    metadata: Optional[dict] = None,
) -> dict:
    """Upload processed data to Neon PostgreSQL.

    TABLES UPDATED:
    1. argo_float_metadata  - Float deployment info (upsert)
    2. argo_profiles        - All profiles with JSONB measurements (upsert)
    3. argo_float_positions - Current position from latest profile (upsert)

    Args:
        float_id: Float ID
        profiles: List of profile dicts with measurements_json field
        metadata: Float metadata dict

    Returns:
        dict with profiles_uploaded count
    """
    logger.info("Starting database upload", float_id=float_id)
    db_uploader = ArgoDataUploader()

    # Start a single transaction for all uploads
    db_uploader.db.start_transaction()
    try:
        # [TABLE: argo_float_metadata] - Static float info
        if metadata:
            float_metadata = FloatMetadata(
                float_id=float_id,
                float_model=metadata.get("float_model"),
                launch_date=metadata.get("launch_date"),
                launch_lat=metadata.get("launch_lat"),
                launch_lon=metadata.get("launch_lon"),
                deployment_status=metadata.get("deployment_status", "ACTIVE"),
            )
            db_uploader.upload_float_metadata(float_metadata)
            logger.debug("Metadata uploaded", float_id=float_id)

        # [TABLE: argo_profiles] - All profiles with JSONB measurements
        profiles_uploaded = db_uploader.upload_float_profiles(profiles)
        logger.info(
            "Profiles uploaded",
            float_id=float_id,
            uploaded=profiles_uploaded,
            total=len(profiles),
        )

        # [TABLE: argo_float_positions] - Current position (latest profile)
        if profiles:
            latest_profile = max(profiles, key=lambda p: p.get("profile_time"))
            surface_temp = None
            surface_sal = None
            if latest_profile.get("measurements"):
                surface_measurement = latest_profile["measurements"][0]
                surface_temp = surface_measurement.get("temperature")
                surface_sal = surface_measurement.get("salinity")

            # Use dict keys directly (all profiles have these fields)
            db_uploader.upload_float_position(
                float_id=float_id,
                latitude=latest_profile["latitude"],
                longitude=latest_profile["longitude"],
                cycle_number=latest_profile["cycle_number"],
                profile_time=latest_profile["profile_time"],
                temperature=surface_temp,
                salinity=surface_sal,
            )
            logger.debug("Position updated", float_id=float_id)

        # Commit transaction
        db_uploader.db.commit_transaction()

        logger.info(
            "Database upload completed",
            float_id=float_id,
            profiles=profiles_uploaded,
        )

        return {"profiles_uploaded": profiles_uploaded}

    except Exception as e:
        db_uploader.db.rollback_transaction()
        logger.exception("Database upload failed", float_id=float_id, error=str(e))
        raise


# NOTE: Not property tested yet...
async def process_batch_floats(
    float_ids: Optional[list[str]] = None,
    upload_to_db: bool = True,
) -> dict:
    """Process multiple floats in batch mode.

    FLOW:
    1. Download ALL floats in one batch (single index fetch)
    2. Loop through each float:
       - Parse NetCDF files (process_netcdf_files)
       - Upload to database (upload_to_database) <- uses same optimized path
    3. Return summary of successes/failures

    NOTE: Each float still uses upload_to_database() which has the optimized
    execute_values path. The "batch" here means downloading multiple floats,
    not a different upload strategy.

    Args:
        float_ids: List of float IDs (None = all INCOIS floats)
        upload_to_db: Upload results to database

    Returns:
        dict with total_floats, successful, failed counts
    """
    start_time = time.time()
    logger.info(
        "Starting batch processing",
        count=len(float_ids) if float_ids else "ALL",
    )

    try:
        # Step 1: Batch download via HTTPS
        sync_worker = ArgoSyncWorker()
        sync_result = await sync_worker.sync(float_ids=float_ids)

        logger.info(
            "Batch sync completed",
            floats=sync_result.get("total_floats", 0),
            files=sync_result.get("files_downloaded", 0),
        )

        # Step 2: Process each float
        floats_to_process = float_ids or []
        if not float_ids:
            # Get all downloaded floats
            cache_path = Path(settings.LOCAL_CACHE_PATH)
            floats_to_process = [
                d.name for d in cache_path.iterdir() if d.is_dir() and d.name.isdigit()
            ]

        results = []
        for float_id in floats_to_process:
            download_result = {"success": True, "sync_result": sync_result}

            # Process NetCDF files
            process_result = process_netcdf_files(float_id)
            if not process_result["success"]:
                results.append(
                    {
                        "success": False,
                        "float_id": float_id,
                        "error": process_result.get("error"),
                    }
                )
                continue

            profiles = process_result["profiles"]
            metadata = process_result["metadata"]
            trajectory = process_result["trajectory"]

            # Upload to database
            upload_result = None
            if upload_to_db:
                upload_result = upload_to_database(float_id, profiles, metadata)

            processing_time = time.time() - start_time
            results.append(
                {
                    "success": True,
                    "float_id": float_id,
                    "processing_time_seconds": processing_time,
                    "sync_result": download_result["sync_result"],
                    "process_result": {
                        "profiles_count": len(profiles),
                        "trajectory_points": len(trajectory),
                        "files_processed": process_result["process_result"].get(
                            "files_processed", 0
                        ),
                    },
                    "upload_result": upload_result,
                }
            )

        success_count = sum(1 for r in results if r.get("success"))
        processing_time = time.time() - start_time

        logger.info(
            "Batch processing completed",
            total=len(results),
            success=success_count,
            failed=len(results) - success_count,
            time_seconds=processing_time,
        )

        return {
            "success": True,
            "total_floats": len(results),
            "successful": success_count,
            "failed": len(results) - success_count,
            "processing_time_seconds": processing_time,
            "sync_result": sync_result,
            "results": results,
        }

    except Exception as e:
        logger.exception("Batch processing failed", error=str(e))
        return {
            "success": False,
            "error": str(e),
            "processing_time_seconds": time.time() - start_time,
        }
