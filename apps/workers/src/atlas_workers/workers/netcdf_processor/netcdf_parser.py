import time
from pathlib import Path
from typing import Any

from ... import get_logger, settings
from .netcdf_aggregate_parser import (
    get_profile_stats,
    parse_metadata_file,
)
from .netcdf_to_parquet_converter import (
    extract_profiles_dataframe,
    save_parquet,
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
            Stats Dict containing metadata, status, and processing stats
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
        }

        self._prepare_pg_data(float_dir, float_id, stats)

        # TODO: same style return parquet path into stats. so it can be upload into R2
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

    # FIXME: will merge it with process_dic fun later. make it a pvt fun
    def converter(float_id: str, cache_path: Path | None = None) -> dict[str, Any]:
        """Convert NetCDF profiles to Parquet format.

        Main entry point for profile conversion to Parquet.

        Args:
            float_id: Float ID to process
            cache_path: Local NetCDF cache directory (uses settings if None)

        Returns:
            Dict with conversion stats and local file paths
        """
        cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)
        staging_path = Path(settings.PARQUET_STAGING_PATH)
        staging_path.mkdir(parents=True, exist_ok=True)

        prof_file = cache_path / settings.ARGO_DAC / float_id / f"{float_id}_prof.nc"

        if not prof_file.exists():
            logger.warning("Profile file not found", float_id=float_id)
            return {"float_id": float_id, "error": "Profile file not found"}

        stats: dict[str, Any] = {
            "float_id": float_id,
            "profiles_converted": 0,
            "parquet_files": [],
            "errors": 0,
        }

        try:
            profiles_df = extract_profiles_dataframe(prof_file, float_id)

            if profiles_df is None or profiles_df.empty:
                logger.warning("No valid profiles found", float_id=float_id)
                stats["error"] = "No profiles to convert"
                return stats

            stats["profiles_converted"] = len(profiles_df)

            parquet_path = staging_path / f"{float_id}_profiles.parquet"
            save_parquet(profiles_df, parquet_path, float_id)
            stats["parquet_files"].append(str(parquet_path))

            logger.info(
                "Profile conversion complete",
                float_id=float_id,
                profiles=stats["profiles_converted"],
                output=str(parquet_path),
            )

        except Exception as e:
            logger.error("Profile conversion failed", float_id=float_id, error=str(e))
            stats["errors"] += 1

        return stats
