import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import TypedDict

from .db import PgClient, S3Client
from .models import FloatStatus
from .utils import get_logger
from .workers import ArgoSyncWorker, NetCDFParserWorker

logger = get_logger(__name__)


class ProcessResult(TypedDict, total=False):
    success: bool
    float_id: str | None
    total: int
    downloaded: int
    processed: int
    failed: int
    timing: dict[str, float]
    error: str


async def sync(
    float_id: str | None = None,
    sync_all: bool = False,
    skip_download: bool = False,
) -> ProcessResult:
    """Sync and process ARGO float(s): download, parse, upload to DB.

    Args:
        float_id: Single float ID to sync (mutually exclusive with sync_all)
        sync_all: If True, sync all floats from DAC
        skip_download: Skip download phase, use cached files only

    Returns:
        ProcessResult with success status and timing info
    """
    if not float_id and not sync_all:
        raise ValueError("Either float_id or sync_all must be provided")

    timing: dict[str, float] = {
        "download_time": 0.0,
        "parse_time": 0.0,
        "upload_time": 0.0,
        "total_time": 0.0,
    }

    start_time = time.time()
    db: PgClient | None = None
    processed_count = 0
    failed_count = 0
    float_ids_to_process: list[str] = []

    try:
        sync_worker = ArgoSyncWorker()

        # 1. Download phase - only difference between single and all
        download_start = time.time()

        if sync_all:
            # Sync all floats from DAC
            if not skip_download:
                sync_result = await sync_worker.syncAll()
                logger.info(
                    "SyncAll download completed",
                    total=sync_result["total"],
                    downloaded=sync_result["downloaded"],
                    new=sync_result["new"],
                    failed=sync_result["failed"],
                )
                failed_count = sync_result["failed"]

            # Get list of downloaded floats from manifest
            manifest = sync_worker._load_manifest()
            float_ids_to_process = manifest.get("downloaded", [])

        else:
            # Single float sync - float_id is guaranteed to be set here
            assert float_id is not None
            if not skip_download:
                download_success = await sync_worker.sync(float_id)
                if not download_success:
                    raise ValueError(
                        f"Failed to download any files for float {float_id}"
                    )
            float_ids_to_process = [float_id]

        timing["download_time"] = time.time() - download_start

        # 2. Process and upload phase - same for both single and all
        db = PgClient()
        operation = "SYNC_ALL" if sync_all else "SYNC"

        parse_time_total = 0.0
        upload_time_total = 0.0

        for fid in float_ids_to_process:
            try:
                # Parse NetCDF files
                parse_start = time.time()
                parser = NetCDFParserWorker()
                result = parser.process_directory(fid) # FIXME: currently we are itterating through each float. we will do this operation concurrently later.
                parse_time_total += time.time() - parse_start

                # Check if parser returned an error
                if "error" in result:
                    raise ValueError(f"NetCDF parsing failed: {result['error']}")

                if result.get("metadata") is None or result.get("status") is None:
                    raise ValueError("NetCDF parsing returned no metadata or status")

                # Upload metadata and status to Pg
                upload_start = time.time()
                status_model = FloatStatus.model_validate(result["status"])
                upload_success = db.batch_upload_data(
                    metadata=result["metadata"],
                    status=status_model,
                    float_id=int(fid),
                )

                if not upload_success:
                    raise ValueError("Database upload failed")

                # Upload Parquet to R2
                parquet_path = result.get("parquet_path")
                if parquet_path:
                    try:
                        s3_client = S3Client()
                        s3_client.upload_file(
                            float_id=fid,
                            local_path=Path(parquet_path),
                        )
                    except Exception as e:
                        logger.warning("R2 upload skipped", float_id=fid, error=str(e))
                else:
                    logger.debug("No parquet file to upload", float_id=fid)

                upload_time_total += time.time() - upload_start

                # Log success with total processing time (download + parse + upload)
                total_processing_time_ms = int((time.time() - start_time) * 1000)
                db.log_processing(
                    float_id=int(fid),
                    operation=operation,
                    status="SUCCESS",
                    processing_time_ms=total_processing_time_ms,
                )
                processed_count += 1

                # Commit every 10 floats for safety (batch mode)
                if sync_all and processed_count % 10 == 0:
                    db.conn.commit()

            except Exception as e:
                logger.error("Failed to process float", float_id=fid, error=str(e))
                total_processing_time_ms = int((time.time() - start_time) * 1000)
                db.log_processing(
                    float_id=int(fid) if fid.isdigit() else None,
                    operation=operation,
                    status="FAILED",
                    processing_time_ms=total_processing_time_ms,
                    error_details={"error": str(e)},
                )
                db.conn.commit()  # Commit the error log before re-raising
                failed_count += 1

                # For single float, re-raise with a flag to skip outer logging
                if not sync_all:
                    raise RuntimeError(f"Float {fid} processing failed: {e}") from None

        timing["parse_time"] = parse_time_total
        timing["upload_time"] = upload_time_total
        timing["total_time"] = time.time() - start_time
        timing["process_time"] = timing["parse_time"] + timing["upload_time"]

        # Final commit
        db.conn.commit()

        if sync_all:
            logger.info(
                "SyncAll completed",
                total=len(float_ids_to_process) + failed_count,
                processed=processed_count,
                failed=failed_count,
                download_time=f"{timing['download_time']:.2f}s",
                parse_time=f"{timing['parse_time']:.2f}s",
                upload_time=f"{timing['upload_time']:.2f}s",
                total_time=f"{timing['total_time']:.2f}s",
            )
            return {
                "success": True,
                "float_id": None,
                "total": len(float_ids_to_process) + failed_count,
                "downloaded": len(float_ids_to_process),
                "processed": processed_count,
                "failed": failed_count,
                "timing": timing,
            }
        else:
            logger.info(
                "Float processing completed",
                float_id=float_id,
                download_time=f"{timing['download_time']:.2f}s",
                parse_time=f"{timing['parse_time']:.2f}s",
                upload_time=f"{timing['upload_time']:.2f}s",
                total_time=f"{timing['total_time']:.2f}s",
            )
            return {
                "success": True,
                "float_id": float_id,
                "timing": timing,
            }

    except RuntimeError as e:
        # RuntimeError is raised from inner loop after logging - don't log again
        error_msg = str(e)
        logger.error("Sync failed", float_id=float_id, error=error_msg)

        return {
            "success": False,
            "float_id": float_id,
            "error": error_msg,
            "failed": failed_count,
        }

    except Exception as e:
        # Unexpected error (e.g., download failure) - log to DB
        error_msg = str(e)
        logger.exception(
            "Sync failed",
            float_id=float_id,
            sync_all=sync_all,
            error=error_msg,
        )

        # Log failure to processing_log
        if db is None:
            try:
                db = PgClient()
            except Exception:
                pass

        if db is not None:
            processing_time_ms = int((time.time() - start_time) * 1000)
            db.log_processing(
                float_id=int(float_id) if float_id and float_id.isdigit() else None,
                operation="SYNC_ALL" if sync_all else "SYNC",
                status="FAILED",
                processing_time_ms=processing_time_ms,
                error_details={"error": error_msg},
            )
            db.conn.commit()
            db.conn.close()

        return {
            "success": False,
            "float_id": float_id,
            "error": error_msg,
            "failed": failed_count,
        }

    finally:
        if db is not None:
            db.conn.close()

