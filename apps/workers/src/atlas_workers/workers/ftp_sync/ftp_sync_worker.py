"""
FTP Sync Worker for ARGO oceanographic data.

Syncs data from ARGO FTP server to local storage with manifest tracking
to avoid re-downloading files. Uses HTTPS and concurrent downloads.
"""

import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime
import httpx

from ...config import settings
from ...utils.logging import get_logger


logger = logging.getLogger(__name__)


MAX_CONCURRENT_DOWNLOADS = 10

@dataclass
class SyncStats:
    """Statistics from a sync operation."""
    downloaded: int = 0
    skipped: int = 0
    failed: int = 0
    total_size: int = 0
    floats_synced: Set[str] = None

    def __post_init__(self):
        if self.floats_synced is None:
            self.floats_synced = set()

    def to_dict(self):
        d = asdict(self)
        d['floats_synced'] = list(self.floats_synced)
        return d


class FTPSyncWorker:
    """Worker for syncing ARGO float data from HTTPS server."""

    BASE_PATH = "dac"
    PROFILE_INDEX = "ar_index_global_prof.txt"
    
    def __init__(self, cache_path: Path, dac: str = "incois"):
        """
        Initialize FTP sync worker.
        
        Args:
            cache_path: Local directory to store downloaded files
            dac: Data Assembly Center to sync from (default: incois)
        """
        self.cache_path = Path(cache_path)
        self.dac = dac
        self.manifest_file = self.cache_path / "manifest.json"
        self.manifest: Dict = {}
        
        # Create cache directory if it doesn't exist
        self.cache_path.mkdir(parents=True, exist_ok=True)
        
        # Load existing manifest
        self._load_manifest()
        
        # Semaphore to limit concurrent downloads
        self.download_semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

    def _load_manifest(self):
        """Load manifest from disk."""
        if self.manifest_file.exists():
            try:
                with open(self.manifest_file, 'r') as f:
                    self.manifest = json.load(f)
            except (json.JSONDecodeError, IOError):
                self.manifest = {}
        else:
            self.manifest = {}

    def _save_manifest(self):
        """Save manifest to disk."""
        with open(self.manifest_file, 'w') as f:
            json.dump(self.manifest, f, indent=2)

    def _parse_profile_index(self, index_content: str) -> Dict[str, List[Dict]]:
        """
        Parse the ARGO profile index file.
        
        Args:
            index_content: Content of the index file
            
        Returns:
            Dictionary mapping float IDs to list of file information
        """
        floats: Dict[str, List[Dict]] = {}
        
        for line in index_content.strip().split('\n'):
            # Skip comments and empty lines
            if line.startswith('#') or not line.strip():
                continue
            
            parts = line.split(',')
            if len(parts) < 7:
                continue
            
            file_path = parts[0].strip()
            
            # Filter by DAC
            if not file_path.startswith(f"{self.dac}/"):
                continue
            
            # Extract float ID from path (e.g., "incois/2902224/...")
            path_parts = file_path.split('/')
            if len(path_parts) < 2:
                continue
            
            float_id = path_parts[1]
            
            file_info = {
                'path': file_path,
                'date': parts[1].strip(),
                'latitude': parts[2].strip(),
                'longitude': parts[3].strip(),
                'ocean': parts[4].strip(),
                'profiler_type': parts[5].strip(),
                'institution': parts[6].strip(),
            }
            
            if float_id not in floats:
                floats[float_id] = []
            floats[float_id].append(file_info)
        
        return floats

    async def _download_index(self) -> str:
        """Download the profile index file via HTTPS using httpx."""
        url = f"{settings.HTTP_BASE_URL}/{self.PROFILE_INDEX}"
        
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text

    async def _download_file(self, remote_path: str, local_path: Path, float_id: str, file_date: str) -> Dict:
        """
        Download a single file via HTTPS.
        
        Args:
            remote_path: Remote file path on server
            local_path: Local path to save file
            float_id: Float ID for manifest tracking
            file_date: File date for manifest tracking
            
        Returns:
            Dictionary with download result information
        """
        async with self.download_semaphore:
            try:
                # Create parent directories
                local_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Construct HTTPS URL
                url = f"{settings.HTTP_BASE_URL}/{self.BASE_PATH}/{remote_path}"
                
                logger.debug(f"Downloading: {remote_path}")
                
                async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    
                    # Write file to disk
                    local_path.write_bytes(response.content)
                    
                    size = len(response.content)
                    logger.debug(f"Downloaded {size:,} bytes: {remote_path}")
                    
                    return {
                        'success': True,
                        'path': remote_path,
                        'size': size,
                        'float_id': float_id,
                        'date': file_date,
                        'synced_at': datetime.utcnow().isoformat()
                    }
                    
            except Exception as e:
                logger.error(f"Failed to download {remote_path}: {e}")
                return {
                    'success': False,
                    'path': remote_path,
                    'error': str(e)
                }

    def _is_file_synced(self, file_path: str, file_date: str) -> bool:
        """
        Check if file has already been synced.
        
        Args:
            file_path: Remote file path
            file_date: File date from index
            
        Returns:
            True if file is already synced with same date
        """
        if file_path not in self.manifest:
            return False
        
        manifest_entry = self.manifest[file_path]
        return manifest_entry.get('date') == file_date

    async def sync(self, float_ids: Optional[List[str]] = None) -> SyncStats:
        """
        Sync ARGO float data from HTTPS server.
        
        Args:
            float_ids: Optional list of specific float IDs to sync.
                      If None, syncs all floats for the DAC.
        
        Returns:
            SyncStats object with sync statistics
        """
        stats = SyncStats()
        
        logger.info(f"Downloading profile index from {settings.HTTP_BASE_URL}...")
        index_content = await self._download_index()
        
        logger.info(f"Parsing profile index for DAC: {self.dac}...")
        floats = self._parse_profile_index(index_content)
        
        # Filter by specific float IDs if provided
        if float_ids:
            floats = {fid: floats[fid] for fid in float_ids if fid in floats}
        
        if not floats:
            logger.warning(f"No floats found for DAC '{self.dac}'" + 
                  (f" with IDs {float_ids}" if float_ids else ""))
            return stats
        
        total_files = sum(len(files) for files in floats.values())
        logger.info(f"Found {len(floats)} float(s) with {total_files} file(s)")
        
        # Prepare all download tasks
        download_tasks = []
        
        for float_id, files in floats.items():
            logger.info(f"Preparing float {float_id} ({len(files)} files)...")
            stats.floats_synced.add(float_id)
            
            for file_info in files:
                file_path = file_info['path']
                file_date = file_info['date']
                
                # Check if already synced
                if self._is_file_synced(file_path, file_date):
                    stats.skipped += 1
                    continue
                
                # Add download task
                local_path = self.cache_path / file_path
                task = self._download_file(file_path, local_path, float_id, file_date)
                download_tasks.append(task)
        
        # Execute all downloads concurrently
        if download_tasks:
            logger.info(f"Starting concurrent download of {len(download_tasks)} files "
                       f"(max {MAX_CONCURRENT_DOWNLOADS} concurrent)...")
            
            results = await asyncio.gather(*download_tasks, return_exceptions=True)
            
            # Process results
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Download task failed with exception: {result}")
                    stats.failed += 1
                elif result['success']:
                    # Update manifest
                    self.manifest[result['path']] = {
                        'date': result['date'],
                        'size': result['size'],
                        'synced_at': result['synced_at'],
                        'float_id': result['float_id'],
                    }
                    
                    stats.downloaded += 1
                    stats.total_size += result['size']
                else:
                    stats.failed += 1
        
        # Save manifest
        self._save_manifest()
        
        logger.info(f"Sync complete! Downloaded: {stats.downloaded}, Skipped: {stats.skipped}, "
                   f"Failed: {stats.failed}, Total size: {stats.total_size:,} bytes, "
                   f"Floats synced: {len(stats.floats_synced)}")
        
        return stats


# Example usage
async def main():
    """Example usage of FTPSyncWorker."""
    worker = FTPSyncWorker(
        cache_path=Path("./argo_cache"),
        dac="incois"
    )
    
    # Sync specific floats
    stats = await worker.sync(float_ids=["2902224", "2902225"])
    
    # Or sync all floats for the DAC
    # stats = await worker.sync()
    
    logger.info(f"Sync statistics: {stats.to_dict()}")


if __name__ == "__main__":
    asyncio.run(main())