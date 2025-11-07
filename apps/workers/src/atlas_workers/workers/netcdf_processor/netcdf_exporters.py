"""Export utilities for profile data to various formats."""

import json
from pathlib import Path
from typing import Any

from ...models import ProfileData
from ...utils import get_logger

logger = get_logger(__name__)


def export_to_json(profiles: list[ProfileData], output_path: Path) -> bool:
    """Export profiles to JSON format.

    Args:
        profiles: List of ProfileData objects or dictionaries
        output_path: Output file path

    Returns:
        True if successful, False otherwise
    """
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Handle both ProfileData objects and dictionaries
        data = []
        for p in profiles:
            if hasattr(p, "model_dump"):
                data.append(p.model_dump())
            else:
                data.append(p)

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(
            "Profiles exported to JSON",
            path=str(output_path),
            count=len(profiles),
        )
        return True
    except Exception as e:
        logger.exception("Export failed", error=str(e))
        return False


def export_to_arrow(
    profiles: list[ProfileData], output_path: Path, compression: str = "zstd"
) -> bool:
    """Export profiles to Arrow/Parquet format.

    Args:
        profiles: List of ProfileData objects or dictionaries
        output_path: Output file path
        compression: Compression algorithm (default: zstd)

    Returns:
        True if successful, False otherwise
    """
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Helper to extract attributes from profile objects or dicts
        def get_attr(p: Any, attr: str) -> Any:
            if hasattr(p, attr):
                return getattr(p, attr)
            elif isinstance(p, dict) and attr in p:
                return p[attr]
            return None

        # Create Arrow table
        data = {
            "float_id": [get_attr(p, "float_id") for p in profiles],
            "cycle_number": [get_attr(p, "cycle_number") for p in profiles],
            "profile_time": [get_attr(p, "profile_time") for p in profiles],
            "latitude": [get_attr(p, "latitude") for p in profiles],
            "longitude": [get_attr(p, "longitude") for p in profiles],
            "max_depth": [get_attr(p, "max_depth") for p in profiles],
            "quality_status": [get_attr(p, "quality_status") for p in profiles],
            "measurement_count": [
                len(get_attr(p, "measurements") or []) for p in profiles
            ],
        }

        table = pa.table(data)

        # Write with Parquet format (compressed columnar)
        pq.write_table(
            table,
            output_path,
            compression=compression,
            use_dictionary=True,
        )

        logger.info(
            "Profiles exported to Arrow/Parquet",
            path=str(output_path),
            count=len(profiles),
        )
        return True
    except ImportError:
        logger.error("PyArrow not installed")
        return False
    except Exception as e:
        logger.exception("Arrow export failed", error=str(e))
        return False
