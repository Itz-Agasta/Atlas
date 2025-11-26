"""Tests for NetCDF Parser Worker - Aggregate File Processing.

These tests verify the optimized aggregate file parsing approach.
The parser now ONLY supports aggregate _prof.nc files
"""

from datetime import UTC, datetime

import numpy as np
import pytest
import xarray as xr
from atlas_workers.models import MeasurementProfile, ProfileData
from atlas_workers.workers import NetCDFParserWorker
from atlas_workers.workers.netcdf_processor.netcdf_aggregate_parser import (
    parse_aggregate_profiles,
)


@pytest.fixture
def parser_worker(tmp_path):
    """Create parser worker with temp cache path."""
    return NetCDFParserWorker(cache_path=tmp_path)


@pytest.fixture
def sample_aggregate_file(tmp_path):
    """Create a sample aggregate _prof.nc file for testing.

    This mimics the real ARGO aggregate file format with N_PROF x N_LEVELS structure.
    """
    n_prof = 5
    n_levels = 50

    # Create sample data matching ARGO format
    data = {
        "LATITUDE": (["N_PROF"], np.array([-5.2, -5.1, -5.0, -4.9, -4.8])),
        "LONGITUDE": (["N_PROF"], np.array([71.5, 71.6, 71.7, 71.8, 71.9])),
        "JULD": (["N_PROF"], np.array([25000.0, 25001.0, 25002.0, 25003.0, 25004.0])),
        "PRES": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 2000),
        "TEMP": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 20 + 5),
        "PSAL": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) + 34),
        "DOXY": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 200),
        "CHLA": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels)),
        "CYCLE_NUMBER": (["N_PROF"], np.array([1, 2, 3, 4, 5])),
    }

    ds = xr.Dataset(data)
    ds.attrs["title"] = "Float 2902224"

    # Create directory structure matching ARGO layout
    float_dir = tmp_path / "incois" / "2902224"
    float_dir.mkdir(parents=True)

    file_path = float_dir / "2902224_prof.nc"
    ds.to_netcdf(file_path)
    return file_path


def test_parser_initialization(tmp_path):
    """Test parser initialization with cache path."""
    worker = NetCDFParserWorker(cache_path=tmp_path)
    assert worker.cache_path == tmp_path
    assert worker.dac == "incois"  # Default DAC


def test_process_directory_not_found(parser_worker):
    """Test processing a non-existent directory."""
    result = parser_worker.process_directory("9999999")

    assert "error" in result
    assert result["float_id"] == "9999999"


def test_parse_aggregate_profiles(sample_aggregate_file):
    """Test parsing aggregate profile file directly."""
    profiles = parse_aggregate_profiles(sample_aggregate_file)

    assert profiles is not None
    assert len(profiles) == 5

    # Check first profile structure
    profile = profiles[0]
    assert "float_id" in profile
    assert "cycle_number" in profile
    assert "latitude" in profile
    assert "longitude" in profile
    assert "measurements" in profile

    # Verify measurements is a list of dicts
    assert isinstance(profile["measurements"], list)
    assert len(profile["measurements"]) > 0


def test_process_directory_with_aggregate(tmp_path, sample_aggregate_file):
    """Test full directory processing with aggregate file."""
    worker = NetCDFParserWorker(cache_path=tmp_path)
    result = worker.process_directory("2902224")

    assert result["float_id"] == "2902224"
    assert result["profiles_parsed"] == 5
    assert len(result["profiles"]) == 5
    assert result["errors"] == 0


def test_measurement_profile_model():
    """Test MeasurementProfile model creation."""
    measurement = MeasurementProfile(
        depth=100.0,
        temperature=15.5,
        salinity=34.5,
        oxygen=200.0,
        chlorophyll=0.5,
    )

    assert measurement.depth == 100.0
    assert measurement.temperature == 15.5
    assert measurement.salinity == 34.5


def test_profile_data_statistics():
    """Test ProfileData statistics calculation."""
    profile = ProfileData(
        float_id="test",
        cycle_number=1,
        profile_time=datetime.now(UTC),
        latitude=-5.0,
        longitude=71.5,
        measurements=[
            MeasurementProfile(depth=0.0, temperature=15.0, salinity=34.5),
            MeasurementProfile(depth=100.0, temperature=10.0, salinity=34.6),
            MeasurementProfile(depth=1000.0, temperature=2.0, salinity=34.7),
        ],
    )

    stats = profile.statistics()
    assert stats["avg_temperature"] == pytest.approx(9.0)
    assert stats["measurement_count"] == 3


def test_aggregate_profiles_return_format(sample_aggregate_file):
    """Test that aggregate parser returns pre-serialized dicts (not Pydantic models)."""
    profiles = parse_aggregate_profiles(sample_aggregate_file)

    # Should return list of dicts, not ProfileData objects
    # This is optimized for direct database insertion
    assert isinstance(profiles, list)
    assert isinstance(profiles[0], dict)

    # Measurements should also be list of dicts
    assert isinstance(profiles[0]["measurements"], list)
    if profiles[0]["measurements"]:
        assert isinstance(profiles[0]["measurements"][0], dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
