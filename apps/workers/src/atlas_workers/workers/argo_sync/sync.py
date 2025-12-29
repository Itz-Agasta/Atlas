import asyncio
import json
from pathlib import Path
from typing import Optional

import asyncpg
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
        logger.debug("Float download completed", float_id=float_id, downloaded=success_count)
        return success_count >= 1  # At least one file downloaded

    # Sync All floats - Concurrently sync multiple floats, each running their own `sync` (with semaphore to cap total concurrency).
    async def syncAll(self) -> dict:
        """Full DAC sync - downloads all floats from ar_index_global_meta.txt.

        Uses a manifest to track progress for resumable downloads.
        """
        logger.info("Starting full DAC sync", dac=self.dac_name)

        # Download and parse global meta index
        logger.info("Downloading global meta index", url=INDEX_GLOBAL_META)
        content = await self._download_index(INDEX_GLOBAL_META)
        all_floats = self._parse_index_for_floats(content)
        logger.info("Found floats in index", count=len(all_floats), dac=self.dac_name)

        # Load manifest and determine what needs downloading
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

        # Concurrent downloads with semaphore
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        new_downloads = 0
        failed_downloads = 0

        async def download_with_limit(float_id: str) -> tuple[str, bool]:
            async with semaphore:
                try:
                    success = await self.sync(float_id)
                    return float_id, success
                except Exception as e:
                    logger.error("Float download failed", float_id=float_id, error=str(e))
                    return float_id, False

        # Run all downloads concurrently
        tasks = [download_with_limit(fid) for fid in pending_floats]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, BaseException):
                failed_downloads += 1
                continue
            float_id, success = result
            if success:
                manifest["downloaded"].append(float_id)
                # Remove from failed list if it was previously marked as failed
                if float_id in manifest["failed"]:
                    manifest["failed"].remove(float_id)
                new_downloads += 1
            else:
                manifest["failed"].append(float_id)
                failed_downloads += 1

            # Save manifest after each batch for resumability
            if (new_downloads + failed_downloads) % 10 == 0:
                self._save_manifest(manifest)

        # Final save
        self._save_manifest(
            manifest
        )  # TODO: We are tracking faild floats already. so we need a @retry like https://alexwlchan.net/2020/downloading-files-with-python/ to run the syncAll again if any error happends.

        logger.info(
            "Full DAC sync completed",
            total=len(all_floats),
            new_downloads=new_downloads,
            failed=failed_downloads,
        )

        return {
            "total": len(all_floats),
            "downloaded": len(manifest["downloaded"]),
            "new": new_downloads,
            "failed": failed_downloads,
        }

# TODO: will run upadte() as a corn job every weekly -- downalod the weekly prof extract the floats and insert into the db. Thats all
    async def update(self, db_url: Optional[str] = None) -> dict:
        """Cron update - compares ar_index_this_week_prof.txt with DB and syncs new floats.

        This is designed to run as a Lambda cron job.
        """
        logger.info("Starting weekly update", dac=self.dac_name)

        # Download and parse weekly index
        logger.info("Downloading weekly index", url=INDEX_THIS_WEEK_PROF)
        content = await self._download_index(INDEX_THIS_WEEK_PROF)
        weekly_floats = self._parse_index_for_floats(content)
        logger.info(
            "Found floats in weekly index", count=len(weekly_floats), dac=self.dac_name
        )

        if not weekly_floats:
            logger.info("No floats to update for this DAC")
            return {"checked": 0, "new": 0, "updated": 0}

        # Get already synced floats from database
        db_connection_url = db_url or settings.PG_WRITE_URL
        if not db_connection_url:
            logger.warning("No database URL configured, syncing all weekly floats")
            synced_floats: set[str] = set()
        else:
            synced_floats = await self._get_synced_floats(db_connection_url)

        # Determine which floats need syncing
        floats_to_sync = weekly_floats - synced_floats
        logger.info(
            "Update status",
            weekly_total=len(weekly_floats),
            already_synced=len(synced_floats & weekly_floats),
            to_sync=len(floats_to_sync),
        )

        if not floats_to_sync:
            logger.info("All weekly floats already synced - up to date!")
            return {
                "checked": len(weekly_floats),
                "new": 0,
                "already_synced": len(weekly_floats),
            }

        # Concurrent downloads
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        synced_count = 0
        failed_count = 0

        async def download_with_limit(float_id: str) -> tuple[str, bool]:
            async with semaphore:
                try:
                    success = await self.sync(float_id)
                    return float_id, success
                except Exception as e:
                    logger.error("Float sync failed", float_id=float_id, error=str(e))
                    return float_id, False

        tasks = [download_with_limit(fid) for fid in floats_to_sync]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        synced_float_ids: list[str] = []
        for result in results:
            if isinstance(result, BaseException):
                failed_count += 1
                continue
            float_id, success = result
            if success:
                synced_count += 1
                synced_float_ids.append(float_id)
            else:
                failed_count += 1

        # Log to database if available
        if db_connection_url and synced_float_ids:
            await self._log_sync_to_db(db_connection_url, synced_float_ids)

        logger.info(
            "Weekly update completed",
            checked=len(weekly_floats),
            synced=synced_count,
            failed=failed_count,
        )

        return {
            "checked": len(weekly_floats),
            "new": synced_count,
            "failed": failed_count,
        }

    async def _get_synced_floats(self, db_url: str) -> set[str]:
        """Query processing_log to get already synced float IDs."""
        try:
            conn = await asyncpg.connect(db_url)
            try:
                rows = await conn.fetch(
                    """
                    SELECT DISTINCT float_id::text
                    FROM processing_log
                    WHERE status = 'SUCCESS'
                    AND operation IN ('FULL SYNC', 'WEEKLY UPDATE')
                    """
                )
                return {row["float_id"] for row in rows if row["float_id"]}
            finally:
                await conn.close()
        except Exception as e:
            logger.error("Failed to query database", error=str(e))
            return set()

    async def _log_sync_to_db(self, db_url: str, float_ids: list[str]) -> None:
        """Log successful syncs to processing_log table."""
        try:
            conn = await asyncpg.connect(db_url)
            try:
                await conn.executemany(
                    """
                    INSERT INTO processing_log (float_id, operation, status)
                    VALUES ($1::bigint, 'WEEKLY UPDATE', 'SUCCESS')
                    """,
                    [(int(fid),) for fid in float_ids if fid.isdigit()],
                )
                logger.info("Logged sync to database", count=len(float_ids))
            finally:
                await conn.close()
        except Exception as e:
            logger.error("Failed to log to database", error=str(e))
