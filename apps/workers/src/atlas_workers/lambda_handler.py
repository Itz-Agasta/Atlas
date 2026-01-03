import asyncio
import json
from typing import Any, Dict
from .main import sync


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for Atlas Worker.

    Expected event format:
    {
        "operation": "sync" | "sync_all" | "update",
        "float_id": "2902224",  # optional, only for single sync
    }

    NOTE: No --skip-downlaod, --skip-upload avalible for cloud env
    """
    try:
        operation = event.get("operation", "sync_all")

        if operation == "sync":
            float_id = event.get("float_id")
            if not float_id:
                raise ValueError("float_id required for sync operation")
            result = asyncio.run(
                sync(
                    float_id=float_id,
                )
            )

        elif operation == "sync_all":
            result = asyncio.run(sync(sync_all=True))

        elif operation == "update":
            result = asyncio.run(sync(update=True))

        else:
            raise ValueError(f"Unknown operation: {operation}")

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
