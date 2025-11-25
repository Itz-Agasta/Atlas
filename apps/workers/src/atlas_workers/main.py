import argparse
import asyncio
import sys
import time
from typing import Optional

from .db import NeonDBConnector
from .operations import (
    ArgoDataUploader,
    download_float_data,
    process_netcdf_files,
    upload_to_database,
)
from .utils import get_logger, setup_logging

logger = get_logger(__name__)


async def process_single_float(
    float_id: str,
    upload_to_db: bool = True,
    skip_download: bool = False,
) -> dict:
    """Download and process a single ARGO float.

    Args:
        float_id: Float ID to process
        upload_to_db: Whether to upload to database
        skip_download: Skip FTP download (use cached files)

    Returns:
        Processing results dictionary
    """
    start_time = time.time()
    logger.info("Processing float", float_id=float_id, upload=upload_to_db)

    # Track timing for each phase
    timing = {
        "download_seconds": 0.0,
        "process_seconds": 0.0,
        "upload_seconds": 0.0,
        "total_seconds": 0.0,
    }

    try:
        # Step 1: Download data
        download_start = time.time()
        download_result = await download_float_data(float_id, skip_download)
        timing["download_seconds"] = time.time() - download_start

        if not download_result["success"]:
            return {
                "success": False,
                "float_id": float_id,
                "error": download_result.get("error"),
                "sync_result": download_result.get("sync_result"),
            }

        # Step 2: Process NetCDF files
        process_start = time.time()
        process_result = process_netcdf_files(float_id)
        timing["process_seconds"] = time.time() - process_start
        if not process_result["success"]:
            return {
                "success": False,
                "float_id": float_id,
                "error": process_result.get("error"),
                "sync_result": download_result["sync_result"],
                "process_result": process_result.get("process_result"),
            }

        profiles = process_result["profiles"]
        metadata = process_result["metadata"]
        trajectory = process_result["trajectory"]

        # Step 3: Upload to database (if enabled)
        upload_result = None
        if upload_to_db:
            upload_start = time.time()
            upload_result = upload_to_database(float_id, profiles, metadata)
            timing["upload_seconds"] = time.time() - upload_start

        # Calculate total time
        timing["total_seconds"] = time.time() - start_time

        # Log timing breakdown
        logger.info(
            "Float processing completed",
            float_id=float_id,
            download_time=f"{timing['download_seconds']:.2f}s",
            process_time=f"{timing['process_seconds']:.2f}s",
            upload_time=f"{timing['upload_seconds']:.2f}s",
            total_time=f"{timing['total_seconds']:.2f}s",
        )

        # Log final timing to database if uploaded
        if upload_to_db:
            db_uploader = ArgoDataUploader()
            db_uploader.log_processing(
                float_id=float_id,
                operation="full_sync",
                status="success",
                message=f"Total: {timing['total_seconds']:.2f}s (Download: {timing['download_seconds']:.2f}s, Process: {timing['process_seconds']:.2f}s, Upload: {timing['upload_seconds']:.2f}s)",
                processing_time_ms=int(timing["total_seconds"] * 1000),
            )

        return {
            "success": True,
            "float_id": float_id,
            "timing": timing,
            "processing_time_seconds": timing["total_seconds"],
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

    except Exception as e:
        processing_time = time.time() - start_time
        logger.exception("Float processing failed", float_id=float_id, error=str(e))

        # Log error to database
        if upload_to_db:
            try:
                db_uploader = ArgoDataUploader()
                db_uploader.log_processing(
                    float_id=float_id,
                    operation="full_sync",
                    status="error",
                    message=str(e),
                    error_details={"exception": str(type(e).__name__)},
                    processing_time_ms=int(processing_time * 1000),
                )
            except Exception as log_error:
                logger.error("Failed to log error", error=str(log_error))

        return {
            "success": False,
            "float_id": float_id,
            "error": str(e),
            "processing_time_seconds": processing_time,
        }


# NOTE: This is not properly tested yet
async def process_batch_floats(
    float_ids: Optional[list[str]] = None,
    batch_size: int = 10,
    upload_to_db: bool = True,
) -> dict:
    """Process multiple floats in optimized batches.

    Args:
        float_ids: List of float IDs (None = fetch all INCOIS floats)
        batch_size: Number of floats to process in parallel
        upload_to_db: Whether to upload to database

    Returns:
        Batch processing results
    """
    # Import here to avoid circular imports
    from .operations import process_batch_floats as batch_processor

    return await batch_processor(
        float_ids, batch_size=batch_size, upload_to_db=upload_to_db
    )


def main() -> int:
    """Main CLI entry point."""
    # Setup logging
    setup_logging()

    parser = argparse.ArgumentParser(
        description="ARGO Float Data Processor - Download, Process, Upload to Neon DB"
    )

    parser.add_argument(
        "--float-id",
        type=str,
        help="Single float ID to process (e.g., 2902224)",
    )

    parser.add_argument(
        "--batch",
        action="store_true",
        help="Batch mode: process all available floats",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Number of floats to process in parallel (default: 10)",
    )

    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip FTP download, use cached files only",
    )

    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Skip database upload (download and process only)",
    )

    parser.add_argument(
        "--test-db",
        action="store_true",
        help="Test database connection and exit",
    )

    args = parser.parse_args()

    # Test database connection
    if args.test_db:
        logger.info("Testing database connection...")
        db = NeonDBConnector()
        if db.health_check():
            logger.info("Database connection successful")
            return 0
        logger.error("Database connection failed")
        return 1

    upload_to_db = not args.no_upload

    # Single float mode
    if args.float_id:
        logger.info("Running in single float mode", float_id=args.float_id)
        result = asyncio.run(
            process_single_float(
                float_id=args.float_id,
                upload_to_db=upload_to_db,
                skip_download=args.skip_download,
            )
        )

        if result.get("success"):
            logger.info("Float processing completed successfully")
            timing = result.get("timing", {})
            print(f"\nSuccess: Float {args.float_id} processed")
            print(f"   Profiles: {result['process_result']['profiles_count']}")
            print(f"   FTP Download: {timing.get('download_seconds', 0):.2f}s")
            print(f"   NetCDF Processing: {timing.get('process_seconds', 0):.2f}s")
            print(f"   Database Upload: {timing.get('upload_seconds', 0):.2f}s")
            print(f"   Total Time: {timing.get('total_seconds', 0):.2f}s")
            return 0
        logger.error("Float processing failed")
        print(f"\nError: {result.get('error')}")
        return 1

    # Batch mode
    if args.batch:
        logger.info("Running in batch mode")
        result = asyncio.run(
            process_batch_floats(
                batch_size=args.batch_size,
                upload_to_db=upload_to_db,
            )
        )

        if result.get("success"):
            logger.info("Batch processing completed")
            print("\n Batch processing completed")
            print(f"   Total: {result['total_floats']}")
            print(f"   Success: {result['successful']}")
            print(f"   Failed: {result['failed']}")
            print(f"   Time: {result['processing_time_seconds']:.2f}s")
            return 0
        logger.error("Batch processing failed")
        print(f"\nError: {result.get('error')}")
        return 1

    # No mode specified
    parser.print_help()
    logger.warning("No operation mode specified")
    return 1


if __name__ == "__main__":
    sys.exit(main())
