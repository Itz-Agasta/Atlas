from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
import xarray as xr

from ... import FloatMetadata, get_logger
from ...utils.helper import helper

# Note: Any is kept for internal dict typing

logger = get_logger(__name__)
helper_instance = helper.helper()


def extract_string(ds, var_name: str) -> Optional[str]:
    """Extract and clean string from xarray dataset."""
    if var_name not in ds.variables:
        return None
    val = ds[var_name].values
    if isinstance(val, np.ndarray):
        val = val.item()
    if isinstance(val, bytes):
        return val.decode("utf-8").strip()
    if isinstance(val, str):
        return val.strip()
    return str(val) if val else None


def parse_date(ds, var_name: str) -> Optional[datetime]:
    """Parse date from xarray dataset."""
    date_str = extract_string(ds, var_name)
    if not date_str or date_str.isspace():
        return None
    try:
        if len(date_str) >= 14:
            return datetime.strptime(date_str[:14], "%Y%m%d%H%M%S").replace(
                tzinfo=timezone.utc
            )
        elif len(date_str) >= 8:
            return datetime.strptime(date_str[:8], "%Y%m%d").replace(
                tzinfo=timezone.utc
            )
    except (ValueError, AttributeError):
        return None


def parse_metadata_file(
    file_path: Path, recent_profile_time: Optional[datetime] = None
) -> Optional[FloatMetadata]:
    """Parse {float_id}_meta.nc - returns FloatMetadata model instance."""
    try:
        with xr.open_dataset(file_path) as ds:
            # Extract launch location
            launch_lat = None
            launch_lon = None
            try:
                lat = float(ds["LAUNCH_LATITUDE"].values)
                if not np.isnan(lat):
                    launch_lat = lat
            except Exception:
                pass
            try:
                lon = float(ds["LAUNCH_LONGITUDE"].values)
                if not np.isnan(lon):
                    launch_lon = lon
            except Exception:
                pass

            # Build validated metadata using Pydantic model
            metadata = FloatMetadata(
                float_id=int(extract_string(ds, "PLATFORM_NUMBER") or 0),
                wmo_number=extract_string(ds, "PLATFORM_NUMBER") or "",
                data_centre=extract_string(ds, "DATA_CENTRE") or "",
                project_name=extract_string(ds, "PROJECT_NAME"),
                operating_institution=extract_string(ds, "OPERATING_INSTITUTION"),
                pi_name=extract_string(ds, "PI_NAME"),
                platform_type=extract_string(ds, "PLATFORM_TYPE"),
                platform_maker=extract_string(ds, "PLATFORM_MAKER"),
                float_serial_no=extract_string(ds, "FLOAT_SERIAL_NO"),
                launch_date=parse_date(ds, "LAUNCH_DATE"),
                start_mission_date=parse_date(ds, "START_DATE"),
                end_mission_date=parse_date(ds, "END_MISSION_DATE"),
                launch_lat=launch_lat,
                launch_lon=launch_lon,
                float_type=helper_instance.classify_float_type(ds),
                status=helper_instance.determine_float_status(ds, recent_profile_time),
            )

            return metadata

    except Exception as e:
        logger.error("Failed to parse metadata", file=file_path, error=str(e))
        return None


