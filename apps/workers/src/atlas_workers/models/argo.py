from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FloatMetadata(BaseModel):
    """ARGO float metadata matching argo_float_metadata table schema."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "float_id": 2902224,
                "wmo_number": "2902224",
                "status": "ACTIVE",
                "float_type": "core",
                "data_centre": "IN",
                "project_name": "Argo India",
                "operating_institution": "INCOIS",
                "pi_name": "M Ravichandran",
                "platform_type": "ARVOR",
                "platform_maker": "NKE",
                "float_serial_no": "17007",
                "launch_date": "2019-03-15T00:00:00Z",
                "launch_lat": 16.42,
                "launch_lon": 88.05,
            }
        }
    )

    # Core identifiers
    float_id: int = Field(..., description="Float ID (integer)")
    wmo_number: str = Field(..., description="WMO number (string)")

    # Status and type
    status: Optional[str] = Field(
        "UNKNOWN",
        description="ACTIVE | INACTIVE | UNKNOWN | DEAD",
    )
    float_type: Optional[str] = Field(
        "unknown",
        description="core | oxygen | biogeochemical | deep | unknown",
    )

    # Institutional info
    data_centre: str = Field(..., description="Data centre code (e.g., IN)")
    project_name: Optional[str] = Field(None, description="Project name")
    operating_institution: Optional[str] = Field(
        None, description="Operating institution"
    )
    pi_name: Optional[str] = Field(None, description="Principal investigator")

    # Platform details
    platform_type: Optional[str] = Field(
        None, description="Platform type (ARVOR, APEX)"
    )
    platform_maker: Optional[str] = Field(None, description="Platform maker (NKE)")
    float_serial_no: Optional[str] = Field(None, description="Float serial number")

    # Deployment info
    launch_date: Optional[datetime] = Field(None, description="Deployment date")
    launch_lat: Optional[float] = Field(None, description="Deployment latitude")
    launch_lon: Optional[float] = Field(None, description="Deployment longitude")
    start_mission_date: Optional[datetime] = Field(None, description="Mission start")
    end_mission_date: Optional[datetime] = Field(None, description="Mission end")


class FloatStatus(BaseModel):
    """ARGO float current position matching argo_float_status table schema."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "float_id": 2902224,
                "latitude": -4.8,
                "longitude": 72.1,
                "cycle_number": 320,
                "battery_percent": 69,
                "last_update": "2025-11-29T03:20:00Z",
                "last_depth": 2000,
                "last_temp": 15.2,
                "last_salinity": 34.5,
            }
        }
    )

    float_id: int = Field(..., description="Float ID (FK to argo_float_metadata)")
    latitude: Optional[float] = Field(None, description="Current latitude")
    longitude: Optional[float] = Field(None, description="Current longitude")
    cycle_number: Optional[int] = Field(None, description="Current cycle number")
    battery_percent: Optional[int] = Field(
        None, description="Battery percentage (0-100)"
    )
    last_update: Optional[datetime] = Field(
        None, validation_alias="profile_time", description="Last profile timestamp"
    )
    last_depth: Optional[float] = Field(None, description="Last max depth in meters")
    last_temp: Optional[float] = Field(None, description="Surface temperature (C)")
    last_salinity: Optional[float] = Field(None, description="Surface salinity (PSU)")


# TODO_DUCKDB: Profile data models for DuckDB/Parquet storage
# These will be used when implementing DuckDB upload operations
#
# class MeasurementProfile(BaseModel):
#     """Single vertical profile measurement."""
#     depth: float
#     temperature: Optional[float]
#     salinity: Optional[float]
#     oxygen: Optional[float]
#     chlorophyll: Optional[float]
#
# class ProfileData(BaseModel):
#     """Complete ARGO float profile cycle for DuckDB storage."""
#     float_id: int
#     cycle_number: int
#     profile_time: datetime
#     latitude: float
#     longitude: float
#     measurements: list[MeasurementProfile]
#     max_depth: Optional[float]
#     quality_status: Optional[str]
