"""Aggregate file parsing for metadata, trajectory, and technical data."""

from pathlib import Path
from typing import Any, Optional

import numpy as np
import xarray as xr

from ...utils import get_logger

logger = get_logger(__name__)


def parse_metadata_file(file_path: Path) -> Optional[dict[str, Any]]:
    """Parse metadata file to extract float information.

    Args:
        file_path: Path to metadata NetCDF file

    Returns:
        Dictionary with metadata or None if parsing failed
    """
    try:
        from datetime import UTC, datetime

        with xr.open_dataset(file_path) as ds:
            metadata: dict[str, Any] = {
                "file_name": file_path.name,
                "attributes": dict(ds.attrs),
                "variables": list(ds.variables.keys()),
                "dimensions": dict(ds.sizes),
            }

            # Extract deployment information
            if "LAUNCH_DATE" in ds.variables:
                try:
                    launch_date_val = ds["LAUNCH_DATE"].values
                    # Handle numpy array of bytes or direct bytes
                    if isinstance(launch_date_val, (bytes, np.ndarray)):
                        if isinstance(launch_date_val, np.ndarray):
                            launch_date_val = (
                                launch_date_val.item()
                            )  # Extract scalar from array
                        if isinstance(launch_date_val, bytes):
                            launch_date_str = launch_date_val.decode("utf-8").strip()
                            # Format: YYYYMMDDHHMMSS or YYYYMMDD
                            if launch_date_str and len(launch_date_str) >= 14:
                                metadata["launch_date"] = datetime.strptime(
                                    launch_date_str[:14], "%Y%m%d%H%M%S"
                                ).replace(tzinfo=UTC)
                            elif launch_date_str and len(launch_date_str) >= 8:
                                # Handle date-only format (YYYYMMDD)
                                metadata["launch_date"] = datetime.strptime(
                                    launch_date_str[:8], "%Y%m%d"
                                ).replace(tzinfo=UTC)
                except (ValueError, AttributeError, UnicodeDecodeError) as e:
                    logger.warning("Failed to parse LAUNCH_DATE", error=str(e))

            if "LAUNCH_LATITUDE" in ds.variables:
                try:
                    lat = float(ds["LAUNCH_LATITUDE"].values)
                    if not np.isnan(lat):
                        metadata["launch_lat"] = lat
                except (ValueError, TypeError):
                    pass

            if "LAUNCH_LONGITUDE" in ds.variables:
                try:
                    lon = float(ds["LAUNCH_LONGITUDE"].values)
                    if not np.isnan(lon):
                        metadata["launch_lon"] = lon
                except (ValueError, TypeError):
                    pass

            if "PLATFORM_TYPE" in ds.variables:
                try:
                    platform_type_val = ds["PLATFORM_TYPE"].values
                    # Handle numpy array of bytes or direct bytes
                    if isinstance(platform_type_val, (bytes, np.ndarray)):
                        if isinstance(platform_type_val, np.ndarray):
                            platform_type_val = (
                                platform_type_val.item()
                            )  # Extract scalar
                        if isinstance(platform_type_val, bytes):
                            metadata["float_model"] = platform_type_val.decode(
                                "utf-8"
                            ).strip()
                        elif isinstance(platform_type_val, str):
                            metadata["float_model"] = platform_type_val.strip()
                except (UnicodeDecodeError, AttributeError):
                    pass

            # Extract serial number
            if "FLOAT_SERIAL_NO" in ds.variables:
                try:
                    serial_no = ds["FLOAT_SERIAL_NO"].values
                    if isinstance(serial_no, bytes):
                        metadata["float_serial_no"] = serial_no.decode("utf-8").strip()
                    elif hasattr(serial_no, "item"):
                        serial_no = serial_no.item()
                        if isinstance(serial_no, bytes):
                            metadata["float_serial_no"] = serial_no.decode(
                                "utf-8"
                            ).strip()
                        else:
                            metadata["float_serial_no"] = serial_no
                except (IndexError, AttributeError, UnicodeDecodeError):
                    pass

            if "PLATFORM_NUMBER" in ds.variables:
                try:
                    platform_num = ds["PLATFORM_NUMBER"].values
                    if isinstance(platform_num, bytes):
                        metadata["wmo_id"] = platform_num.decode("utf-8").strip()
                    elif hasattr(platform_num, "item"):
                        platform_num = platform_num.item()
                        if isinstance(platform_num, bytes):
                            metadata["wmo_id"] = platform_num.decode("utf-8").strip()
                        else:
                            metadata["wmo_id"] = str(platform_num)
                except (IndexError, AttributeError, UnicodeDecodeError):
                    pass

            logger.info(
                "Metadata file parsed",
                file=file_path.name,
                has_launch_date="launch_date" in metadata,
                has_position="launch_lat" in metadata and "launch_lon" in metadata,
            )
            return metadata

    except Exception as e:
        logger.error("Failed to parse metadata file", error=str(e))
        return None


