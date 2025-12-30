import asyncio
import json
from pathlib import Path
from typing import Optional

import httpx

from ... import get_logger, settings

logger = get_logger(__name__)

# Global index URLs
INDEX_GLOBAL_META = f"{settings.HTTP_BASE_URL}/ar_index_global_meta.txt"
INDEX_THIS_WEEK_PROF = f"{settings.HTTP_BASE_URL}/ar_index_this_week_prof.txt"

# Concurrency limit for downloads
MAX_CONCURRENT_DOWNLOADS = 10


class ArgoSyncWorker:
    def __init__(self, dac: str = settings.ARGO_DAC, stage_path: Optional[Path] = None):
        self.dac_name = dac
        self.stage_path = (
            Path(stage_path) if stage_path else Path(settings.LOCAL_STAGE_PATH)
        )
        self.stage_path.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.stage_path / "sync_manifest.json"

    # utility methods
    def _load_manifest(self) -> dict:
        """Load manifest tracking downloaded floats."""
        if self.manifest_path.exists():
            with open(self.manifest_path) as f:
                return json.load(f)
        return {"downloaded": [], "failed": []}

    def _save_manifest(self, manifest: dict) -> None:
        """Save manifest to disk."""
        with open(self.manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

    async def _download_index(self, url: str) -> str:
        """Download and return index file content."""
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text

    def _parse_index_for_floats(self, content: str) -> set[str]:
        """Parse index CSV and extract unique float IDs for our DAC.

        Index format: file,date,latitude,longitude,ocean,profiler_type,institution,date_update
        File path format: dac_name/float_id/... or dac_name/float_id/profiles/...
        """
        float_ids: set[str] = set()
        for line in content.splitlines():
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split(",")
            if not parts:
                continue
            file_path = parts[0]
            path_parts = file_path.split("/")
            if len(path_parts) >= 2 and path_parts[0] == self.dac_name:
                float_ids.add(path_parts[1])
        return float_ids

    # sync a single float - Concurrently downloads 4 files for that one float using `gather`.
    async def sync(self, float_id: str) -> bool:
        """Sync the 4 core ARGO files for a specific float concurrently."""
        logger.debug("Starting float download", float_id=float_id)

        files = [
            f"{float_id}_meta.nc",
            f"{float_id}_tech.nc",
            f"{float_id}_prof.nc",
            f"{float_id}_Rtraj.nc",
        ]

        float_dir = self.stage_path / float_id
        float_dir.mkdir(parents=True, exist_ok=True)

        async def _download_file(client: httpx.AsyncClient, filename: str) -> bool:
            """Download a single file, return True if successful."""
            url = f"{settings.HTTP_BASE_URL}/dac/{self.dac_name}/{float_id}/{filename}"

            try:
                async with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    file_path = float_dir / filename
                    with open(file_path, "wb") as f:
                        async for chunk in resp.aiter_bytes():
                            f.write(chunk)  # Ref: https://www.python-httpx.org/async/
                    logger.debug("Downloaded", file=filename)
                    return True

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.debug("File not found (optional)", file=filename)
                else:
                    logger.error("Failed to download", file=filename, error=str(e))
                return False
            except Exception as e:
                logger.error("Failed to download", file=filename, error=str(e))
                return False

        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT) as client:
            results = await asyncio.gather(
                *[_download_file(client, f) for f in files]
            )  # Ref: https://stackoverflow.com/a/61550673/28193141

        success_count = sum(results)
        logger.debug(
            "Float download completed", float_id=float_id, downloaded=success_count
        )
        return success_count >= 1  # At least one file downloaded

    # concurrently downalod multiple floats form DAC - each running their own `sync` (with semaphore to cap total concurrency).
    async def _sync_floats_concurrent(
        self, float_ids: set[str]
    ) -> tuple[list[str], list[str]]:
        """Concurrently sync floats with semaphore limit.

        Args:
            float_ids: Set of float IDs to sync

        Returns:
            Tuple of (successful_float_ids, failed_float_ids)
        """
        if not float_ids:
            return [], []

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        successful: list[str] = []
        failed: list[str] = []

        async def download_with_limit(float_id: str) -> tuple[str, bool]:
            async with semaphore:
                try:
                    success = await self.sync(float_id)
                    return float_id, success
                except Exception as e:
                    logger.error("Float sync failed", float_id=float_id, error=str(e))
                    return float_id, False

        tasks = [download_with_limit(fid) for fid in float_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, BaseException):
                failed.append(str(result))
                continue
            float_id, success = result
            if success:
                successful.append(float_id)
            else:
                failed.append(float_id)

        return successful, failed

    # Sync All floats form DAC
    async def syncAll(self) -> dict:
        """Full DAC sync - downloads all floats from ar_index_global_meta.txt.

        Uses a manifest to track progress for resumable downloads.
        """
        logger.info("Starting full DAC sync", dac=self.dac_name)

        # 1. Download and parse global meta index
        logger.info("Downloading global meta index", url=INDEX_GLOBAL_META)
        content = await self._download_index(INDEX_GLOBAL_META)
        all_floats = self._parse_index_for_floats(content)
        logger.info("Found floats in index", count=len(all_floats), dac=self.dac_name)

        # 2. Load manifest and determine what needs downloading
        manifest = self._load_manifest()
        already_downloaded = set(manifest["downloaded"])
        pending_floats = all_floats - already_downloaded

        logger.info(
            "Sync status",
            total=len(all_floats),
            already_downloaded=len(already_downloaded),
            pending=len(pending_floats),
        )

        if not pending_floats:
            logger.info("All floats already downloaded")
            return {
                "total": len(all_floats),
                "downloaded": len(already_downloaded),
                "new": 0,
                "failed": 0,
            }

        # 3. Run concurrent downloads
        successful_floats, failed_floats = await self._sync_floats_concurrent(
            pending_floats
        )

        # 4. Update manifest
        for float_id in successful_floats:
            manifest["downloaded"].append(float_id)
            # Remove from failed list if it was previously marked as failed
            if float_id in manifest["failed"]:
                manifest["failed"].remove(float_id)

        for float_id in failed_floats:
            if float_id not in manifest["failed"]:
                manifest["failed"].append(float_id)

        # Save manifest
        self._save_manifest(
            manifest
        )  # TODO: We are tracking faild floats already. so we need a @retry like https://alexwlchan.net/2020/downloading-files-with-python/ to run the syncAll again if any error happends.

        logger.info(
            "Full DAC sync completed",
            total=len(all_floats),
            new_downloads=len(successful_floats),
            failed=len(failed_floats),
        )

        return {
            "total": len(all_floats),
            "downloaded": len(manifest["downloaded"]),
            "new": len(successful_floats),
            "failed": len(failed_floats),
        }

    # TODO: will run upadte() as a corn job every weekly -- same as syncAll just download INDEX_THIS_WEEK_PROF.txt
    async def update(self) -> dict:
        """Cron update - downlaod the weekly updated floats avalible in ar_index_this_week_prof.txt

        This is designed to run as a Lambda cron job.
        """
        logger.info("Starting weekly update", dac=self.dac_name)

        # 1. Download and parse weekly index
        logger.info("Downloading weekly index", url=INDEX_THIS_WEEK_PROF)
        content = await self._download_index(INDEX_THIS_WEEK_PROF)
        weekly_floats = self._parse_index_for_floats(content)
        logger.info(
            "Found floats in weekly index", count=len(weekly_floats), dac=self.dac_name
        )

        if not weekly_floats:
            logger.info("No floats to update for this DAC")
            return {
                "total": 0,
                "downloaded": 0,
                "new": 0,
                "failed": 0,
            }

        # 2. Load manifest and detrmine what needs to downlaod
        manifest = self._load_manifest()
        already_downloaded = set(manifest["downloaded"])
        pending_floats = weekly_floats - already_downloaded

        logger.info(
            " Weekly sync status",
            total=len(weekly_floats),
            already_downloaded=len(already_downloaded),
            pending=len(pending_floats),
        )

        if not pending_floats:
            logger.info("All floats already downloaded")
            return {
                "total": len(weekly_floats),
                "downloaded": len(already_downloaded),
                "new": 0,
                "failed": 0,
            }

        # 3. Run concurrent downloads
        successful_floats, failed_floats = await self._sync_floats_concurrent(
            pending_floats
        )

        # 4. Update manifest
        for float_id in successful_floats:
            manifest["downloaded"].append(float_id)
            # Remove from failed list if it was previously marked as failed
            if float_id in manifest["failed"]:
                manifest["failed"].remove(float_id)

        for float_id in failed_floats:
            if float_id not in manifest["failed"]:
                manifest["failed"].append(float_id)

        # Save manifest
        self._save_manifest(
            manifest
        )  # TODO: We are tracking faild floats already. so we need a @retry like https://alexwlchan.net/2020/downloading-files-with-python/ to run the syncAll again if any error happends.

        logger.info(
            "weekly sync completed",
            total=len(weekly_floats),
            new_downloads=len(successful_floats),
            failed=len(failed_floats),
        )

        return {
            "total": len(weekly_floats),
            "downloaded": len(manifest["downloaded"]),
            "new": len(successful_floats),
            "failed": len(failed_floats),
        }
