from datetime import UTC, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FloatMetadata(BaseModel):
    """ARGO float metadata."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "float_id": "2902224",
                "float_model": "APEX",
                "launch_date": "2019-03-15T00:00:00Z",
                "launch_lat": -5.2,
                "launch_lon": 71.5,
                "deployment_status": "ACTIVE",
            }
        }
    )

    float_id: str = Field(..., description="WMO number")
    float_model: Optional[str] = Field(
        None, description="Float model type (APEX, SOLO, etc)"
    )
    launch_date: Optional[datetime] = Field(None, description="Deployment date")
    launch_lat: Optional[float] = Field(None, description="Deployment latitude")
    launch_lon: Optional[float] = Field(None, description="Deployment longitude")
    deployment_status: Optional[str] = Field("ACTIVE", description="Current status")
    metadata_updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class MeasurementProfile(BaseModel):
    """Single vertical profile measurement."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "depth": 1000.0,
                "temperature": 2.5,
                "salinity": 34.7,
                "oxygen": 145.0,
                "chlorophyll": 0.8,
            }
        }
    )

    depth: float = Field(..., description="Pressure/depth in meters")
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    salinity: Optional[float] = Field(None, description="Practical Salinity Units")
    oxygen: Optional[float] = Field(None, description="Dissolved oxygen in µmol/kg")
    chlorophyll: Optional[float] = Field(None, description="Chlorophyll-a in mg/m³")


class ProfileData(BaseModel):
    """Complete ARGO float profile cycle."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "float_id": "2902224",
                "cycle_number": 320,
                "profile_time": "2025-11-06T03:20:00Z",
                "latitude": -4.8,
                "longitude": 72.1,
                "measurements": [
                    {
                        "depth": 0.0,
                        "temperature": 15.2,
                        "salinity": 34.5,
                        "oxygen": 210.0,
                    },
                ],
                "max_depth": 2087.0,
                "quality_status": "REAL_TIME",
            }
        }
    )

    float_id: str = Field(..., description="WMO float ID")
    cycle_number: int = Field(..., description="Cycle number")
    profile_time: datetime = Field(..., description="Time of profile measurement")
    latitude: float = Field(..., description="Surface latitude")
    longitude: float = Field(..., description="Surface longitude")
    measurements: list[MeasurementProfile] = Field(
        default_factory=list, description="Vertical profile measurements"
    )
    max_depth: Optional[float] = Field(None, description="Maximum depth sampled")
    quality_status: Optional[str] = Field(
        "REAL_TIME", description="REAL_TIME or DELAYED"
    )

    def statistics(self) -> dict[str, float | None]:
        """Calculate profile statistics."""
        temps = [m.temperature for m in self.measurements if m.temperature is not None]
        salinity = [m.salinity for m in self.measurements if m.salinity is not None]
        oxygen = [m.oxygen for m in self.measurements if m.oxygen is not None]

        return {
            "avg_temperature": sum(temps) / len(temps) if temps else None,
            "avg_salinity": sum(salinity) / len(salinity) if salinity else None,
            "avg_oxygen": sum(oxygen) / len(oxygen) if oxygen else None,
            "measurement_count": len(self.measurements),
        }
