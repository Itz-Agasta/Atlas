"""NetCDF Parser Worker - Aggregate File Processing.

Parses ARGO float data from aggregate NetCDF files:
- {float_id}_meta.nc  → Float deployment info (parse_metadata_file)
- {float_id}_prof.nc  → ALL profiles in one file (parse_aggregate_profiles)
- {float_id}_Rtraj.nc → Trajectory positions (parse_trajectory_file)
- {float_id}_tech.nc  → Sensor calibration (parse_tech_file)
"""

from pathlib import Path
from typing import Any

from ...config import settings
from ...utils import get_logger
from .netcdf_aggregate_parser import (
    parse_aggregate_profiles,
    parse_metadata_file,
    parse_tech_file,
    parse_trajectory_file,
)

logger = get_logger(__name__)


class NetCDFParserWorker:
    """Parse NetCDF ARGO files using optimized aggregate file processing."""

    def __init__(self, cache_path: Path | None = None):
        """Initialize NetCDF parser worker.

        Args:
            cache_path: Path to cached ARGO files (default: settings.LOCAL_CACHE_PATH)
        """
        self.cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)

    def process_directory(self, float_id: str) -> dict[str, Any]:
        """Process all NetCDF files for a float using aggregate files.

        This is the main entry point. Uses the aggregate _prof.nc file
        which contains all profiles in a single vectorized dataset.

        Args:
            float_id: Float ID to process

        Returns:
            Processing statistics with profiles, metadata, trajectory
        """
        float_dir = self.cache_path / self.dac / float_id
        if not float_dir.exists():
            logger.warning("Float directory not found", float_id=float_id)
            return {"float_id": float_id, "error": "Directory not found"}

        stats: dict[str, Any] = {
            "float_id": float_id,
            "profiles_parsed": 0,
            "files_processed": 0,
            "errors": 0,
            "profiles": [],
            "metadata": None,
            "trajectory": None,
        }

        # Process all aggregate files
        self._process_aggregate_files(float_dir, float_id, stats)

        if not stats["profiles"]:
            logger.error(
                "No profiles found - aggregate _prof.nc file required",
                float_id=float_id,
            )
            stats["error"] = "Aggregate _prof.nc file not found or empty"

        return stats

    def _process_aggregate_files(
        self, float_dir: Path, float_id: str, stats: dict[str, Any]
    ) -> None:
        """Process aggregate files (meta, prof, tech, Rtraj).

        PERFORMANCE: The _prof.nc aggregate file contains ALL profiles for the float
        in vectorized format. This is ~500x faster than individual file processing.

        Args:
            float_dir: Float directory path
            float_id: Float ID
            stats: Statistics dict to update
        """
        import time

        # 1. Metadata file - float deployment info
        meta_file = float_dir / f"{float_id}_meta.nc"
        if meta_file.exists():
            try:
                stats["metadata"] = parse_metadata_file(meta_file)
                stats["files_processed"] += 1
                logger.info("Metadata file processed", float_id=float_id)
            except Exception as e:
                logger.warning("Error processing metadata", error=str(e))
                stats["errors"] += 1

        # 2. Profile aggregate file - ALL profiles in one file (FAST PATH)
        prof_file = float_dir / f"{float_id}_prof.nc"
        if prof_file.exists():
            try:
                start = time.time()
                profiles = parse_aggregate_profiles(prof_file)
                elapsed = time.time() - start

                if profiles:
                    stats["profiles"] = profiles
                    stats["profiles_parsed"] = len(profiles)
                    stats["files_processed"] += 1
                    logger.info(
                        "Aggregate profiles parsed",
                        float_id=float_id,
                        profiles=len(profiles),
                        elapsed_seconds=round(elapsed, 3),
                    )
            except Exception as e:
                logger.error("Error processing aggregate profiles", error=str(e))
                stats["errors"] += 1
        else:
            logger.error("Aggregate _prof.nc file not found", float_id=float_id)
            stats["errors"] += 1

        # 3. Trajectory file - float movement history
        traj_file = float_dir / f"{float_id}_Rtraj.nc"
        if traj_file.exists():
            try:
                stats["trajectory"] = parse_trajectory_file(traj_file)
                stats["files_processed"] += 1
                logger.info("Trajectory file processed", float_id=float_id)
            except Exception as e:
                logger.warning("Error processing trajectory", error=str(e))
                stats["errors"] += 1

        # 4. Technical file - sensor calibration data
        tech_file = float_dir / f"{float_id}_tech.nc"
        if tech_file.exists():
            try:
                tech_data = parse_tech_file(tech_file)
                if tech_data and stats["metadata"]:
                    stats["metadata"]["technical_data"] = tech_data
                stats["files_processed"] += 1
                logger.info("Technical file processed", float_id=float_id)
            except Exception as e:
                logger.warning("Error processing technical file", error=str(e))
                stats["errors"] += 1

    @property
    def dac(self) -> str:
        """Get Data Assembly Center name."""
        return settings.ARGO_DAC
