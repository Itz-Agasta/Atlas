"""Profile parsing utilities for NetCDF files.
Converts raw NetCDF profile data into structured ProfileData objects.

DATA VALIDATION RULES:
======================
- Measurements with ALL sensors null are skipped (invalid depth level)
- Fill values (99999, NaN) are converted to None
- Profiles without valid coordinates are skipped
- Quality status derived from filename prefix (D=Delayed, R=Real-time)

PERFORMANCE NOTE:
================
This module parses INDIVIDUAL profile files. For bulk processing,
consider using the aggregate _prof.nc file which contains all profiles
in a single vectorized dataset (see netcdf_aggregate_parser.py).
"""

from datetime import UTC, datetime
from pathlib import Path
from typing import Optional

import xarray as xr

from ...models import MeasurementProfile, ProfileData
from ...utils import get_logger
from .netcdf_extractors import (
    extract_coordinates,
    extract_cycle_number,
    extract_measurement_value,
    extract_pressure_value,
    extract_profile_time,
    get_float_id,
    get_quality_status,
)

logger = get_logger(__name__)


def parse_measurements(ds: xr.Dataset, prof_idx: int) -> list[MeasurementProfile]:
    """Extract measurements from a profile at all depth levels.

    NOTE: This function loops through N_LEVELS (typically ~275 levels per profile).
    For vectorized processing of multiple profiles, use Arrow-based approach.
    """
    """Extract measurements from a profile.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index

    Returns:
        List of MeasurementProfile objects
    """
    measurements: list[MeasurementProfile] = []
    n_levels = ds.sizes.get("N_LEVELS", 0)

    for level_idx in range(n_levels):
        depth = extract_pressure_value(ds, prof_idx, level_idx, n_levels)

        measurement = MeasurementProfile(
            depth=depth,
            temperature=extract_measurement_value(ds, "TEMP", prof_idx, level_idx),
            salinity=extract_measurement_value(ds, "PSAL", prof_idx, level_idx),
            oxygen=extract_measurement_value(ds, "DOXY", prof_idx, level_idx),
            chlorophyll=extract_measurement_value(ds, "CHLA", prof_idx, level_idx),
        )

        # Skip level if all sensor readings are missing/NaN
        if all(
            val is None
            for val in [
                measurement.temperature,
                measurement.salinity,
                measurement.oxygen,
                measurement.chlorophyll,
            ]
        ):
            continue

        measurements.append(measurement)

    return measurements


def parse_single_profile(
    ds: xr.Dataset, prof_idx: int, file_path: Path
) -> Optional[ProfileData]:
    """Parse single profile from dataset.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index
        file_path: Source file path

    Returns:
        ProfileData object or None if parsing failed
    """
    float_id = get_float_id(ds, file_path)

    # Extract profile time
    profile_time = extract_profile_time(ds, prof_idx)

    # Extract coordinates
    latitude, longitude = extract_coordinates(ds, prof_idx)

    if latitude is None or longitude is None:
        logger.warning(
            "Missing coordinates for profile",
            float_id=float_id,
            cycle=prof_idx,
        )
        return None

    # Get cycle number
    cycle_number = extract_cycle_number(ds, prof_idx)

    # Extract measurements at different depths
    measurements = parse_measurements(ds, prof_idx)

    if not measurements:
        logger.warning(
            "No valid measurements found for profile",
            float_id=float_id,
            cycle=cycle_number,
        )
        return None

    # Determine quality status
    quality_status = get_quality_status(file_path)

    # Create profile data
    profile = ProfileData(
        float_id=float_id,
        cycle_number=cycle_number,
        profile_time=profile_time,
        latitude=latitude,
        longitude=longitude,
        measurements=measurements,
        max_depth=max((m.depth for m in measurements), default=None),
        quality_status=quality_status,
        metadata={
            "source_file": file_path.name,
            "dac": "incois",
            "processed_at": datetime.now(UTC).isoformat(),
        },
    )

    return profile