def parse_trajectory_file(file_path: Path) -> Optional[dict[str, Any]]:
    """Parse trajectory file to extract float positions.

    Args:
        file_path: Path to trajectory NetCDF file

    Returns:
        Dictionary with trajectory data or None if parsing failed
    """
    try:
        from datetime import UTC, datetime

        with xr.open_dataset(file_path) as ds:
            trajectory: dict[str, Any] = {
                "file_name": file_path.name,
                "positions": [],
            }

            # Extract trajectory information
            n_meas = ds.sizes.get("N_MEASUREMENT", 0)

            # Process trajectory data - filter out invalid positions
            for i in range(min(n_meas, 10000)):  # Limit to 10k positions
                try:
                    lat = float(ds["LATITUDE"].values[i]) if "LATITUDE" in ds else None
                    lon = (
                        float(ds["LONGITUDE"].values[i]) if "LONGITUDE" in ds else None
                    )

                    # Skip NaN positions
                    if lat is None or lon is None or np.isnan(lat) or np.isnan(lon):
                        continue

                    time_val: Any = None
                    cycle_num: Any = None

                    # Parse JULD (Julian day) timestamp
                    if "JULD" in ds:
                        juld_val = ds["JULD"].values[i]
                        try:
                            # JULD is already converted to datetime64 by xarray
                            if isinstance(juld_val, np.datetime64) and not np.isnat(
                                juld_val
                            ):
                                ts = (
                                    juld_val - np.datetime64("1970-01-01T00:00:00")
                                ) / np.timedelta64(1, "s")
                                time_val = datetime.fromtimestamp(float(ts), tz=UTC)
                        except (ValueError, TypeError, OverflowError):
                            pass

                    # Extract cycle number
                    if "CYCLE_NUMBER" in ds:
                        try:
                            cycle_raw = ds["CYCLE_NUMBER"].values[i]
                            if isinstance(cycle_raw, (int, np.integer)):
                                cycle_num = int(cycle_raw)
                            elif isinstance(cycle_raw, (float, np.floating)):
                                if not np.isnan(cycle_raw) and cycle_raw >= 0:
                                    cycle_num = int(cycle_raw)
                        except (ValueError, TypeError):
                            pass

                    # Build position record
                    pos_dict: dict[str, Any] = {
                        "latitude": lat,
                        "longitude": lon,
                    }
                    if time_val is not None:
                        pos_dict["time"] = time_val
                    if cycle_num is not None and cycle_num >= 0:
                        pos_dict["cycle"] = cycle_num

                    if isinstance(trajectory["positions"], list):
                        trajectory["positions"].append(pos_dict)

                except (IndexError, TypeError, ValueError):
                    # Skip invalid records silently
                    continue

            logger.info(
                "Trajectory file parsed",
                file=file_path.name,
                positions=len(trajectory["positions"]),
                total_measurements=n_meas,
            )
            return trajectory

    except Exception as e:
        logger.error("Failed to parse trajectory file", error=str(e))
        return None


def parse_tech_file(file_path: Path) -> Optional[dict[str, Any]]:
    """Parse technical data file.

    Args:
        file_path: Path to technical data NetCDF file

    Returns:
        Dictionary with technical data or None if parsing failed
    """
    try:
        with xr.open_dataset(file_path) as ds:
            tech_data: dict[str, Any] = {
                "file_name": file_path.name,
                "attributes": dict(ds.attrs),
                "parameters": {},
            }

            # Extract technical parameters if available
            for var_name in list(ds.variables.keys())[:20]:  # Limit to 20 vars
                try:
                    var_data = ds[var_name].values
                    if hasattr(var_data, "shape") and var_data.size > 0:
                        # Get first value for summary
                        val = var_data.flat[0]
                        if hasattr(val, "item"):
                            val = val.item()
                        if isinstance(tech_data["parameters"], dict):
                            tech_data["parameters"][var_name] = val
                except (IndexError, TypeError, AttributeError):
                    continue

            logger.info("Technical file parsed", file=file_path.name)
            return tech_data

    except Exception as e:
        logger.error("Failed to parse technical file", error=str(e))
        return None
