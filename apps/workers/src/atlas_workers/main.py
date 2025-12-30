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
    processed_count = 0
    failed_count = 0
    float_ids_to_process: list[str] = []

    sync_worker = ArgoSyncWorker()

    # 1. Download phase
    download_start = time.time()

    if sync_all:
        if not skip_download:
            logger.info("Staring full sync...")
            sync_result = await sync_worker.syncAll()
            logger.info(
                "SyncAll download completed",
                total=sync_result["total"],
                downloaded=sync_result["downloaded"],
                new=sync_result["new"],
                failed=sync_result["failed"],
            )
            failed_count = sync_result["failed"]

        manifest = sync_worker._load_manifest()
        float_ids_to_process = manifest.get("downloaded", [])
    else:
        assert float_id is not None
        if not skip_download:
            logger.info("Starting single float sync...")
            download_success = await sync_worker.sync(float_id)  # single float download
            if not download_success:
                return {
                    "success": False,
                    "float_id": float_id,
                    "error": f"Failed to download any files for float {float_id}",
                    "failed": 1,
                }
        float_ids_to_process = [float_id]

    timing["download_time"] = time.time() - download_start

    if not float_ids_to_process:
        timing["total_time"] = time.time() - start_time
        return {
            "success": True,
            "float_id": float_id,
            "total": 0,
            "processed": 0,
            "failed": failed_count,
            "timing": timing,
        }

    # 2. Process and upload phase - create clients once outside loop
    try:
        db = PgClient()
        s3_client = S3Client()
        parser = NetCDFParserWorker()
    except Exception as e:
        logger.error("Failed to initialize clients", error=str(e))
        return {
            "success": False,
            "float_id": float_id,
            "error": f"Client initialization failed: {e}",
            "failed": len(float_ids_to_process),
        }

    operation = "SYNC_ALL" if sync_all else "SYNC"
    parse_time_total = 0.0
    upload_time_total = 0.0
    successful_float_ids: list[int] = []
    failed_float_ids_list: list[int] = []

    try:
        for fid in float_ids_to_process:
            try:
                # Parse NetCDF files
                parse_start = time.time()
                result = parser.process_directory(
                    fid
                )  # FIXME: currently we are itterating through each float. we will do this operation concurrently later.
                parse_time_total += time.time() - parse_start

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
                        s3_client.upload_file(
                            float_id=fid,
                            local_path=Path(parquet_path),
                        )
                    except Exception as e:
                        logger.warning("R2 upload skipped", float_id=fid, error=str(e))
                else:
                    logger.debug("No parquet file to upload", float_id=fid)

                upload_time_total += time.time() - upload_start

                # Track success
                successful_float_ids.append(int(fid))
                processed_count += 1

            except Exception as e:
                logger.error("Failed to process float", float_id=fid, error=str(e))
                # Track failure
                if fid.isdigit():
                    failed_float_ids_list.append(int(fid))
                failed_count += 1

                # For single float, return failure immediately
                if not sync_all:
                    # Log the single failure
                    total_time_ms = int((time.time() - start_time) * 1000)
                    db.log_processing(
                        operation=operation,
                        status="FAILED",
                        successful_float_ids=[],
                        failed_float_ids=[int(fid)] if fid.isdigit() else [],
                        processing_time_ms=total_time_ms,
                        error_details={"error": str(e)},
                    )
                    db.conn.commit()
                    return {
                        "success": False,
                        "float_id": float_id,
                        "error": str(e),
                        "failed": 1,
                    }

            # Commit every 10 floats for safety (batch mode)
            if sync_all and (processed_count + failed_count) % 10 == 0:
                db.conn.commit()

        timing["parse_time"] = parse_time_total
        timing["upload_time"] = upload_time_total
        timing["total_time"] = time.time() - start_time

        # Log batch results to database
        total_time_ms = int(timing["total_time"] * 1000)
        status = "SUCCESS" if failed_float_ids_list == [] else "FAILED"
        db.log_processing(
            operation=operation,
            status=status,
            successful_float_ids=successful_float_ids,
            failed_float_ids=failed_float_ids_list,
            processing_time_ms=total_time_ms,
            error_details={"failed_count": failed_count} if failed_count > 0 else None,
        )

        db.conn.commit()

        if sync_all:
            logger.info(
                "Full float sync completed",
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
                "Single float sync completed",
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

    finally:
        db.conn.close()


# corn job - upadtes the db w.r.t argo repo
def update():
    pass  # TODO: will implement using update method form argo worker


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
        help="Skip download, use cached files only",  # TODO: Make a skip upload too
    )

    args = parser.parse_args()

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
            print("\n SyncAll completed")
            print(f"  Total floats:  {result.get('total', 0)}")
            print(f"  Downloaded:    {result.get('downloaded', 0)}")
            print(f"  Processed:     {result.get('processed', 0)}")
            print(f"  Failed:        {result.get('failed', 0)}")
            print(f"  Download time: {timing.get('download_time', 0.0):.2f}s")
            print(f"  Parse time:    {timing.get('parse_time', 0.0):.2f}s")
            print(f"  Upload time:   {timing.get('upload_time', 0.0):.2f}s")
            print(f"  Total time:    {timing.get('total_time', 0.0):.2f}s")
        else:
            print(f"\n Success: Float {args.float_id} processed")
            print(f"  Download:   {timing.get('download_time', 0.0):.2f}s")
            print(f"  Parse:      {timing.get('parse_time', 0.0):.2f}s")
            print(f"  Upload:     {timing.get('upload_time', 0.0):.2f}s")
            print(f"  Total:      {timing.get('total_time', 0.0):.2f}s")
        return 0
    else:
        print(f"\n Failed: {result.get('error', 'Unknown error')}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

# TODO: Fix the upadte fun -> so its go and downalod whats in this week file
# TODO: update the db process log table. so we can pass a array of floats in SynAll. --done
# TODO: Track what floas are uploaded to db uncessfull . log them too  [oparation, sucess, uncuess, error]-- done
