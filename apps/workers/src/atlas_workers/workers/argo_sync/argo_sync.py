import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional, TypedDict

import httpx

from ...config import settings
from ...utils import get_logger

logger = get_logger(__name__)


class SyncStats(TypedDict):
    total_floats: int
    files_downloaded: int
    files_skipped: int
    bytes_downloaded: int
    errors: int
    start_time: str
    end_time: str


class ArgoSyncWorker:
    """Download and sync ARGO data from data-argo.ifremer.fr via HTTPS.

    Downloads aggregate files ({float_id}_prof.nc, _meta.nc, etc.) which
    contain all profiles in a single file.
    """

    def __init__(
        self,
        dac: str = settings.ARGO_DAC,
        cache_path: Optional[Path] = None,
    ):
        self.dac = dac
        self.cache_path = Path(cache_path or settings.LOCAL_CACHE_PATH)
        self.cache_path.mkdir(parents=True, exist_ok=True)

        # Concurrency control
        self.semaphore = asyncio.Semaphore(10)

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
                        await asyncio.sleep(settings.HTTP_RETRY_DELAY)
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

            # Format: file_path,date,latitude,longitude,ocean,profiler_type,institution,date_update
            parts = line.split(",")
            if len(parts) < 8:  # Need at least 8 fields
                continue

            file_path = parts[0].strip()

            # Extract DAC and float ID from path like: incois/1900121/profiles/D1900121_001.nc
            path_parts = file_path.split("/")
            if len(path_parts) < 2:  # Need at least dac/float_id
                continue

            dac_name = path_parts[0]  # First part is DAC name
            float_id = path_parts[1]  # Second part is float ID

            if dac_name != self.dac:
                continue

            if float_id not in floats:
                floats[float_id] = []

            # Optimization: If only aggregate files are needed, we don't need individual profile details
            if not settings.USE_AGGREGATE_ONLY:
                floats[float_id].append(
                    {
                        "file_path": file_path,
                        "date": parts[1].strip() if len(parts) > 1 else None,
                        "latitude": parts[2].strip() if len(parts) > 2 else None,
                        "longitude": parts[3].strip() if len(parts) > 3 else None,
                        "ocean": parts[4].strip() if len(parts) > 4 else None,
                        "profiler_type": parts[5].strip() if len(parts) > 5 else None,
                        "institution": parts[6].strip() if len(parts) > 6 else None,
                        "date_update": parts[7].strip() if len(parts) > 7 else None,
                    }
                )

        logger.info("Parsed profile index", total_floats=len(floats))
        return floats

    async def _fetch_aggregate_files(self, float_id: str) -> list[dict]:
        """Fetch aggregate files (meta, tech, prof, Rtraj) for a float.

        Args:
            float_id: ARGO float ID

        Returns:
            List of aggregate file info dicts
        """
        aggregate_files = []

        # Define aggregate file types
        aggregate_types = [
            f"{float_id}_meta.nc",
            f"{float_id}_tech.nc",
            f"{float_id}_prof.nc",
            f"{float_id}_Rtraj.nc",
        ]

        for file_name in aggregate_types:
            file_path = f"{self.dac}/{float_id}/{file_name}"
            aggregate_files.append(
                {
                    "file_path": file_path,
                    "file_name": file_name,
                    "type": file_name.split("_")[1].replace(".nc", ""),
                }
            )

        logger.info(
            "Found aggregate files",
            float_id=float_id,
            count=len(aggregate_files),
        )
        return aggregate_files

    async def _download_file(self, file_path: str, dest_path: Path) -> bool:
        """Download single file via HTTPS.

        Args:
            file_path: Remote file path
            dest_path: Local destination path

        Returns:
            True if successful, False otherwise
        """
        url = f"{settings.HTTP_BASE_URL}/dac/{file_path}"

        try:
            async with self.semaphore:
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
            # Step 1: Fetch global index (~30s for full index, cached locally)
            index_content = await self._fetch_index_http("ar_index_global_prof.txt")

            # Step 2: Parse index - only extracts float IDs when USE_AGGREGATE_ONLY=True
            floats_data = self._parse_profile_index(index_content)

            # Step 3: Filter to requested floats (if specified)
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
        """Sync specific float data - aggregate files only (optimized).

        OPTIMIZATION: Only downloads aggregate files (_prof.nc, _meta.nc, etc.)
        which contain ALL data. Individual profile files are redundant.

        Args:
            float_id: Float ID
            file_list: List of file info (ignored when USE_AGGREGATE_ONLY=True)

        Returns:
            Download statistics
        """
        result = {"downloaded": 0, "skipped": 0, "bytes": 0}

        async def process_file(file_info: dict, is_aggregate: bool = False):
            file_path = file_info["file_path"]
            local_path = self.cache_path / file_path

            # Check if file already exists (incremental sync)
            # Bypass with FORCE_REDOWNLOAD for benchmarking
            if (
                not settings.FORCE_REDOWNLOAD
                and settings.ENABLE_INCREMENTAL_SYNC
                and local_path.exists()
            ):
                logger.debug("File already exists, skipping", file=file_path)
                return {"skipped": 1}

            # Download file
            success = await self._download_file(file_path, local_path)
            if success:
                # Update manifest
                self.manifest["files"][str(local_path)] = {
                    "float_id": float_id,
                    "type": file_info.get("type", "aggregate")
                    if is_aggregate
                    else "profile",
                    "downloaded_at": datetime.now(UTC).isoformat(),
                    "size": local_path.stat().st_size,
                }
                return {"downloaded": 1, "bytes": local_path.stat().st_size}
            else:
                return {"skipped": 1}

        # Get aggregate files (always needed)
        aggregate_files = await self._fetch_aggregate_files(float_id)
        tasks = [process_file(f, is_aggregate=True) for f in aggregate_files]

        # Only download individual profiles if USE_AGGREGATE_ONLY is False
        if not settings.USE_AGGREGATE_ONLY:
            tasks.extend([process_file(f, is_aggregate=False) for f in file_list])
        else:
            logger.info(
                "Skipping individual profile downloads (USE_AGGREGATE_ONLY=True)",
                float_id=float_id,
                skipped_files=len(file_list),
            )

        # Execute all downloads concurrently
        file_results = await asyncio.gather(*tasks)

        # Aggregate results
        for r in file_results:
            result["downloaded"] += r.get("downloaded", 0)
            result["skipped"] += r.get("skipped", 0)
            result["bytes"] += r.get("bytes", 0)

        return result
