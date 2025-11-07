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
        with xr.open_dataset(file_path) as ds:
            metadata = {
                "file_name": file_path.name,
                "attributes": dict(ds.attrs),
                "variables": list(ds.variables.keys()),
                "dimensions": dict(ds.dims),
            }

            # Extract important metadata variables
            if "FLOAT_SERIAL_NO" in ds.variables:
                try:
                    serial_no = ds["FLOAT_SERIAL_NO"].values[0]
                    if hasattr(serial_no, "item"):
                        serial_no = serial_no.item()
                    metadata["float_serial_no"] = serial_no
                except (IndexError, AttributeError):
                    pass

            if "FLOAT_WMO_ID" in ds.variables:
                try:
                    wmo_id = ds["FLOAT_WMO_ID"].values[0]
                    if hasattr(wmo_id, "item"):
                        wmo_id = wmo_id.item()
                    metadata["wmo_id"] = wmo_id
                except (IndexError, AttributeError):
                    pass

            logger.info("Metadata file parsed", file=file_path.name)
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
            n_meas = ds.dims.get("N_MEASUREMENT", 0)

            for i in range(min(n_meas, 1000)):  # Limit to 1000 positions
                try:
                    lat = float(ds["LATITUDE"].values[i]) if "LATITUDE" in ds else None
                    lon = (
                        float(ds["LONGITUDE"].values[i]) if "LONGITUDE" in ds else None
                    )
                    time_val: Any = None

                    if "TIME" in ds:
                        time_val = ds["TIME"].values[i]
                        if isinstance(time_val, np.datetime64):
                            ts = (
                                time_val - np.datetime64("1970-01-01T00:00:00")
                            ) / np.timedelta64(1, "s")
                            time_val = datetime.fromtimestamp(float(ts), tz=UTC)

                    if lat is not None and lon is not None:
                        pos_dict: dict[str, Any] = {
                            "latitude": lat,
                            "longitude": lon,
                            "time": time_val,
                        }
                        if isinstance(trajectory["positions"], list):
                            trajectory["positions"].append(pos_dict)
                except (IndexError, TypeError, ValueError):
                    continue

            logger.info(
                "Trajectory file parsed",
                file=file_path.name,
                positions=len(trajectory["positions"]),
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
