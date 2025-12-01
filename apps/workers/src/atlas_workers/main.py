import argparse
import asyncio
import sys
import time
from typing import TypedDict

from .db import Postgres
from .models import FloatStatus
from .utils import get_logger
from .workers import ArgoSyncWorker, NetCDFParserWorker

logger = get_logger(__name__)


class ProcessResult(TypedDict, total=False):
    success: bool
    float_id: str
    timing: dict[str, float]
    error: str


async def process_single_float(
    float_id: str, skip_download: bool = False
) -> ProcessResult:
    """Process a single ARGO float: download, parse, upload."""
    # Track timing for each phases
    timing = {
        "download_seconds": 0.0,
        "process_seconds": 0.0,
        "pg_upload_seconds": 0.0,
        "total_seconds": 0.0,
    }

    start_time = time.time()

    try:
        # 1. Download
        download_start = time.time()
        if not skip_download:
            sync_worker = ArgoSyncWorker()
            await sync_worker.sync(float_ids=[float_id])
        timing["download_seconds"] = time.time() - download_start

        # 2. Parse
        process_start = time.time()
        parser = NetCDFParserWorker()
        result = parser.process_directory(float_id)
        timing["process_seconds"] = time.time() - process_start

        # 3. Upload into pg
        upload_start = time.time()
        db = Postgres()
        try:
            # Use Pydantic's validation with automatic type coercion
            # - profile_time -> last_update (via validation_alias)
            # - float_id string -> int (automatic)
            status_model = FloatStatus.model_validate(result["status"])

            upload_success = db.batch_upload_data(
                metadata=result["metadata"],
                status=status_model,
                float_id=int(float_id),
            )

            if not upload_success:
                raise ValueError("Database upload failed")

            db.conn.commit()
            timing["pg_upload_seconds"] = time.time() - upload_start
        finally:
            db.conn.close()

        # TODO: # 4. upload into duckdb

        timing["total_seconds"] = time.time() - start_time

        logger.info(
            "Float processing completed",
            float_id=float_id,
            download_time=f"{timing['download_seconds']:.2f}s",
            process_time=f"{timing['process_seconds']:.2f}s",
            pg_upload_time=f"{timing['pg_upload_seconds']:.2f}s",
            total_time=f"{timing['total_seconds']:.2f}s",
        )

        # TODO: upload logs into processing_log table

        return {"success": True, "float_id": float_id, "timing": timing}

    except Exception as e:
        logger.exception("Float processing failed", float_id=float_id, error=str(e))
        return {"success": False, "float_id": float_id, "error": str(e)}


async def process_batch_floats() -> ProcessResult:
    """Process multiple floats in parallel.
    args:
        float_ids: list[str]
    """
    # TODO: Implement later
    return ProcessResult(
        success=False, float_id="", error="Batch processing not implemented yet"
    )


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--float-id",
        type=str,
        help="Single float ID to process (e.g., 2902224)",
    )

    parser.add_argument("--batch-file")  # will work on it later

    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip download, use cached files only",
    )

    args = parser.parse_args()

    if args.float_id:
        logger.info("Processing float", float_id=args.float_id)
        result = asyncio.run(
            process_single_float(
                float_id=args.float_id,
                skip_download=args.skip_download,
            )
        )
    elif args.batch_file:
        # TODO: Implement batch processing
        result = asyncio.run(process_batch_floats())
    else:
        parser.print_help()
        return 1

    if result.get("success"):
        timing = result.get("timing") or {}
        print(f"\n Success: Float {args.float_id} processed")
        print(f"  Download:   {timing.get('download_seconds', 0.0):.2f}s")
        print(f"  Process:    {timing.get('process_seconds', 0.0):.2f}s")
        print(f"  Upload:     {timing.get('pg_upload_seconds', 0.0):.2f}s")
        print(f"  Total:      {timing.get('total_seconds', 0.0):.2f}s")
        return 0
    else:
        error_msg = result.get("error") or "Unknown error"
        logger.error("Processing failed", float_id=args.float_id, error=error_msg)
        return 1


if __name__ == "__main__":
    sys.exit(main())
