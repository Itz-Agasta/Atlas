from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xarray as xr

from ... import get_logger

logger = get_logger(__name__)


def extract_profile_arrays(
    ds: xr.Dataset, prof_idx: int, profile: dict[str, Any]
) -> bool:
    """Extract vertical profile arrays (pressure, temperature, salinity, oxygen).

    Args:
        ds: xarray Dataset
        prof_idx: Profile index
        profile: Profile dict to populate

    Returns:
        True if at least one valid array was extracted
    """
    arrays_found = False

    if "PRES" in ds:
        pres = ds["PRES"].values[prof_idx]
        valid_pres = pres[~np.isnan(pres) & (pres < 99999)]
        if len(valid_pres) > 0:
            profile["pressure"] = valid_pres.tolist()
            profile["last_depth"] = float(valid_pres.max())
            arrays_found = True

    if "TEMP" in ds and arrays_found:
        temp = ds["TEMP"].values[prof_idx]
        valid_temp = temp[~np.isnan(temp) & (temp < 99999)]
        if len(valid_temp) > 0:
            profile["temperature"] = valid_temp.tolist()

    if "PSAL" in ds and arrays_found:
        psal = ds["PSAL"].values[prof_idx]
        valid_psal = psal[~np.isnan(psal) & (psal < 99999)]
        if len(valid_psal) > 0:
            profile["salinity"] = valid_psal.tolist()

    if "DOXY" in ds and arrays_found:
        doxy = ds["DOXY"].values[prof_idx]
        valid_doxy = doxy[~np.isnan(doxy) & (doxy < 99999)]
        if len(valid_doxy) > 0:
            profile["oxygen"] = valid_doxy.tolist()

    return arrays_found


def extract_profiles_dataframe(prof_file: Path, float_id: str) -> pd.DataFrame | None:
    """Extract profiles from NetCDF to DataFrame.

    Args:
        prof_file: Path to {float_id}_prof.nc
        float_id: Float ID for reference

    Returns:
        DataFrame with profile data, or None if extraction fails
    """
    try:
        with xr.open_dataset(prof_file) as ds:
            n_prof = ds.sizes.get("N_PROF", 0)
            n_levels = ds.sizes.get("N_LEVELS", 0)

            if n_prof == 0 or n_levels == 0:
                logger.warning(
                    "Invalid profile dimensions",
                    float_id=float_id,
                    n_prof=n_prof,
                    n_levels=n_levels,
                )
                return None

            profiles = []

            for prof_idx in range(n_prof):
                profile: dict[str, Any] = {
                    "float_id": float_id,
                    "profile_idx": prof_idx,
                }

                if "CYCLE_NUMBER" in ds:
                    cycle = ds["CYCLE_NUMBER"].values[prof_idx]
                    if not np.isnan(cycle):
                        profile["cycle_number"] = int(cycle)

                if "JULD" in ds:
                    try:
                        time_val = ds["JULD"].values[prof_idx]
                        if isinstance(time_val, np.datetime64) and not np.isnat(
                            time_val
                        ):
                            ts = (
                                time_val - np.datetime64("1970-01-01T00:00:00")
                            ) / np.timedelta64(1, "s")
                            profile["profile_time"] = float(ts)
                    except (ValueError, TypeError, OverflowError):
                        pass

                if "LATITUDE" in ds:
                    lat = float(ds["LATITUDE"].values[prof_idx])
                    if not np.isnan(lat):
                        profile["latitude"] = lat

                if "LONGITUDE" in ds:
                    lon = float(ds["LONGITUDE"].values[prof_idx])
                    if not np.isnan(lon):
                        profile["longitude"] = lon

                if "POSITION_QC" in ds:
                    qc = ds["POSITION_QC"].values[prof_idx]
                    if isinstance(qc, bytes):
                        profile["position_qc"] = qc.decode().strip()
                    else:
                        profile["position_qc"] = str(qc)

                if extract_profile_arrays(ds, prof_idx, profile):
                    profiles.append(profile)

            if not profiles:
                logger.warning("No profiles with valid data", float_id=float_id)
                return None

            df = pd.DataFrame(profiles)
            logger.debug(
                "Extracted profiles to DataFrame",
                float_id=float_id,
                rows=len(df),
            )
            return df

    except Exception as e:
        logger.error("DataFrame extraction failed", float_id=float_id, error=str(e))
        return None


def save_parquet(df: pd.DataFrame, output_path: Path, float_id: str) -> None:
    """Save DataFrame to Parquet with Snappy compression.

    Args:
        df: DataFrame to save
        output_path: Output Parquet file path
        float_id: Float ID for logging
    """
    try:
        df.to_parquet(
            output_path,
            engine="pyarrow",
            compression="snappy",
            index=False,
        )
        logger.info(
            "Parquet file saved",
            float_id=float_id,
            path=str(output_path),
            rows=len(df),
            size_mb=round(output_path.stat().st_size / 1024 / 1024, 2),
        )
    except Exception as e:
        logger.error(
            "Parquet save failed",
            float_id=float_id,
            path=str(output_path),
            error=str(e),
        )
        raise
