"""ARGO processing operations - Main workflow functions."""

import time
from pathlib import Path
from typing import Optional

from .config import settings
from .db import ArgoDataUploader
from .models.argo import FloatMetadata
from .utils import get_logger
from .workers.ftp_sync.ftp_sync import FTPSyncWorker
from .workers.netcdf_processor.netcdf_parser import NetCDFParserWorker

logger = get_logger(__name__)


async def download_float_data(
    float_id: str,
    skip_download: bool = False,
) -> dict:
    """Download data for a single float.

    Args:
        float_id: Float ID to download
        skip_download: Skip FTP download (use cached files)

    Returns:
        Download results dictionary
    """
    sync_result = {}
    if not skip_download:
        logger.info("Starting FTP download", float_id=float_id)
        ftp_worker = FTPSyncWorker()
        sync_result = await ftp_worker.sync(float_ids=[float_id])

        if sync_result.get("errors", 0) > 0:
            error_msg = f"FTP download failed for float {float_id}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "sync_result": sync_result,
            }

        logger.info(
            "FTP download completed",
            float_id=float_id,
            files=sync_result.get("files_downloaded", 0),
        )
    else:
        logger.info("Skipping FTP download (using cached files)", float_id=float_id)

    return {"success": True, "sync_result": sync_result}


def process_netcdf_files(float_id: str) -> dict:
    """Process NetCDF files for a float.

    Args:
        float_id: Float ID to process

    Returns:
        Processing results dictionary
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

    # Convert dict profiles back to ProfileData objects
    from .models.argo import ProfileData

    profiles_dicts = process_result["profiles"]
    profiles = [ProfileData(**p) for p in profiles_dicts]

    metadata = process_result.get("metadata")
    trajectory = process_result.get("trajectory", [])

    logger.info(
        "NetCDF processing completed",
        float_id=float_id,
        profiles=len(profiles),
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
    profiles: list,
    metadata: Optional[dict] = None,
    trajectory: Optional[list] = None,
) -> dict:
    """Upload processed data to database.

    Args:
        float_id: Float ID
        profiles: List of ProfileData objects
        metadata: Float metadata
        trajectory: Trajectory data

    Returns:
        Upload results dictionary
    """
    logger.info("Starting database upload", float_id=float_id)
    db_uploader = ArgoDataUploader()

    # Upload metadata
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

    # Upload profiles
    profiles_uploaded = db_uploader.upload_profiles_batch(profiles)
    logger.info(
        "Profiles uploaded",
        float_id=float_id,
        uploaded=profiles_uploaded,
        total=len(profiles),
    )

    # Upload trajectory
    trajectory_uploaded = 0
    if trajectory:
        trajectory_uploaded = db_uploader.upload_position_timeseries(
            float_id, trajectory
        )
        logger.debug(
            "Trajectory uploaded",
            float_id=float_id,
            points=trajectory_uploaded,
        )

    # Update current position (from latest profile)
    if profiles:
        latest_profile = max(profiles, key=lambda p: p.profile_time)
        surface_temp = None
        surface_sal = None
        if latest_profile.measurements:
            surface_measurement = latest_profile.measurements[0]
            surface_temp = surface_measurement.temperature
            surface_sal = surface_measurement.salinity

        db_uploader.upload_float_position(
            float_id=float_id,
            latitude=latest_profile.latitude,
            longitude=latest_profile.longitude,
            cycle_number=latest_profile.cycle_number,
            profile_time=latest_profile.profile_time,
            temperature=surface_temp,
            salinity=surface_sal,
        )
        logger.debug("Position updated", float_id=float_id)

    # Update statistics
    db_uploader.update_float_stats(float_id)

    # Log processing
    db_uploader.log_processing(
        float_id=float_id,
        operation="full_sync",
        status="success",
        message=f"Processed {len(profiles)} profiles",
        processing_time_ms=0,  # Will be set by caller
    )

    upload_result = {
        "profiles_uploaded": profiles_uploaded,
        "trajectory_points": trajectory_uploaded,
    }

    logger.info(
        "Database upload completed",
        float_id=float_id,
        profiles=profiles_uploaded,
    )

    return upload_result


async def process_batch_floats(
    float_ids: Optional[list[str]] = None,
    upload_to_db: bool = True,
) -> dict:
    """Process multiple floats in optimized batches.

    Args:
        float_ids: List of float IDs (None = fetch all INCOIS floats)
        upload_to_db: Whether to upload to database

    Returns:
        Batch processing results
    """
    start_time = time.time()
    logger.info(
        "Starting batch processing",
        count=len(float_ids) if float_ids else "ALL",
    )

    try:
        # Step 1: Batch download from FTP
        ftp_worker = FTPSyncWorker()
        sync_result = await ftp_worker.sync(float_ids=float_ids)

        logger.info(
            "Batch FTP sync completed",
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
            # Download
            download_result = await download_float_data(float_id, skip_download=True)
            if not download_result["success"]:
                results.append(
                    {
                        "success": False,
                        "float_id": float_id,
                        "error": download_result.get("error"),
                    }
                )
                continue

            # Process
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

            # Upload
            upload_result = None
            if upload_to_db:
                upload_result = upload_to_database(
                    float_id, profiles, metadata, trajectory
                )

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
