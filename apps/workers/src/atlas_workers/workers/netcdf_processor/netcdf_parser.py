import time
from pathlib import Path
from typing import Any

from ... import get_logger, settings
from .converter import ParquetConverter
from .netcdf_aggregate_parser import (
    get_profile_stats,
    parse_metadata_file,
)

logger = get_logger(__name__)


class NetCDFParserWorker:
    """Extract ARGO metadata and status for PostgreSQL."""

    def __init__(self, cache_path: Path | None = None):
        self.cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)

    def process_directory(self, float_id: str) -> dict[str, Any]:
        """Main Gateway: Extract metadata and status for a specific float.

        Args:
            float_id: Float ID to process

        Returns:
            Stats Dict containing metadata, status, parquet path, and processing stats
        """
        float_dir = self.cache_path / settings.ARGO_DAC / float_id
        if not float_dir.exists():
            logger.warning("Float directory not found", float_id=float_id)
            return {"float_id": float_id, "error": "Directory not found"}

        stats: dict[str, Any] = {
            "float_id": float_id,
            "files_processed": 0,
            "errors": 0,
            "metadata": None,
            "status": None,
            "parquet_path": None,
        }

        self._prepare_pg_data(float_dir, float_id, stats)

        # Convert to Parquet for R2 staging
        prof_file = float_dir / f"{float_id}_prof.nc"
        converter = ParquetConverter()
        parquet_path = converter.convert(prof_file, float_id)
        if parquet_path:
            stats["parquet_path"] = parquet_path
            logger.info(
                "Parquet file conversion done!", float_id=float_id, path=parquet_path
            )

        return stats

    def _prepare_pg_data(
        self, float_dir: Path, float_id: str, stats: dict[str, Any]
    ) -> None:
        """Extract metadata and status from NetCDF files.

        Processing order:
        1. Get latest profile time from prof.nc (for status determination)
        2. Extract full metadata using the profile time
        3. Re-extract profile stats with battery estimation using metadata

        Args:
            float_dir: Float directory path
            float_id: Float ID
            stats: Statistics dict to update
        """
        prof_file = float_dir / f"{float_id}_prof.nc"
        latest_profile_time = None

        # Step 1: Extract basic profile stats (without battery)
        if prof_file.exists():
            try:
                start = time.time()
                status_summary = get_profile_stats(prof_file)
                elapsed = time.time() - start

                if status_summary:
                    stats["status"] = status_summary
                    latest_profile_time = status_summary.get("profile_time")
                    stats["files_processed"] += 1
                    logger.info(
                        "Profile status extracted",
                        float_id=float_id,
                        cycle=status_summary.get("cycle_number"),
                        duration_ms=round(elapsed * 1000, 1),
                    )
            except Exception as e:
                logger.error(
                    "Profile extraction failed", float_id=float_id, error=str(e)
                )
                stats["errors"] += 1
        else:
            logger.warning("Profile file not found", float_id=float_id)

        # Step 2: Extract metadata (uses profile_time for status determination)
        meta_file = float_dir / f"{float_id}_meta.nc"
        if meta_file.exists():
            try:
                stats["metadata"] = parse_metadata_file(meta_file, latest_profile_time)
                stats["files_processed"] += 1
                if stats["metadata"]:
                    logger.info(
                        "Metadata extracted",
                        float_id=float_id,
                        status=stats["metadata"].status,
                        float_type=stats["metadata"].float_type,
                    )
            except Exception as e:
                logger.error(
                    "Metadata extraction failed", float_id=float_id, error=str(e)
                )
                stats["errors"] += 1
        else:
            logger.error("Metadata file not found", float_id=float_id)
            stats["errors"] += 1

        # Step 3: Re-extract profile stats with battery estimation
        if prof_file.exists() and stats.get("metadata"):
            try:
                status_summary = get_profile_stats(prof_file, stats["metadata"])
                if status_summary:
                    stats["status"] = status_summary
                    if "battery_percent" in status_summary:
                        logger.info(
                            "Battery estimation completed",
                            float_id=float_id,
                            battery_percent=status_summary["battery_percent"],
                        )
            except Exception as e:
                logger.warning(
                    "Battery estimation failed", float_id=float_id, error=str(e)
                )
