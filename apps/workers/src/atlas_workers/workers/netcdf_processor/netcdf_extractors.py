"""Low-level utilities for extracting specific data fields from NetCDF files.

ARGO DATA FORMAT NOTES:
=======================
- JULD: Julian Day Number since 1950-01-01 (converted to datetime64 by xarray)
- Coordinates: WGS84 latitude/longitude in decimal degrees
- Pressure: dbar (decibar) - approximately equals depth in meters
- Temperature: Celsius (ITS-90 scale)
- Salinity: PSU (Practical Salinity Units)
- Fill values: 99999 or NaN indicate missing data

QUALITY FLAGS:
- 'D' prefix in filename = Delayed mode (quality controlled)
- 'R' prefix = Real-time (preliminary data)

See ARGO documentation: https://archimer.ifremer.fr/doc/00187/29825/
"""

from datetime import UTC, datetime
from typing import Any, Optional

import numpy as np
import xarray as xr

from ...utils import get_logger

logger = get_logger(__name__)


def extract_profile_time(ds: xr.Dataset, prof_idx: int) -> datetime:
    """Extract profile time from dataset.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index

    Returns:
        Profile datetime in UTC
    """
    try:
        # Handle different time formats
        time_val: Optional[np.datetime64] = None
        if "TIME" in ds.variables:
            time_val = ds["TIME"].values[prof_idx]
        elif "PROFILE_TIME" in ds.variables:
            time_val = ds["PROFILE_TIME"].values[prof_idx]

        if time_val is not None:
            # Convert numpy datetime64 to Python datetime
            if isinstance(time_val, np.datetime64):
                ts = (time_val - np.datetime64("1970-01-01T00:00:00")) / np.timedelta64(
                    1, "s"
                )
                return datetime.fromtimestamp(float(ts), tz=UTC)
        return datetime.now(UTC)
    except Exception as e:
        logger.warning("Error extracting profile time", error=str(e))
        return datetime.now(UTC)


def extract_coordinates(
    ds: xr.Dataset, prof_idx: int
) -> tuple[Optional[float], Optional[float]]:
    """Extract latitude and longitude from dataset.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index

    Returns:
        Tuple of (latitude, longitude)
    """
    latitude = None
    longitude = None

    if "LATITUDE" in ds:
        try:
            latitude = float(ds["LATITUDE"].values[prof_idx])
        except (IndexError, TypeError, ValueError):
            pass

    if "LONGITUDE" in ds:
        try:
            longitude = float(ds["LONGITUDE"].values[prof_idx])
        except (IndexError, TypeError, ValueError):
            pass

    return latitude, longitude


def extract_cycle_number(ds: xr.Dataset, prof_idx: int) -> int:
    """Extract cycle number from dataset.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index

    Returns:
        Cycle number (1-based)
    """
    if "CYCLE_NUMBER" in ds.variables:
        try:
            return int(ds["CYCLE_NUMBER"].values[prof_idx])
        except (IndexError, TypeError, ValueError):
            pass
    return prof_idx + 1


def extract_measurement_value(
    ds: xr.Dataset, var_name: str, prof_idx: int, level_idx: int
) -> Optional[float]:
    """Safely extract measurement value from dataset.

    Args:
        ds: xarray Dataset
        var_name: Variable name to extract
        prof_idx: Profile index
        level_idx: Level index

    Returns:
        Measurement value or None if invalid
    """
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


def extract_pressure_value(
    ds: xr.Dataset, prof_idx: int, level_idx: int, n_levels: int
) -> float:
    """Extract pressure/depth value from dataset.

    Args:
        ds: xarray Dataset
        prof_idx: Profile index
        level_idx: Level index
        n_levels: Total number of levels

    Returns:
        Pressure value in dbar
    """
    if "PRES" in ds:
        try:
            pres_val = ds["PRES"].values[prof_idx][level_idx]
            if not np.isnan(pres_val) and pres_val < 99999:
                return float(pres_val)
        except (IndexError, TypeError):
            pass

    # Fallback depth calculation
    return float(level_idx * 100)


def get_float_id(ds: xr.Dataset, file_path: Any) -> str:
    """Extract float ID from dataset attributes or filename.

    Args:
        ds: xarray Dataset
        file_path: Path to file

    Returns:
        Float ID string
    """
    float_id = ds.attrs.get("title", "").split()[-1]
    if float_id and float_id.isdigit():
        return float_id

    # Fallback to filename parsing
    try:
        # Extract filename from path and parse float ID
        # Expected format: D2902226_001.nc or 2902226_prof.nc
        from pathlib import Path

        filename = Path(file_path).name
        # Remove prefix letter if present (e.g., D2902226 -> 2902226)
        parts = filename.split("_")[0]
        # Strip non-digits from start
        float_id_str = "".join(c for c in parts if c.isdigit())
        if float_id_str:
            return float_id_str
        return "unknown"
    except (IndexError, AttributeError):
        return "unknown"


def get_quality_status(file_path: Any) -> str:
    """Determine quality status from filename.

    Args:
        file_path: Path to file

    Returns:
        Quality status ('REAL_TIME' or 'DELAYED')
    """
    file_name = str(file_path)
    return "DELAYED" if "D" in file_name else "REAL_TIME"
