"""NetCDF Parser Worker for converting ARGO data to Arrow format."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Optional

import numpy as np
import xarray as xr

from ..config import settings
from ..models import MeasurementProfile, ProfileData
from ..utils import get_logger

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

    def _safe_get(self, obj: Any, keys: str, default: Any = None) -> Any:
        """Safely get nested value from object."""
        try:
            for key in keys.split("."):
                if isinstance(obj, dict):
                    obj = obj.get(key, default)
                else:
                    obj = getattr(obj, key, default)
                if obj is None:
                    return default
            return obj
        except (AttributeError, KeyError, TypeError):
            return default

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
            ds = xr.open_dataset(file_path)
            profiles = []

            # Get dimensions
            n_prof = ds.dims.get("N_PROF", 0)
            if n_prof == 0:
                logger.warning("No profiles found in file", file=str(file_path))
                return profiles

            # Extract float ID from filename or attributes
            float_id = ds.attrs.get("title", "").split()[-1]
            if not float_id or not float_id.isdigit():
                float_id = file_path.stem.split("_")[0]

            logger.info("Found profiles", float_id=float_id, count=n_prof)

            # Process each profile
            for prof_idx in range(n_prof):
                try:
                    profile = self._parse_single_profile(
                        ds, prof_idx, float_id, file_path
                    )
                    if profile:
                        profiles.append(profile)
                except Exception as e:
                    logger.warning(
                        "Error parsing profile cycle",
                        float_id=float_id,
                        cycle=prof_idx,
                        error=str(e),
                    )
                    continue

            ds.close()
            logger.info(
                "File parsed successfully", file=str(file_path), profiles=len(profiles)
            )
            return profiles

        except Exception as e:
            logger.error(
                "Failed to parse NetCDF file", file=str(file_path), error=str(e)
            )
            return None

    def _parse_single_profile(
        self, ds: xr.Dataset, prof_idx: int, float_id: str, file_path: Path
    ) -> Optional[ProfileData]:
        """Parse single profile from dataset."""

        # Extract profile time
        try:
            # Handle different time formats
            if "TIME" in ds.variables:
                time_val = ds["TIME"].values[prof_idx]
            elif "PROFILE_TIME" in ds.variables:
                time_val = ds["PROFILE_TIME"].values[prof_idx]
            else:
                time_val = None

            if time_val is not None:
                # Convert numpy datetime64 to Python datetime
                if isinstance(time_val, np.datetime64):
                    ts = (
                        time_val - np.datetime64("1970-01-01T00:00:00")
                    ) / np.timedelta64(1, "s")
                    profile_time = datetime.fromtimestamp(float(ts), tz=UTC)
                else:
                    profile_time = datetime.now(UTC)
            else:
                profile_time = datetime.now(UTC)
        except Exception as e:
            logger.warning("Error extracting profile time", error=str(e))
            profile_time = datetime.now(UTC)

        # Extract location
        latitude = (
            self._safe_get(ds["LATITUDE"], "values", [0])[prof_idx]
            if "LATITUDE" in ds
            else None
        )
        longitude = (
            self._safe_get(ds["LONGITUDE"], "values", [0])[prof_idx]
            if "LONGITUDE" in ds
            else None
        )

        if latitude is None or longitude is None:
            logger.warning(
                "Missing coordinates for profile", float_id=float_id, cycle=prof_idx
            )
            return None

        # Get cycle number
        cycle_number = prof_idx + 1
        if "CYCLE_NUMBER" in ds.variables:
            cycle_number = int(ds["CYCLE_NUMBER"].values[prof_idx])

        # Extract measurements at different depths
        measurements = []
        n_levels = ds.dims.get("N_LEVELS", 0)

        for level_idx in range(n_levels):
            measurement = MeasurementProfile(
                depth=float(
                    self._safe_get(ds["PRES"], "values", [[]])[prof_idx][level_idx]
                    if "PRES" in ds
                    else level_idx * 100
                ),
                temperature=self._get_measurement_value(
                    ds, "TEMP", prof_idx, level_idx
                ),
                salinity=self._get_measurement_value(ds, "PSAL", prof_idx, level_idx),
                oxygen=self._get_measurement_value(ds, "DOXY", prof_idx, level_idx),
                chlorophyll=self._get_measurement_value(
                    ds, "CHLA", prof_idx, level_idx
                ),
            )
            measurements.append(measurement)

        # Determine quality status
        quality_status = "REAL_TIME"
        if "D" in file_path.stem:  # Delayed mode files start with 'D'
            quality_status = "DELAYED"

        # Create profile data
        profile = ProfileData(
            float_id=float_id,
            cycle_number=cycle_number,
            profile_time=profile_time,
            latitude=float(latitude),
            longitude=float(longitude),
            measurements=measurements,
            max_depth=float(max([m.depth for m in measurements], default=0)),
            quality_status=quality_status,
            metadata={
                "source_file": file_path.name,
                "dac": "incois",
                "processed_at": datetime.now(UTC).isoformat(),
            },
        )

        return profile

    def _get_measurement_value(
        self, ds: xr.Dataset, var_name: str, prof_idx: int, level_idx: int
    ) -> Optional[float]:
        """Safely extract measurement value from dataset."""
        try:
            if var_name not in ds.variables:
                return None

            val = ds[var_name].values[prof_idx][level_idx]

            # Handle masked/fill values
            if np.isnan(val) or val >= 99999:
                return None

            return float(val)
        except (IndexError, TypeError, ValueError):
            return None

    def process_directory(self, float_id: str) -> dict:
        """Process all NetCDF files for a float.

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
        }

        # Find profile files
        profile_dir = float_dir / "profiles"
        if profile_dir.exists():
            nc_files = list(profile_dir.glob("*.nc"))
        else:
            nc_files = list(float_dir.glob("*.nc"))

        logger.info(
            "Processing float directory", float_id=float_id, files=len(nc_files)
        )

        for nc_file in nc_files:
            try:
                profiles = self.parse_profile_file(nc_file)
                if profiles:
                    stats["profiles_parsed"] += len(profiles)
                    stats["files_processed"] += 1

                    # Store profile data (can be sent to DB later)
                    for profile in profiles:
                        stats["profiles"].append(profile.model_dump())
                else:
                    stats["errors"] += 1
            except Exception as e:
                logger.error("Error processing file", file=str(nc_file), error=str(e))
                stats["errors"] += 1

        logger.info("Directory processing complete", stats=stats)
        return stats

    def export_to_json(self, profiles: list[ProfileData], output_path: Path) -> bool:
        """Export profiles to JSON format.

        Args:
            profiles: List of ProfileData objects
            output_path: Output file path

        Returns:
            True if successful
        """
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)

            data = [p.model_dump() for p in profiles]
            with open(output_path, "w") as f:
                json.dump(data, f, indent=2, default=str)

            logger.info(
                "Profiles exported to JSON", path=str(output_path), count=len(profiles)
            )
            return True
        except Exception as e:
            logger.error("Export failed", error=str(e))
            return False

    def export_to_arrow(self, profiles: list[ProfileData], output_path: Path) -> bool:
        """Export profiles to Arrow format.

        Args:
            profiles: List of ProfileData objects
            output_path: Output file path

        Returns:
            True if successful
        """
        try:
            import pyarrow as pa

            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Create Arrow table
            data = {
                "float_id": [p.float_id for p in profiles],
                "cycle_number": [p.cycle_number for p in profiles],
                "profile_time": [p.profile_time for p in profiles],
                "latitude": [p.latitude for p in profiles],
                "longitude": [p.longitude for p in profiles],
                "max_depth": [p.max_depth for p in profiles],
                "quality_status": [p.quality_status for p in profiles],
                "measurement_count": [len(p.measurements) for p in profiles],
            }

            table = pa.table(data)

            # Write with Parquet format (compressed columnar)
            import pyarrow.parquet as pq

            pq.write_table(
                table,
                output_path,
                compression=settings.ARROW_COMPRESSION,
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
            logger.error("Arrow export failed", error=str(e))
            return False

    @property
    def dac(self) -> str:
        """Get DAC name."""
        return settings.ARGO_DAC


async def main() -> None:
    """Example usage of NetCDF Parser Worker."""
    from ..utils import setup_logging

    setup_logging()

    worker = NetCDFParserWorker()

    # Example: process a float directory
    float_id = "2902224"
    result = worker.process_directory(float_id)

    print(f"\nParsing Result:\n{json.dumps(result, indent=2, default=str)}")

    # Export sample profiles
    if result.get("profiles"):
        profiles = [
            ProfileData(**p)
            for p in result["profiles"][: settings.PROFILE_BATCH_LIMIT or 5]
        ]
        worker.export_to_json(profiles, Path("/tmp/sample_profiles.json"))
        worker.export_to_arrow(profiles, Path("/tmp/sample_profiles.parquet"))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