def get_profile_stats(
    file_path: Path, metadata: Optional["FloatMetadata"] = None
) -> Optional[dict[str, Any]]:
    """Extract latest profile + battery health for argo_float_status table."""
    try:
        with xr.open_dataset(file_path) as ds:
            n_prof = ds.sizes.get("N_PROF", 0)
            if n_prof == 0:
                return None

            last_idx = n_prof - 1
            float_id = file_path.stem.replace("_prof", "")

            summary: dict[str, Any] = {"float_id": float_id}

            # Location
            if "LATITUDE" in ds:
                lat = float(ds["LATITUDE"].values[last_idx])
                if not np.isnan(lat):
                    summary["latitude"] = lat
            if "LONGITUDE" in ds:
                lon = float(ds["LONGITUDE"].values[last_idx])
                if not np.isnan(lon):
                    summary["longitude"] = lon

            # Cycle & time
            if "CYCLE_NUMBER" in ds:
                cycle = ds["CYCLE_NUMBER"].values[last_idx]
                if not np.isnan(cycle):
                    summary["cycle_number"] = int(cycle)

            if "JULD" in ds:
                try:
                    juld = ds["JULD"].values[last_idx]
                    if not np.isnat(juld):
                        ts = (
                            juld - np.datetime64("1970-01-01T00:00:00")
                        ) / np.timedelta64(1, "s")
                        summary["profile_time"] = datetime.fromtimestamp(
                            float(ts), tz=timezone.utc
                        )
                except Exception:
                    pass

            # Sensors
            for var, key in [
                ("PRES", "last_depth"),
                ("TEMP", "last_temp"),
                ("PSAL", "last_salinity"),
            ]:
                if var in ds:
                    arr = ds[var].values[last_idx]
                    valid = arr[~np.isnan(arr) & (arr < 99999)]
                    if len(valid) > 0:
                        summary[key] = float(
                            valid.max() if var == "PRES" else valid[-1]
                        )

            # BATTERY ESTIMATION
            if metadata:
                tech_file = file_path.parent / f"{float_id}_tech.nc"
                current_voltage = None

                if tech_file.exists():
                    current_voltage = _extract_latest_battery_voltage(tech_file)

                platform_type = metadata.platform_type or "UNKNOWN"
                cycle_number = summary.get("cycle_number", 0)

                battery_percent = helper_instance.estimate_battery_percent(
                    platform_type=platform_type,
                    cycle_number=cycle_number,
                    current_voltage=current_voltage,
                    metadata=metadata,  # <- contains battery_packs + launch_date
                )

                if battery_percent is not None:
                    summary["battery_percent"] = battery_percent
                    logger.info(
                        "Battery estimated",
                        float_id=float_id,
                        voltage=current_voltage,
                        percent=battery_percent,
                    )

            return summary

    except Exception as e:
        logger.error("Failed to extract profile stats", file=file_path, error=str(e))
        return None


def _extract_latest_battery_voltage(tech_file: Path) -> float | None:
    """Extract only the latest battery voltage from tech.nc"""
    try:
        with xr.open_dataset(tech_file) as ds:
            if (
                "TECHNICAL_PARAMETER_NAME" not in ds
                or "TECHNICAL_PARAMETER_VALUE" not in ds
            ):
                return None

            names = ds["TECHNICAL_PARAMETER_NAME"].values.flatten()
            values = ds["TECHNICAL_PARAMETER_VALUE"].values.flatten()

            target_keywords = [
                "BatteryParkNoLoad",
                "BatteryInitialAtProfileDepth",
                "VOLTAGE_Battery",
                "Battery voltage",
            ]

            latest_voltage = None
            latest_cycle = -1

            cycle_nums = (
                ds["CYCLE_NUMBER"].values.flatten() if "CYCLE_NUMBER" in ds else []
            )

            for i, name_bytes in enumerate(names):
                name = (
                    name_bytes.decode("utf-8", errors="ignore")
                    if isinstance(name_bytes, bytes)
                    else str(name_bytes)
                )
                if any(kw in name for kw in target_keywords):
                    try:
                        val_str = values[i]
                        if isinstance(val_str, bytes):
                            val_str = val_str.decode("utf-8", errors="ignore")
                        voltage = float(val_str)
                        if 5.0 <= voltage <= 35.0:  # Covers Deep Arvor
                            cycle = int(cycle_nums[i]) if i < len(cycle_nums) else 0
                            if cycle >= latest_cycle:
                                latest_voltage = voltage
                                latest_cycle = cycle
                    except Exception:
                        continue

            return latest_voltage

    except Exception as e:
        logger.debug("No battery voltage found", file=tech_file, error=str(e))
        return None
