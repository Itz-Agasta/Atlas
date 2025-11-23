"""
FTP Sync Worker for ARGO oceanographic data.

Syncs data from ARGO FTP server to local storage with manifest tracking
to avoid re-downloading files.
"""

import json
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime
import httpx

from ...utils.logging import get_logger
from ...config import settings
from .http_fallback import HTTPFallbackDownloader, HTTPDownloadError
from .ftp_connection import FTPDownloader, FTPConnectionError


logger = get_logger(__name__)


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
    """Worker for syncing ARGO float data from FTP server."""

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
        
        # Initialize FTP downloader with connection pooling
        self.ftp_downloader = FTPDownloader(
            host=settings.FTP_SERVER,
            port=settings.FTP_PORT,
            timeout=settings.FTP_TIMEOUT,
            max_connections=5
        )
        
        # Initialize HTTP fallback downloader
        self.http_downloader = HTTPFallbackDownloader(
            base_url=settings.HTTP_BASE_URL,
            timeout=settings.HTTP_TIMEOUT
        )
        
        # Create cache directory if it doesn't exist
        self.cache_path.mkdir(parents=True, exist_ok=True)
        
        # Load existing manifest
        self._load_manifest()

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
        """Download the profile index file via HTTP using httpx."""
        url = f"{settings.HTTP_BASE_URL}/{self.PROFILE_INDEX}"
        
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text

    async def _download_file_with_fallback(self, remote_path: str, local_path: Path) -> int:
        """
        Download a file with FTP (primary) and HTTP fallback.
        
        Args:
            remote_path: Remote file path on server
            local_path: Local path to save file
            
        Returns:
            Size of downloaded file in bytes
            
        Raises:
            Exception: If both FTP and HTTP downloads fail
        """
        # Create parent directories
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Try FTP first (with connection pooling)
        try:
            logger.debug(f"Attempting FTP download: {remote_path}")
            
            size = await self.ftp_downloader.download_file(
                remote_path=remote_path,
                local_path=local_path,
                base_path=self.BASE_PATH
            )
            
            logger.debug(f"FTP download successful: {remote_path} ({size:,} bytes)")
            return size
            
        except FTPConnectionError as ftp_error:
            logger.warning(f"FTP download failed for {remote_path}: {ftp_error}")
            logger.info(f"Attempting HTTP fallback for {remote_path}")
            
            # Try HTTP fallback
            try:
                size = await self.http_downloader.download_file(
                    remote_path=remote_path,
                    local_path=local_path,
                    base_path=self.BASE_PATH
                )
                logger.info(f"HTTP fallback successful for {remote_path} ({size:,} bytes)")
                return size
                
            except HTTPDownloadError as http_error:
                logger.error(
                    f"Both FTP and HTTP downloads failed for {remote_path}. "
                    f"FTP error: {ftp_error}, HTTP error: {http_error}"
                )
                raise Exception(
                    f"Download failed via FTP and HTTP: {remote_path}"
                ) from http_error

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
        Sync ARGO float data from FTP server.
        
        Args:
            float_ids: Optional list of specific float IDs to sync.
                      If None, syncs all floats for the DAC.
        
        Returns:
            SyncStats object with sync statistics
        """
        stats = SyncStats()
        
        logger.info(f"Downloading profile index from {settings.FTP_SERVER}...")
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
        
        logger.info(f"Found {len(floats)} float(s) with {sum(len(files) for files in floats.values())} file(s)")
        
        # Download files
        for float_id, files in floats.items():
            logger.info(f"Processing float {float_id} ({len(files)} files)...")
            stats.floats_synced.add(float_id)
            
            for file_info in files:
                file_path = file_info['path']
                file_date = file_info['date']
                
                # Check if already synced
                if self._is_file_synced(file_path, file_date):
                    stats.skipped += 1
                    continue
                
                # Download file (with automatic HTTP fallback)
                local_path = self.cache_path / file_path
                
                try:
                    logger.debug(f"Downloading: {file_path}")
                    
                    # This method now handles both FTP and HTTP fallback internally
                    size = await self._download_file_with_fallback(file_path, local_path)
                    
                    # Update manifest
                    self.manifest[file_path] = {
                        'date': file_date,
                        'size': size,
                        'synced_at': datetime.utcnow().isoformat(),
                        'float_id': float_id,
                    }
                    
                    stats.downloaded += 1
                    stats.total_size += size
                    
                    logger.debug(f"Downloaded {size:,} bytes: {file_path}")
                    
                except Exception as e:
                    logger.error(f"Failed to download {file_path}: {e}")
                    stats.failed += 1
        
        # Save manifest
        self._save_manifest()
        
        # Close connection pools
        await self.ftp_downloader.close()
        await self.http_downloader.close()
        
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