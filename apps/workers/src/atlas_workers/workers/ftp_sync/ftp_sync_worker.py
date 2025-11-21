"""FTP Sync Worker for incremental downloads with manifest tracking.

This module provides intelligent syncing of ARGO float data files including
profile files (prof), metadata (meta), technical data (tech), and trajectory 
data (rtraj) with persistent tracking via manifest.json.

Uses the ftp_utils module for all FTP operations.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import TypedDict, List, Dict, Optional, Set, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from .ftp_connection import FTPConnection
from .ftp_scanner import FTPScanner
from .ftp_downloader import FTPDownloader


from ...utils.logging import get_logger
from ...config import settings

logger = get_logger(__name__)


class SyncStats(TypedDict):
    """
    TypedDict describing the summary statistics returned by FTPSyncWorker.sync().

    Keys:
        total_floats: total distinct floats discovered during the sync.
        files_downloaded: number of files successfully downloaded in this run.
        files_skipped: number of files skipped because already present in manifest.
        files_failed: number of files that failed to download.
        bytes_transferred: total bytes transferred during this run.
        duration_seconds: duration of the sync run in seconds.
        sync_start: ISO timestamp when the sync started.
        sync_end: ISO timestamp when the sync finished.
        new_files: list of file paths newly downloaded this run.
        failed_files: list of file paths that failed this run.
    """
    total_floats: int
    files_downloaded: int
    files_skipped: int
    files_failed: int
    bytes_transferred: int
    duration_seconds: float
    sync_start: str
    sync_end: str
    new_files: List[str]
    failed_files: List[str]


class ArgoFileFilter:
    """
    Helper to identify ARGO file types by filename patterns and extract float IDs.
    """

    FILE_PATTERNS = {
        'prof': '_prof.nc',
        'meta': '_meta.nc',
        'tech': '_tech.nc',
        'rtraj': '_Rtraj.nc'
    }

    def __init__(self, file_types: Optional[List[str]] = None):
        """
        Initialize the filter.

        Args:
            file_types: Optional list of file type keys to restrict matching to.
                        If None, all known patterns are used.
        """
        if file_types is None:
            self.file_types = list(self.FILE_PATTERNS.keys())
        else:
            self.file_types = [ft for ft in file_types if ft in self.FILE_PATTERNS]

    def is_target_file(self, filename: str) -> Optional[str]:
        """
        Determine whether a filename matches one of the configured ARGO file type suffixes.

        Args:
            filename: the filename to check (may include path segments).

        Returns:
            The file type key (e.g., 'prof', 'meta', ...) if matched, otherwise None.
        """
        for file_type in self.file_types:
            if filename.endswith(self.FILE_PATTERNS[file_type]):
                return file_type
        return None

    def extract_float_id(self, filename: str) -> Optional[str]:
        """
        Extract float ID from the filename if present.

        The extraction heuristic splits on underscore and takes the leading segment,
        optionally trimming path components. It validates that the result is numeric
        and has a reasonable length (>= 7 digits).

        Args:
            filename: the filename or path containing the float id.

        Returns:
            The float id string if it looks valid, otherwise None.
        """
        parts = filename.split('_')
        if parts:
            potential_id = parts[0].split('/')[-1]
            if potential_id.isdigit() and len(potential_id) >= 7:
                return potential_id
        return None

    def get_extensions(self) -> List[str]:
        """
        Get the list of filename suffixes for the configured file types.

        Returns:
            List of suffix strings (e.g., ['_prof.nc', '_meta.nc', ...]).
        """
        return [self.FILE_PATTERNS[ft] for ft in self.file_types]


class FTPSyncWorker:
    """
    Worker class that scans a remote FTP repository for ARGO float files,
    downloads missing files, and persistently tracks downloaded files in a manifest.

    """

    def __init__(
        self,
        ftp_host: str = settings.FTP_SERVER,
        ftp_base_path: str = "/ifremer/argo",
        cache_path: Optional[Path] = settings.LOCAL_CACHE_PATH,
        download_dir: Optional[str] = None,
        dac: str = settings.ARGO_DAC,
        max_workers: int = 3,
        timeout: int = settings.FTP_TIMEOUT,
        max_retries: int = settings.FTP_MAX_RETRIES,
        retry_delay: int = settings.FTP_RETRY_DELAY,
        file_types: Optional[List[str]] = None
    ):
        """
        Initialize the FTPSyncWorker.

        Args:
            ftp_host: FTP server hostname.
            ftp_base_path: base path on the FTP server containing ARGO data.
            cache_path: local directory to store manifest and cached files.
            download_dir: subdirectory or path for downloaded files (defaults to cache_path/data).
            dac: Data Assembly Center identifier used to filter files.
            max_workers: maximum number of worker threads for concurrent downloads.
            timeout: FTP connection timeout in seconds.
            max_retries: number of retries for downloader operations.
            retry_delay: delay between retries in seconds.
            file_types: optional list of file types to download (subset of 'prof', 'meta', 'tech', 'rtraj').
        """
        self.cache_path = cache_path if cache_path else Path("argo_cache")
        self.cache_path.mkdir(parents=True, exist_ok=True)

        self.download_dir = Path(download_dir) if download_dir else self.cache_path / "data"
        self.download_dir.mkdir(parents=True, exist_ok=True)

        self.dac = dac
        self.manifest_file = self.cache_path / "manifest.json"
        self.manifest = self._load_manifest()

        self.ftp_connection = FTPConnection(
            host=ftp_host,
            base_path=ftp_base_path,
            timeout=timeout,
            passive=True
        )

        self.ftp_base_path = ftp_base_path
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.max_workers = max_workers

        self.file_filter = ArgoFileFilter(file_types)

    def _load_manifest(self) -> Dict:
        """
        Load the manifest JSON from disk, or create a new empty manifest if none exists
        or the existing file is corrupted.

        Returns:
            The manifest dictionary loaded from disk or a newly created empty manifest.
        """
        if self.manifest_file.exists():
            try:
                with open(self.manifest_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                logger.warning("Corrupted manifest detected. Creating new manifest.")
                return self._create_empty_manifest()
        return self._create_empty_manifest()

    def _create_empty_manifest(self) -> Dict:
        """
        Create a new empty manifest structure.

        Returns:
            A dictionary representing the default manifest structure.
        """
        return {
            "version": "1.0",
            "last_sync": None,
            "total_files": 0,
            "total_bytes": 0,
            "dac": self.dac,
            "floats": {},
            "files": {}
        }

    def _save_manifest(self):
        """
        Persist the in-memory manifest to disk (manifest.json) with pretty formatting.
        Ensures parent directories exist.
        """
        self.manifest_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.manifest_file, 'w') as f:
            json.dump(self.manifest, f, indent=2)

    def _is_downloaded(self, file_path: str) -> bool:
        """
        Check whether a file path is already present in the manifest.

        Args:
            file_path: remote path (within ftp_base_path) used as the key in manifest.

        Returns:
            True if the file is recorded in the manifest, False otherwise.
        """
        return file_path in self.manifest.get("files", {})

    def _add_file_to_manifest(self, file_path: str, size_bytes: int, checksum: Optional[str] = None):
        """
        Register a downloaded file in the manifest.

        This updates:
          - manifest['files'][file_path] with download metadata
          - manifest['total_files'] and increments manifest['total_bytes']

        Args:
            file_path: the remote file path used as manifest key.
            size_bytes: size of the downloaded file in bytes.
            checksum: optional checksum string for the file (e.g., MD5/SHA256).
        """
        with self._manifest_lock:
            if "files" not in self.manifest:
                self.manifest["files"] = {}
            
            self.manifest["files"][file_path]={
                "downloaded_at": datetime.now().isoformat(),
                "size_bytes" : size_bytes,
                "checksum" : checksum
            }
            self.manifest["total_files"] = len(self.manifest["files"])
            self.manifest["total_bytes"] = self.manifest.get("total_bytes", 0) + size_bytes
    
    def _add_float_to_manifest(self, float_id: str, file_types: List[str]):
        """
        Register or update float-level metadata in the manifest.

        Adds the float if not present, records the first_seen timestamp, updates
        the set of file_types observed for this float, and records last_updated.

        Args:
            float_id: numeric string identifying the float.
            file_types: list of file type keys (e.g., ['prof', 'meta']) associated with this float.
        """
        if float_id not in self.manifest["floats"]:
            self.manifest["floats"][float_id] = {
                "first_seen": datetime.now().isoformat(),
                "file_types": []
            }

        existing = set(self.manifest["floats"][float_id]["file_types"])
        existing.update(file_types)
        self.manifest["floats"][float_id]["file_types"] = list(existing)
        self.manifest["floats"][float_id]["last_updated"] = datetime.now().isoformat()

    def _parse_profile_index(self, index_content: str) -> Dict[str, List[str]]:
        """
        Parse a CSV-style index listing to extract relevant file paths grouped by float id.

        The expected line format is CSV where the first column is the path. Lines starting with '#'
        or blank lines are skipped. Only paths beginning with '{dac}/' are considered.

        Args:
            index_content: text content of the index file.

        Returns:
            A dictionary mapping float_id -> list of file paths (relative to ftp_base_path).
        """
        floats: Dict[str, List[str]] = {}

        for line in index_content.strip().split('\n'):
            if line.startswith('#') or not line.strip():
                continue

            parts = line.split(',')
            if len(parts) < 2:
                continue

            file_path = parts[0].strip()

            if not file_path.startswith(f"{self.dac}/"):
                continue

            filename = file_path.split('/')[-1]
            file_type = self.file_filter.is_target_file(filename)
            if not file_type:
                continue

            float_id = self.file_filter.extract_float_id(filename)
            if float_id:
                floats.setdefault(float_id, []).append(file_path)

        return floats

    def scan_remote_files(self, directories: List[str], recursive=True, max_depth=10) -> Dict[str, List[str]]:
        """
        Scan remote FTP directories for files matching the configured ARGO file patterns.

        This method uses FTPScanner to find files per extension for each directory,
        then groups found file paths by float id.

        Args:
            directories: list of directories (relative to ftp_base_path) to scan.
            recursive: reserved for future use (FTPScanner controls recursion via max_depth).
            max_depth: maximum recursion depth for FTPScanner.

        Returns:
            A dictionary mapping float_id -> list of remote file paths.
        """
        logger.info("Scanning remote files...")

        float_files: Dict[str, List[str]] = {}

        with self.ftp_connection.connection() as ftp:
            for directory in directories:
                logger.info(f"Scanning directory: {directory}")

                try:
                    full_path = f"{self.ftp_base_path}/{directory}"
                    ftp.cwd(full_path)

                    scanner = FTPScanner(max_depth=max_depth, delay=0.2, verbose=True)

                    all_files: List[str] = []
                    for ext in self.file_filter.get_extensions():
                        files = scanner.find_files(ftp, directory, ext, depth=0)
                        all_files.extend(files)

                    for file_path in all_files:
                        filename = file_path.split('/')[-1]
                        float_id = self.file_filter.extract_float_id(filename)

                        if float_id:
                            float_files.setdefault(float_id, []).append(file_path)

                    logger.info(f"Found {len(all_files)} files in {directory}")
                    ftp.cwd(self.ftp_base_path)

                except Exception as e:
                    logger.error(f"Error scanning {directory}: {e}")

        logger.info(f"Total floats found: {len(float_files)}")
        return float_files

    def _download_file(self, file_path: str) -> Tuple[bool, int]:
        """
        Download a single remote file if not already recorded in the manifest.

        Workflow:
          - If file is already in manifest, return success with 0 bytes (skipped).
          - If local file exists and is non-empty, assume downloaded and register it.
          - Otherwise, create necessary local directories and perform download via FTPDownloader.
          - On success, register file in manifest with size and (optionally) checksum.

        Args:
            file_path: remote file path relative to ftp_base_path.

        Returns:
            Tuple (success: bool, bytes_downloaded: int). For skipped/existing files bytes_downloaded may be 0.
        """
        if self._is_downloaded(file_path):
            return (True, 0)

        local_file_path = self.download_dir / file_path
        if local_file_path.exists() and local_file_path.stat().st_size > 0:
            size = local_file_path.stat().st_size
            self._add_file_to_manifest(file_path, size)
            return (True, 0)

        local_file_path.parent.mkdir(parents=True, exist_ok=True)

        downloader = FTPDownloader(
            max_retries=self.max_retries,
            retry_delay=self.retry_delay
        )

        try:
            ftp = self.ftp_connection.connect()
            remote_path = f"{self.ftp_base_path}/{file_path}"

            success = downloader.download_file(
                ftp,
                remote_path,
                local_file_path,
                skip_existing=False
            )

            if success:
                size = local_file_path.stat().st_size if local_file_path.exists() else 0
                self._add_file_to_manifest(file_path, size)
                logger.info(f"Downloaded: {file_path} ({size} bytes)")
                ftp.quit()
                return True, size

            logger.error(f"Failed: {file_path}")
            ftp.quit()
            return False, 0

        except Exception as e:
            logger.error(f"Error downloading {file_path}: {e}")
            return False, 0

    def sync(self, directories=None, recursive=True, max_depth=10, concurrent=True) -> SyncStats:
        """
        Perform a sync operation: scan remote directories, download missing files, update manifest,
        and return a SyncStats summary.

        Args:
            directories: list of directories relative to ftp_base_path to scan. If None,
                         defaults to ['dac/{self.dac}'].
            recursive: reserved for compatibility; scanner controls recursion.
            max_depth: maximum recursion depth for scanning.
            concurrent: whether to use ThreadPoolExecutor for concurrent downloads.

        Returns:
            SyncStats dictionary summarizing the run.
        """
        if directories is None:
            directories = [f"dac/{self.dac}"]

        sync_start = datetime.now()

        logger.info("=" * 60)
        logger.info(f"Starting sync at {sync_start.isoformat()}")
        logger.info(f"DAC: {self.dac}")
        logger.info(f"File types: {', '.join(self.file_filter.file_types)}")
        logger.info("=" * 60)

        float_files = self.scan_remote_files(directories, recursive, max_depth)

        files_to_download = [
            fp for files in float_files.values() for fp in files
            if not self._is_downloaded(fp)
        ]

        logger.info("=" * 60)
        logger.info(f"Files to download: {len(files_to_download)}")
        logger.info(f"Files already downloaded: {self.manifest.get('total_files', 0)}")
        logger.info("=" * 60)

        if not files_to_download:
            logger.info("No new files to download. Sync complete.")
            sync_end = datetime.now()

            return SyncStats(
                total_floats=len(float_files),
                files_downloaded=0,
                files_skipped=self.manifest.get("total_files", 0),
                files_failed=0,
                bytes_transferred=0,
                duration_seconds=(sync_end - sync_start).total_seconds(),
                sync_start=sync_start.isoformat(),
                sync_end=sync_end.isoformat(),
                new_files=[],
                failed_files=[]
            )

        downloaded_count = 0
        failed_count = 0
        bytes_transferred = 0
        new_files: List[str] = []
        failed_files: List[str] = []

        if concurrent and self.max_workers > 1:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_map = {
                    executor.submit(self._download_file, fp): fp
                    for fp in files_to_download
                }

                for future in as_completed(future_map):
                    file_path = future_map[future]
                    try:
                        success, bytes_dl = future.result()
                        if success and bytes_dl > 0:
                            downloaded_count += 1
                            bytes_transferred += bytes_dl
                            new_files.append(file_path)
                        elif not success:
                            failed_count += 1
                            failed_files.append(file_path)
                    except Exception as e:
                        logger.error(f"Exception while downloading {file_path}: {e}")
                        failed_count += 1
                        failed_files.append(file_path)

                    processed = downloaded_count + failed_count
                    if processed % 10 == 0 or processed == len(files_to_download):
                        logger.info(f"Progress: {processed}/{len(files_to_download)} files processed")

        else:
            for i, file_path in enumerate(files_to_download, 1):
                success, bytes_dl = self._download_file(file_path)
                if success and bytes_dl > 0:
                    downloaded_count += 1
                    bytes_transferred += bytes_dl
                    new_files.append(file_path)
                elif not success:
                    failed_count += 1
                    failed_files.append(file_path)

                if i % 10 == 0 or i == len(files_to_download):
                    logger.info(f"Progress: {i}/{len(files_to_download)} files processed")

        # Update float-level manifest information
        for float_id, files in float_files.items():
            types: List[str] = []
            for fp in files:
                filename = fp.split('/')[-1]
                t = self.file_filter.is_target_file(filename)
                if t:
                    types.append(t)
            if types:
                self._add_float_to_manifest(float_id, types)

        # finalize manifest and save
        self.manifest["last_sync"] = datetime.now().isoformat()
        self._save_manifest()

        sync_end = datetime.now()
        duration = (sync_end - sync_start).total_seconds()

        logger.info("=" * 60)
        logger.info("SYNC SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total floats: {len(float_files)}")
        logger.info(f"Files downloaded: {downloaded_count}")
        logger.info(f"Files skipped: {self.manifest.get('total_files', 0) - downloaded_count}")
        logger.info(f"Files failed: {failed_count}")
        logger.info(f"Bytes transferred: {bytes_transferred:,} ({bytes_transferred / (1024**2):.2f} MB)")
        logger.info(f"Duration: {duration:.2f} seconds")
        if duration > 0:
            logger.info(f"Download rate: {downloaded_count / duration:.2f} files/sec")
        logger.info("=" * 60)

        return SyncStats(
            total_floats=len(float_files),
            files_downloaded=downloaded_count,
            files_skipped=self.manifest.get("total_files", 0) - downloaded_count,
            files_failed=failed_count,
            bytes_transferred=bytes_transferred,
            duration_seconds=duration,
            sync_start=sync_start.isoformat(),
            sync_end=sync_end.isoformat(),
            new_files=new_files,
            failed_files=failed_files
        )

    def test_connection(self) -> bool:
        """
        Test connectivity to the configured FTP server using FTPConnection.test_connection().

        Returns:
            True if connection succeeds, False otherwise.
        """
        return self.ftp_connection.test_connection()

    def get_manifest_stats(self) -> Dict:
        """
        Get a compact summary of current manifest statistics.

        Returns:
            Dictionary with keys: total_files, total_bytes, total_floats, last_sync.
        """
        return {
            "total_files": self.manifest.get("total_files", 0),
            "total_bytes": self.manifest.get("total_bytes", 0),
            "total_floats": len(self.manifest.get("floats", {})),
            "last_sync": self.manifest.get("last_sync")
        }

    def get_float_info(self, float_id: str) -> Optional[Dict]:
        """
        Retrieve manifest information for a specific float id.

        Args:
            float_id: float identifier string.

        Returns:
            A dictionary containing float metadata and file list if present, otherwise None.
            Dictionary keys include: float_id, file_types, first_seen, last_updated, total_files, files.
        """
        floats = self.manifest.get("floats", {})
        if float_id in floats:
            float_data = floats[float_id]
            files = [f for f in self.manifest.get("files", {}).keys() if float_id in f]
            return {
                "float_id": float_id,
                "file_types": float_data["file_types"],
                "first_seen": float_data["first_seen"],
                "last_updated": float_data.get("last_updated"),
                "total_files": len(files),
                "files": files
            }
        return None

    def list_floats(self) -> List[str]:
        """
        List all float ids currently recorded in the manifest.

        Returns:
            List of float id strings.
        """
        return list(self.manifest.get("floats", {}).keys())

    def reset_manifest(self):
        """
        Reset the manifest to an empty state and persist it to disk.

        Use with caution: this removes all record of previously downloaded files.
        """
        logger.warning("Resetting manifest...")
        self.manifest = self._create_empty_manifest()
        self._save_manifest()
        logger.info("Manifest reset complete.")


if __name__ == "__main__":
    FTP_HOST = "ftp.ifremer.fr"
    FTP_BASE_PATH = "/ifremer/argo"

    sync_worker = FTPSyncWorker(
        ftp_host=FTP_HOST,
        ftp_base_path=FTP_BASE_PATH,
        cache_path=Path("argo_cache"),
        dac="incois",
        max_workers=3,
        file_types=['prof', 'meta', 'tech', 'rtraj']
    )

    if not sync_worker.test_connection():
        logger.error("Failed to connect to FTP server!")
        exit(1)

    stats = sync_worker.sync(recursive=True, concurrent=True)

    logger.info("Manifest Statistics:")
    for key, value in sync_worker.get_manifest_stats().items():
        logger.info(f"{key}: {value}")

    floats = sync_worker.list_floats()
    logger.info(f"Total floats tracked: {len(floats)}")

    if floats:
        info = sync_worker.get_float_info(floats[0])
        if info:
            logger.info(f"Float {info['float_id']} info: {info}")
