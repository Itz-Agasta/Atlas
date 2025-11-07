"""FTP Sync Worker for downloading ARGO data from data-argo.ifremer.fr."""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional, TypedDict

import httpx

from ..config import settings
from ..utils import get_logger

logger = get_logger(__name__)


class SyncStats(TypedDict):
    """Statistics for sync operations."""

    total_floats: int
    files_downloaded: int
    files_skipped: int
    bytes_downloaded: int
    errors: int
    start_time: str
    end_time: str


class FTPSyncWorker:
    """Download and sync ARGO data from remote server."""

    def __init__(
        self,
        ftp_server: str = settings.FTP_SERVER,
        dac: str = settings.ARGO_DAC,
        cache_path: Optional[Path] = None,
    ):
        """Initialize FTP sync worker.

        Args:
            ftp_server: FTP server address
            dac: Data Assembly Center (e.g., 'incois')
            cache_path: Local cache directory path
        """
        self.ftp_server = ftp_server
        self.dac = dac
        self.cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)
        self.cache_path.mkdir(parents=True, exist_ok=True)

        # Manifest to track downloaded files
        self.manifest_file = self.cache_path / "manifest.json"
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> dict:
        """Load download manifest."""
        if self.manifest_file.exists():
            with open(self.manifest_file) as f:
                return json.load(f)
        return {"files": {}, "last_sync": None}

    def _save_manifest(self) -> None:
        """Save download manifest."""
        with open(self.manifest_file, "w") as f:
            json.dump(self.manifest, f, indent=2, default=str)

    async def _fetch_index_http(self, index_file: str) -> str:
        """Fetch index file via HTTPS (fallback to HTTP).

        Args:
            index_file: Index file name (ar_index_global_prof.txt, etc)

        Returns:
            Index file content
        """
        url = f"{settings.HTTP_BASE_URL}/{index_file}"
        logger.info("Fetching index", url=url)

        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
            for attempt in range(settings.HTTP_MAX_RETRIES):
                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    logger.info("Index fetched successfully", size=len(response.text))
                    return response.text
                except httpx.HTTPError as e:
                    if attempt < settings.HTTP_MAX_RETRIES - 1:
                        logger.warning(
                            "Retry HTTP request",
                            attempt=attempt + 1,
                            error=str(e),
                        )
                        await asyncio.sleep(settings.FTP_RETRY_DELAY)
                    else:
                        logger.error(
                            "Failed to fetch index after retries", error=str(e)
                        )
                        raise

    def _parse_profile_index(self, index_content: str) -> dict[str, list[dict]]:
        """Parse ar_index_global_prof.txt into float data.

        Returns:
            Dict mapping float_ids to list of profile file info
        """
        floats = {}
        lines = index_content.strip().split("\n")

        # Skip header lines (lines starting with '#')
        for line in lines:
            if line.startswith("#") or not line.strip():
                continue

            # Format: file path | date | update
            parts = line.split("|")
            if len(parts) < 2:
                continue

            file_path = parts[0].strip()

            # Extract DAC and float ID from path like: dac/incois/2902224/2902224_prof.nc
            path_parts = file_path.split("/")
            if len(path_parts) < 4:  # Need at least dac/incois/float_id/file
                continue

            dac_name = path_parts[1]  # Index 1 is DAC name (after "dac")
            float_id = path_parts[2]  # Index 2 is float ID

            if dac_name != self.dac:
                continue

            if float_id not in floats:
                floats[float_id] = []

            floats[float_id].append(
                {
                    "file_path": file_path,
                    "date": parts[1].strip() if len(parts) > 1 else None,
                    "size": None,  # Size not always in index
                }
            )

        logger.info("Parsed profile index", total_floats=len(floats))
        return floats

    async def _download_file(self, file_path: str, dest_path: Path) -> bool:
        """Download single file via HTTPS.

        Args:
            file_path: Remote file path
            dest_path: Local destination path

        Returns:
            True if successful, False otherwise
        """
        url = f"{settings.HTTP_BASE_URL}/{file_path}"

        try:
            logger.info("Downloading file", url=url, dest=str(dest_path))

            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()

                    # Ensure parent directory exists
                    dest_path.parent.mkdir(parents=True, exist_ok=True)

                    # Download with progress
                    total = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    with open(dest_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                            downloaded += len(chunk)

                            if (
                                total > 0 and downloaded % (1024 * 100) == 0
                            ):  # Log every 100KB
                                progress = (downloaded / total) * 100
                                logger.debug(
                                    "Download progress",
                                    file=file_path,
                                    progress=f"{progress:.1f}%",
                                )

            logger.info(
                "File downloaded successfully", dest=str(dest_path), size=downloaded
            )
            return True

        except httpx.HTTPError as e:
            logger.error("Download failed", file_path=file_path, error=str(e))
            return False

    async def sync(self, float_ids: Optional[list[str]] = None) -> SyncStats:
        """Sync ARGO data from remote server.

        Args:
            float_ids: Specific float IDs to sync (None = all new)

        Returns:
            Sync result statistics
        """
        logger.info("Starting ARGO data sync", dac=self.dac)

        try:
            # Fetch global profile index
            index_content = await self._fetch_index_http("ar_index_global_prof.txt")

            # Parse index to get all floats and files
            floats_data = self._parse_profile_index(index_content)

            # Filter to requested floats
            if float_ids:
                floats_data = {k: v for k, v in floats_data.items() if k in float_ids}

            # Download new/updated files
            stats: SyncStats = {
                "total_floats": len(floats_data),
                "files_downloaded": 0,
                "files_skipped": 0,
                "bytes_downloaded": 0,
                "errors": 0,
                "start_time": datetime.now(UTC).isoformat(),
                "end_time": "",
            }

            # Process floats concurrently
            tasks = [
                self._sync_float(float_id, file_list)
                for float_id, file_list in floats_data.items()
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    logger.error("Sync error", error=str(result))
                    stats["errors"] += 1
                elif isinstance(result, dict):
                    stats["files_downloaded"] += result.get("downloaded", 0)
                    stats["files_skipped"] += result.get("skipped", 0)
                    stats["bytes_downloaded"] += result.get("bytes", 0)

            # Update manifest
            self.manifest["last_sync"] = datetime.now(UTC).isoformat()
            self._save_manifest()

            stats["end_time"] = datetime.now(UTC).isoformat()
            logger.info("Sync completed", stats=stats)
            return stats

        except Exception as e:
            logger.error("Sync failed", error=str(e))
            raise

    async def _sync_float(self, float_id: str, file_list: list[dict]) -> dict:
        """Sync specific float data.

        Args:
            float_id: Float ID
            file_list: List of file info to download

        Returns:
            Download statistics
        """
        result = {"downloaded": 0, "skipped": 0, "bytes": 0}

        for file_info in file_list:
            file_path = file_info["file_path"]
            local_path = self.cache_path / file_path

            # Check if file already exists (incremental sync)
            if settings.ENABLE_INCREMENTAL_SYNC and local_path.exists():
                logger.debug("File already exists, skipping", file=file_path)
                result["skipped"] += 1
                continue

            # Download file
            success = await self._download_file(file_path, local_path)
            if success:
                result["downloaded"] += 1
                result["bytes"] += local_path.stat().st_size

                # Update manifest
                self.manifest["files"][str(local_path)] = {
                    "float_id": float_id,
                    "downloaded_at": datetime.now(UTC).isoformat(),
                    "size": local_path.stat().st_size,
                }
            else:
                result["skipped"] += 1

        return result


async def main() -> None:
    """Example usage of FTP Sync Worker."""
    from ..utils import setup_logging

    setup_logging()

    worker = FTPSyncWorker()

    # Sync specific floats for testing
    result = await worker.sync(float_ids=["2902224"])
    print(f"\nSync Result:\n{json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
