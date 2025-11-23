"""NetCDF Parser Worker for converting ARGO data to Json & Arrow format.
Central coordinator that manages the entire conversion workflow
"""

from pathlib import Path
from typing import Any, Optional

import xarray as xr

from ...config import settings
from ...models import ProfileData
from ...utils import get_logger
from .netcdf_aggregate_parser import (
    parse_metadata_file,
    parse_tech_file,
    parse_trajectory_file,
)
from .netcdf_exporters import export_to_arrow, export_to_json
from .netcdf_profile_parser import parse_single_profile

logger = get_logger(__name__)


class NetCDFParserWorker:
    """Parse NetCDF ARGO files and convert to Arrow-ready format."""

    def __init__(
        self,
        cache_path: Optional[Path] = None,
        output_arrow: bool = settings.OUTPUT_ARROW_FORMAT,
    ):
        """Initialize NetCDF parser worker.

        Args:
            cache_path: Path to cached ARGO files
            output_arrow: Whether to output Arrow format
        """
        self.cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)
        self.output_arrow = output_arrow

    def parse_profile_file(self, file_path: Path) -> Optional[list[ProfileData]]:
        """Parse ARGO profile NetCDF file.

        Args:
            file_path: Path to NetCDF file

        Returns:
            List of ProfileData objects, or None on error
        """
        if not file_path.exists():
            logger.warning("File not found", file=str(file_path))
            return None

        try:
            logger.info("Parsing NetCDF file", file=str(file_path))

            # Open NetCDF file
            with xr.open_dataset(file_path) as ds:
                profiles = []

                # Get dimensions
                n_prof = ds.sizes.get("N_PROF", 0)
                if n_prof == 0:
                    logger.warning("No profiles found in file", file=str(file_path))
                    return profiles

                logger.info("Found profiles", count=n_prof)

                # Process each profile
                for prof_idx in range(n_prof):
                    try:
                        profile = parse_single_profile(ds, prof_idx, file_path)
                        if profile:
                            profiles.append(profile)
                    except Exception as e:
                        logger.warning(
                            "Error parsing profile cycle",
                            cycle=prof_idx,
                            error=str(e),
                        )
                        continue

                logger.info(
                    "File parsed successfully",
                    file=str(file_path),
                    profiles=len(profiles),
                )
                return profiles

        except Exception as e:
            logger.exception(
                "Failed to parse NetCDF file", file=str(file_path), error=str(e)
            )
            return None

    def process_directory(self, float_id: str) -> dict[str, Any]:
        """Process all NetCDF files for a float (profiles and aggregates).
         (main entry point)

        Args:
            float_id: Float ID to process

        Returns:
            Processing statistics
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

        # Process aggregate files first (meta, tech, prof, Rtraj)
        self._process_aggregate_files(float_dir, float_id, stats)

        # Find and process profile files
        profile_dir = float_dir / "profiles"
        if profile_dir.exists():
            nc_files = list(profile_dir.glob("*.nc"))
        else:
            nc_files = [f for f in float_dir.glob("*.nc") if "profiles" not in str(f)]

        logger.info(
            "Processing float directory", float_id=float_id, files=len(nc_files)
        )

        for nc_file in nc_files:
            # Skip aggregate files (already processed)
            if any(
                name in nc_file.name
                for name in ["_meta.nc", "_tech.nc", "_prof.nc", "_Rtraj.nc"]
            ):
                continue

            try:
                profiles = self.parse_profile_file(nc_file)
                if profiles:
                    stats["profiles_parsed"] += len(profiles)
                    stats["files_processed"] += 1

                    # Store profile data
                    for profile in profiles:
                        stats["profiles"].append(profile.model_dump())
                else:
                    stats["errors"] += 1
            except Exception as e:
                logger.exception(
                    "Error processing file", file=str(nc_file), error=str(e)
                )
                stats["errors"] += 1

        logger.info("Directory processing complete", stats=stats)
        return stats

    def _process_aggregate_files(
        self, float_dir: Path, float_id: str, stats: dict[str, Any]
    ) -> None:
        """Process aggregate files (meta, tech, prof, Rtraj).

        Args:
            float_dir: Float directory path
            float_id: Float ID
            stats: Statistics dict to update
        """
        # Process metadata file
        meta_file = float_dir / f"{float_id}_meta.nc"
        if meta_file.exists():
            try:
                metadata = parse_metadata_file(meta_file)
                stats["metadata"] = metadata
                stats["files_processed"] += 1
                logger.info("Metadata file processed", float_id=float_id)
            except Exception as e:
                logger.warning(
                    "Error processing metadata file",
                    float_id=float_id,
                    error=str(e),
                )
                stats["errors"] += 1

        # Process trajectory file
        traj_file = float_dir / f"{float_id}_Rtraj.nc"
        if traj_file.exists():
            try:
                trajectory = parse_trajectory_file(traj_file)
                stats["trajectory"] = trajectory
                stats["files_processed"] += 1
                logger.info("Trajectory file processed", float_id=float_id)
            except Exception as e:
                logger.warning(
                    "Error processing trajectory file",
                    float_id=float_id,
                    error=str(e),
                )
                stats["errors"] += 1

        # Process tech file (technical parameters)
        tech_file = float_dir / f"{float_id}_tech.nc"
        if tech_file.exists():
            try:
                tech_data = parse_tech_file(tech_file)
                if tech_data:
                    if stats["metadata"]:
                        stats["metadata"]["technical_data"] = tech_data
                    stats["files_processed"] += 1
                logger.info("Technical file processed", float_id=float_id)
            except Exception as e:
                logger.warning(
                    "Error processing technical file",
                    float_id=float_id,
                    error=str(e),
                )
                stats["errors"] += 1

    def export_to_json(self, profiles: list[ProfileData], output_path: Path) -> bool:
        """Export profiles to JSON format.

        Args:
            profiles: List of ProfileData objects
            output_path: Output file path

        Returns:
            True if successful
        """
        return export_to_json(profiles, output_path)

    def export_to_arrow(self, profiles: list[ProfileData], output_path: Path) -> bool:
        """Export profiles to Arrow format.

        Args:
            profiles: List of ProfileData objects
            output_path: Output file path

        Returns:
            True if successful
        """
        return export_to_arrow(
            profiles, output_path, compression=settings.ARROW_COMPRESSION
        )

    @property
    def dac(self) -> str:
        """Get DAC name."""
        return settings.ARGO_DAC
