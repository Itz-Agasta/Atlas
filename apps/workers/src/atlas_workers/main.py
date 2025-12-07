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
    float_id: str
    timing: dict[str, float]
    parquet_path: str | None
    error: str


async def process_single_float(
    float_id: str, skip_download: bool = False
) -> ProcessResult:
    """Process a single ARGO float: download, parse, upload."""
    # Track timing for each phases
    timing = {
        "download_time": 0.0,
        "process_time": 0.0,
        "upload_time": 0.0,
        "total_time": 0.0,
    }

    start_time = time.time()

    try:
        # 1. Download
        download_start = time.time()
        if not skip_download:
            sync_worker = ArgoSyncWorker()
            await sync_worker.sync(float_ids=[float_id])
        timing["download_time"] = time.time() - download_start

        # 2. Parse
        process_start = time.time()
        parser = NetCDFParserWorker()
        result = parser.process_directory(float_id)
        timing["process_time"] = time.time() - process_start

        # 3. Upload into pg
        pg_upload_start = time.time()
        db = PgClient()
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
            pg_upload_time = time.time() - pg_upload_start
        finally:
            db.conn.close()

        # 4. Upload into R2
        s3_upload_time = 0.0
        parquet_path = result.get("parquet_path")
        if parquet_path:
            s3_upload_start = time.time()
            try:
                s3_client = S3Client()
                upload_success = s3_client.upload_file(
                    float_id=float_id,
                    local_path=Path(parquet_path),
                )
                s3_upload_time = time.time() - s3_upload_start

            except Exception as e:
                logger.warning(
                    "R2 upload skipped",
                    float_id=float_id,
                    error=str(e),
                )
        else:
            logger.warning("No parquet file to upload", float_id=float_id)

        timing["total_time"] = time.time() - start_time
        timing["upload_time"] = pg_upload_time + s3_upload_time

        logger.info(
            "Float processing completed",
            float_id=float_id,
            download_time=f"{timing['download_time']:.2f}s",
            process_time=f"{timing['process_time']:.2f}s",
            pg_upload_time=f"{pg_upload_time:.2f}s",
            s3_upload_time=f"{s3_upload_time:.2f}s",
            upload_time=f"{timing['upload_time']:.2f}s",
            total_time=f"{timing['total_time']:.2f}s",
        )

        # TODO: make both uploads parallel

        # TODO: upload logs into processing_log table in pg

        return {
            "success": True,
            "float_id": float_id,
            "timing": timing,
        }

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
        print(f"  Download:   {timing.get('download_time', 0.0):.2f}s")
        print(f"  Process:    {timing.get('process_time', 0.0):.2f}s")
        print(f"  Upload:     {timing.get('upload_time', 0.0):.2f}s")
        print(f"  Total:      {timing.get('total_time', 0.0):.2f}s")
        return 0
    else:
        error_msg = result.get("error") or "Unknown error"
        logger.error("Processing failed", float_id=args.float_id, error=error_msg)
        return 1


if __name__ == "__main__":
    sys.exit(main())
