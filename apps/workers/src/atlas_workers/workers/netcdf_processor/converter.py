from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import xarray as xr

from ... import get_logger, settings

logger = get_logger(__name__)


class ParquetConverter:
    """Convert ARGO NetCDF profiles to Parquet (denormalized long format)."""

    def __init__(self, staging_path: Path | None = None):
        self.staging_path = Path(staging_path or settings.PARQUET_STAGING_PATH)
        self.staging_path.mkdir(parents=True, exist_ok=True)

    def convert(self, prof_file: Path, float_id: str) -> str | None:
        """Convert prof.nc to Parquet file.

        Returns:
            Path to generated Parquet file, or None on failure
        """
        if not prof_file.exists():
            logger.warning("Profile file not found", float_id=float_id)
            return None

        try:
            with xr.open_dataset(prof_file) as ds:
                n_prof = ds.sizes.get("N_PROF", 0)
                n_levels = ds.sizes.get("N_LEVELS", 0)

                if n_prof == 0 or n_levels == 0:
                    logger.warning("Empty dataset", float_id=float_id)
                    return None

                rows = []

                # Extract required arrays
                float_ids = ds["PLATFORM_NUMBER"].values
                cycles = ds["CYCLE_NUMBER"].values
                juldays = ds["JULD"].values
                lats = ds["LATITUDE"].values
                lons = ds["LONGITUDE"].values

                # Optional 2D arrays - safely extract
                def get_2d_array(var_name: str) -> np.ndarray | None:
                    arr = ds.get(var_name)
                    if arr is not None and arr.shape == (n_prof, n_levels):
                        return arr.values
                    return None

                def get_1d_array(var_name: str) -> np.ndarray | None:
                    arr = ds.get(var_name)
                    if (
                        arr is not None
                        and len(arr.shape) == 1
                        and arr.shape[0] == n_prof
                    ):
                        return arr.values
                    return None

                # 2D measurement arrays
                pressures = get_2d_array("PRES")
                pres_qc = get_2d_array("PRES_QC")
                temps = get_2d_array("TEMP")
                temp_qc = get_2d_array("TEMP_QC")
                salts = get_2d_array("PSAL")
                salt_qc = get_2d_array("PSAL_QC")

                # Adjusted values (2D)
                pres_adj = get_2d_array("PRES_ADJUSTED")
                temp_adj = get_2d_array("TEMP_ADJUSTED")
                salt_adj = get_2d_array("PSAL_ADJUSTED")
                temp_adj_qc = get_2d_array("TEMP_ADJUSTED_QC")
                salt_adj_qc = get_2d_array("PSAL_ADJUSTED_QC")

                # 1D per-profile arrays
                data_mode = get_1d_array("DATA_MODE")
                pos_qc = get_1d_array("POSITION_QC")

                # BGC sensors (often sparse, 2D)
                oxygen = get_2d_array("OXYGEN")
                oxygen_qc = get_2d_array("OXYGEN_QC")
                chlorophyll = get_2d_array("CHLOROPHYLL")
                chlorophyll_qc = get_2d_array("CHLOROPHYLL_QC")
                nitrate = get_2d_array("NITRATE")
                nitrate_qc = get_2d_array("NITRATE_QC")

                # Helper to safely extract value
                def get_value(arr: np.ndarray | None, i: int, j: int):
                    if arr is None:
                        return None
                    try:
                        val = arr[i, j]
                        if isinstance(val, (bytes, np.bytes_)):
                            return val.decode("utf-8", errors="ignore").strip()
                        if isinstance(val, (np.floating, float)):
                            return None if np.isnan(val) else float(val)
                        if isinstance(val, (np.integer, int)):
                            return int(val)
                        return val
                    except (IndexError, TypeError, ValueError):
                        return None

                def get_1d_value(arr: np.ndarray | None, i: int):
                    if arr is None:
                        return None
                    try:
                        val = arr[i]
                        if isinstance(val, (bytes, np.bytes_)):
                            return val.decode("utf-8", errors="ignore").strip()
                        if isinstance(val, (np.floating, float)):
                            return None if np.isnan(val) else float(val)
                        if isinstance(val, (np.integer, int)):
                            return int(val)
                        return val
                    except (IndexError, TypeError, ValueError):
                        return None

                # Iterate profiles (outer) -> levels (inner)
                for prof_idx in range(n_prof):
                    raw_float_id = float_ids[prof_idx]
                    if isinstance(raw_float_id, bytes):
                        float_str = raw_float_id.decode(
                            "utf-8", errors="ignore"
                        ).strip()
                    else:
                        float_str = str(raw_float_id).strip()
                    float_int = int(float(float_str)) if float_str else int(float_id)

                    cycle_num = get_1d_value(cycles, prof_idx)
                    lat = get_1d_value(lats, prof_idx)
                    lon = get_1d_value(lons, prof_idx)

                    # Parse profile timestamp
                    profile_timestamp = None
                    try:
                        juld_val = juldays[prof_idx]
                        if not np.isnat(juld_val):
                            ts = (
                                juld_val - np.datetime64("1970-01-01T00:00:00")
                            ) / np.timedelta64(1, "s")
                            profile_timestamp = datetime.fromtimestamp(
                                float(ts), tz=timezone.utc
                            )
                    except Exception:
                        pass

                    year = profile_timestamp.year if profile_timestamp else None
                    month = profile_timestamp.month if profile_timestamp else None

                    mode_char = get_1d_value(data_mode, prof_idx)
                    pos_qc_char = get_1d_value(pos_qc, prof_idx)

                    # Iterate depth levels (one row = one measurement at one depth)
                    for level_idx in range(n_levels):
                        pres_val = get_value(pressures, prof_idx, level_idx)

                        # Skip rows without pressure (invalid levels)
                        if pres_val is None:
                            continue

                        row = {
                            "float_id": float_int,
                            "cycle_number": cycle_num,
                            "level": level_idx,
                            "profile_timestamp": profile_timestamp,
                            "latitude": lat,
                            "longitude": lon,
                            "pressure": pres_val,
                            "temperature": get_value(temps, prof_idx, level_idx),
                            "salinity": get_value(salts, prof_idx, level_idx),
                            "position_qc": pos_qc_char,
                            "pres_qc": get_value(pres_qc, prof_idx, level_idx),
                            "temp_qc": get_value(temp_qc, prof_idx, level_idx),
                            "psal_qc": get_value(salt_qc, prof_idx, level_idx),
                            "temperature_adj": get_value(temp_adj, prof_idx, level_idx),
                            "salinity_adj": get_value(salt_adj, prof_idx, level_idx),
                            "pressure_adj": get_value(pres_adj, prof_idx, level_idx),
                            "temp_adj_qc": get_value(temp_adj_qc, prof_idx, level_idx),
                            "psal_adj_qc": get_value(salt_adj_qc, prof_idx, level_idx),
                            "data_mode": mode_char,
                            "oxygen": get_value(oxygen, prof_idx, level_idx),
                            "oxygen_qc": get_value(oxygen_qc, prof_idx, level_idx),
                            "chlorophyll": get_value(chlorophyll, prof_idx, level_idx),
                            "chlorophyll_qc": get_value(
                                chlorophyll_qc, prof_idx, level_idx
                            ),
                            "nitrate": get_value(nitrate, prof_idx, level_idx),
                            "nitrate_qc": get_value(nitrate_qc, prof_idx, level_idx),
                            "year": year,
                            "month": month,
                        }
                        rows.append(row)

                if not rows:
                    logger.warning("No valid measurements extracted", float_id=float_id)
                    return None

                # Build Arrow table from rows - convert list of dicts to columnar format
                columns = {}
                for row in rows:
                    for key, value in row.items():
                        if key not in columns:
                            columns[key] = []
                        columns[key].append(value)

                table = pa.table(columns)

                # Write Parquet file
                output_path = self.staging_path / f"{float_id}_profiles.parquet"
                pq.write_table(
                    table,
                    output_path,
                    compression=settings.PARQUET_COMPRESSION,
                    use_dictionary=["float_id", "cycle_number", "data_mode"],
                )

                return str(output_path)

        except Exception as e:
            logger.exception(
                "Parquet conversion failed", float_id=float_id, error=str(e)
            )
            return None