# corn job - upadtes the db w.r.t argo repo
def update():
    pass # TODO: will implement using update method form argo worker

def main() -> int:
    parser = argparse.ArgumentParser(
        description="ARGO Float Sync Worker - Download and process ARGO float data"
    )

    # Mutually exclusive: either --id or --all
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--id",
        type=str,
        dest="float_id",
        help="Single float ID to sync and process (e.g., --id=2902224)",
    )
    group.add_argument(
        "--all",
        action="store_true",
        dest="sync_all",
        help="Sync all floats from the DAC",
    )

    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip download, use cached files only", # TODO: Make it skip upload not downlaod
    )

    args = parser.parse_args()

    # Run sync with appropriate args
    result = asyncio.run(
        sync(
            float_id=args.float_id,
            sync_all=args.sync_all,
            skip_download=args.skip_download,
        )
    )

    timing = result.get("timing") or {}

    if result.get("success"):
        if args.sync_all:
            print("\n✓ SyncAll completed")
            print(f"  Total floats:  {result.get('total', 0)}")
            print(f"  Downloaded:    {result.get('downloaded', 0)}")
            print(f"  Processed:     {result.get('processed', 0)}")
            print(f"  Failed:        {result.get('failed', 0)}")
            print(f"  Download time: {timing.get('download_time', 0.0):.2f}s")
            print(f"  Parse time:    {timing.get('parse_time', 0.0):.2f}s")
            print(f"  Upload time:   {timing.get('upload_time', 0.0):.2f}s")
            print(f"  Total time:    {timing.get('total_time', 0.0):.2f}s")
        else:
            print(f"\n✓ Success: Float {args.float_id} processed")
            print(f"  Download:   {timing.get('download_time', 0.0):.2f}s")
            print(f"  Parse:      {timing.get('parse_time', 0.0):.2f}s")
            print(f"  Upload:     {timing.get('upload_time', 0.0):.2f}s")
            print(f"  Total:      {timing.get('total_time', 0.0):.2f}s")
        return 0
    else:
        error_msg = result.get("error") or "Unknown error"
        print(f"\n✗ Failed: {error_msg}")
        return 1


if __name__ == "__main__":
    sys.exit(main())


