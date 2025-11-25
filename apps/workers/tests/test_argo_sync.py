"""Tests for ARGO Sync Worker."""

import pytest
from atlas_workers.workers import ArgoSyncWorker


@pytest.fixture
def sync_worker(tmp_path):
    """Create ARGO sync worker with temp cache."""
    return ArgoSyncWorker(cache_path=tmp_path)


def test_sync_worker_initialization(tmp_path):
    """Test worker initialization."""
    worker = ArgoSyncWorker(cache_path=tmp_path)
    assert worker.cache_path == tmp_path
    assert worker.dac == "incois"
    assert worker.manifest_file is not None


def test_parse_profile_index(sync_worker):
    """Test parsing profile index.

    In aggregate-only mode (USE_AGGREGATE_ONLY=True), the parser extracts
    float IDs but doesn't store individual profile details.
    """
    sample_index = """# Test Index
# This is a header comment
incois/2902224/2902224_prof.nc,2025-11-06,0.0,72.0,Indian Ocean,profiler,incois,2025-11-06
incois/2902224/profiles/R2902224_001.nc,2025-11-05,0.0,72.0,Indian Ocean,profiler,incois,2025-11-05
incois/2902225/2902225_prof.nc,2025-11-06,-5.0,75.0,Indian Ocean,profiler,incois,2025-11-06
"""

    sync_worker.dac = "incois"
    floats = sync_worker._parse_profile_index(sample_index)

    # Should find both floats from the index
    assert "2902224" in floats
    assert "2902225" in floats
    assert len(floats) == 2


def test_manifest_management(sync_worker):
    """Test manifest save and load."""
    sync_worker.manifest["test_key"] = "test_value"
    sync_worker._save_manifest()

    # Reload worker
    worker2 = ArgoSyncWorker(cache_path=sync_worker.cache_path)
    assert worker2.manifest.get("test_key") == "test_value"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
