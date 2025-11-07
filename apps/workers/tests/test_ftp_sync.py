"""Tests for FTP Sync Worker."""

import pytest
from atlas_workers.workers import FTPSyncWorker


@pytest.fixture
def sync_worker(tmp_path):
    """Create FTP sync worker with temp cache."""
    return FTPSyncWorker(cache_path=tmp_path)


@pytest.mark.asyncio
async def test_sync_worker_initialization(tmp_path):
    """Test worker initialization."""
    worker = FTPSyncWorker(cache_path=tmp_path)
    assert worker.cache_path == tmp_path
    assert worker.dac == "incois"
    # Manifest is created on demand, not on init
    assert worker.manifest_file is not None


@pytest.mark.asyncio
async def test_parse_profile_index(sync_worker):
    """Test parsing profile index."""
    sample_index = """# Test Index
dac/incois/2902224/2902224_prof.nc | 2025-11-06 |
dac/incois/2902224/profiles/R2902224_001.nc | 2025-11-05 |
dac/incois/2902225/2902225_prof.nc | 2025-11-06 |
"""

    # Set DAC to 'incois' for matching
    sync_worker.dac = "incois"
    floats = sync_worker._parse_profile_index(sample_index)

    assert "2902224" in floats or len(floats) >= 1  # At least some floats parsed
    if "2902224" in floats:
        assert len(floats["2902224"]) >= 1  # At least one file for 2902224


@pytest.mark.asyncio
async def test_manifest_management(sync_worker):
    """Test manifest save and load."""
    sync_worker.manifest["test_key"] = "test_value"
    sync_worker._save_manifest()

    # Reload worker
    worker2 = FTPSyncWorker(cache_path=sync_worker.cache_path)
    assert worker2.manifest.get("test_key") == "test_value"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
