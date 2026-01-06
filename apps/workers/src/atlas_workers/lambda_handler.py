import asyncio
import json
import shutil
from typing import Any, Dict
from .config import settings
from .main import sync


def cleanup_tmp():
    """Remove all staging directories

    AWS Lambda execution environments are reused across multiple invocations for performance reasons, so the tmp directory does not automatically reset after each run."""
    for path in [settings.LOCAL_STAGE_PATH, settings.PARQUET_STAGING_PATH]:
        if path.exists():
            shutil.rmtree(path)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for Atlas Worker.

    Supports two operations:
    1. "sync" - Download and process a single float (for testing)
    2. "update" - Weekly sync to download NEW floats from weekly index (for production)

    Expected event format:
    {
        "operation": "sync" | "update",
        "float_id": "2902224"  # Required for sync operation
    }

    Examples:
    - Test single float: {"operation": "sync", "float_id": "2902224"}
    - Weekly update: {"operation": "update"}
    """
    cleanup_tmp()

    try:
        operation = event.get("operation", "update")

        if operation == "sync":
            # Single float sync (for testing)
            float_id = event.get("float_id")
            if not float_id:
                raise ValueError("float_id required for sync operation")

            result = asyncio.run(sync(float_id=float_id))

        elif operation == "update":
            # Weekly update (downloads only NEW floats)
            result = asyncio.run(sync(update=True))

        else:
            raise ValueError(f"Invalid operation: {operation}. Use 'sync' or 'update'")

        # Convert result to JSON-serializable format
        return {
            "statusCode": 200 if result.get("success") else 500,
            "body": json.dumps(result),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"success": False, "error": str(e)}),
        }
    finally:
        cleanup_tmp()
