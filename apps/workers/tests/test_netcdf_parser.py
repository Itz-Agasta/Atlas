"""Tests for NetCDF Parser Worker."""

from datetime import UTC, datetime

import numpy as np
import pytest
import xarray as xr
from atlas_workers.models import MeasurementProfile, ProfileData
from atlas_workers.workers import NetCDFParserWorker


@pytest.fixture
def parser_worker(tmp_path):
    """Create parser worker."""
    return NetCDFParserWorker(cache_path=tmp_path)


@pytest.fixture
def sample_netcdf_file(tmp_path):
    """Create a sample NetCDF file for testing."""
    n_prof = 3
    n_levels = 10

    # Create sample data
    data = {
        "LATITUDE": (["N_PROF"], np.array([-5.2, -5.1, -5.0])),
        "LONGITUDE": (["N_PROF"], np.array([71.5, 71.6, 71.7])),
        "TIME": (["N_PROF"], np.array([0, 1, 2], dtype="datetime64[D]")),
        "PRES": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 2000),
        "TEMP": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 20 - 2),
        "PSAL": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) + 34),
        "DOXY": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels) * 200),
        "CHLA": (["N_PROF", "N_LEVELS"], np.random.rand(n_prof, n_levels)),
        "CYCLE_NUMBER": (["N_PROF"], np.array([320, 321, 322])),
    }

    ds = xr.Dataset(data)
    ds.attrs["title"] = "Float 2902224"

    file_path = tmp_path / "R2902224_001.nc"
    ds.to_netcdf(file_path)
    return file_path


def test_parser_initialization(tmp_path):
    """Test parser initialization."""
    worker = NetCDFParserWorker(cache_path=tmp_path, output_arrow=True)
    assert worker.cache_path == tmp_path
    assert worker.output_arrow is True


def test_parse_single_profile(parser_worker, sample_netcdf_file):
    """Test parsing single profile from NetCDF."""
    profiles = parser_worker.parse_profile_file(sample_netcdf_file)

    assert profiles is not None
    assert len(profiles) == 3

    # Check first profile
    profile = profiles[0]
    assert profile.float_id == "2902224"
    assert profile.cycle_number == 320
    assert len(profile.measurements) == 10
    assert profile.max_depth > 0


def test_measurement_profile_stats():
    """Test profile statistics calculation."""
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


def test_export_to_json(parser_worker, tmp_path):
    """Test JSON export."""
    profiles = [
        ProfileData(
            float_id="2902224",
            cycle_number=320,
            profile_time=datetime.now(UTC),
            latitude=-5.0,
            longitude=71.5,
            measurements=[
                MeasurementProfile(depth=0.0, temperature=15.0),
            ],
        )
    ]

    output_file = tmp_path / "test_output.json"
    success = parser_worker.export_to_json(profiles, output_file)

    assert success
    assert output_file.exists()


def test_export_to_arrow(parser_worker, tmp_path):
    """Test Arrow export."""
    pytest.importorskip("pyarrow")

    profiles = [
        ProfileData(
            float_id="2902224",
            cycle_number=320,
            profile_time=datetime.now(UTC),
            latitude=-5.0,
            longitude=71.5,
            measurements=[
                MeasurementProfile(depth=0.0, temperature=15.0),
            ],
        )
    ]

    output_file = tmp_path / "test_output.parquet"
    success = parser_worker.export_to_arrow(profiles, output_file)

    assert success
    assert output_file.exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
