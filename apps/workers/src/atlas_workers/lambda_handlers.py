"""AWS Lambda handlers for ARGO workers."""

import asyncio
import json
import logging
from typing import Any

from atlas_workers.utils import setup_logging
from atlas_workers.workers import ArgoSyncWorker, NetCDFParserWorker

setup_logging()
logger = logging.getLogger(__name__)


def argo_sync_handler(event: dict, context: Any) -> dict:
    """AWS Lambda handler for ARGO sync worker.

    Event format:
    {
        "float_ids": ["2902224", "2902225"]  # Optional
    }

    Returns:
        {
            "statusCode": 200,
            "body": JSON sync result
        }
    """
    try:
        logger.info("ARGO Sync handler invoked", extra={"event": event})

        worker = ArgoSyncWorker()
        float_ids = event.get("float_ids")

        # Run async worker
        result = asyncio.run(worker.sync(float_ids=float_ids))

        return {
            "statusCode": 200,
            "body": json.dumps(result, default=str),
        }
    except Exception as e:
        logger.exception("ARGO sync failed", extra={"error": str(e)})
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }


def netcdf_parser_handler(event: dict, context: Any) -> dict:
    """AWS Lambda handler for NetCDF parser worker.

    Event format:
    {
        "float_id": "2902224"  # Optional, defaults to "2902224"
    }

    Returns:
        {
            "statusCode": 200,
            "body": JSON parsing result
        }
    """
    try:
        logger.info("NetCDF Parser handler invoked", extra={"event": event})

        worker = NetCDFParserWorker()
        float_id = event.get("float_id", "2902224")

        # Process directory
        result = worker.process_directory(float_id)

        return {
            "statusCode": 200,
            "body": json.dumps(result, default=str),
        }
    except Exception as e:
        logger.exception("NetCDF parsing failed", extra={"error": str(e)})
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }


# For local testing
if __name__ == "__main__":
    # Test ARGO sync handler
    print("Testing ARGO sync handler...")
    result = argo_sync_handler({"float_ids": ["2902224"]}, None)
    print(json.dumps(json.loads(result["body"]), indent=2))

    print("\nTesting NetCDF parser handler...")
    result = netcdf_parser_handler({"float_id": "2902224"}, None)
    print(json.dumps(json.loads(result["body"]), indent=2, default=str))
