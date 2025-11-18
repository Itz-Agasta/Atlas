"""FTP batch operations for concurrent downloads and bulk transfers."""

import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Callable, Dict, Any

from ...utils.logging import get_logger

logger = get_logger(__name__)

class FTPBatchDownloader:
    """Batch downloader for multiple files with concurrency support."""

    def __init__(
        self,
        connection_factory: Callable[[], Any],
        max_workers: int = 3,
        download_dir: str = "downloads"
    ) -> None:
        """
        Initialize batch downloader.

        Args:
            connection_factory: Function that returns a new FTP connection
            max_workers: Number of concurrent download threads
            download_dir: Base directory for downloads
        """
        self.connection_factory = connection_factory
        self.max_workers = max_workers
        self.download_dir = Path(download_dir)
        try:
            self.download_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create download directory '{self.download_dir}': {e}")

    def download_single_threaded(
        self,
        file_paths: List[str],
        base_path: str = "",
        max_retries: int = 3,
        retry_delay: float = 2.0
    ) -> Dict[str, Any]:
        """
        Download files sequentially (single-threaded).

        Args:
            file_paths: List of relative file paths to download
            base_path: Base path on FTP server
            max_retries: Maximum retry attempts per file
            retry_delay: Delay between retries

        Returns:
            dict: Statistics with 'successful', 'failed', 'total', 'duration'
        """
        from .ftp_downloader import FTPDownloader

        successful = 0
        failed = 0
        start_time = time.time()

        ftp = None
        try:
            ftp = self.connection_factory()
            downloader = FTPDownloader(max_retries, retry_delay)
            for file_path in file_paths:
                remote_path = f"{base_path}/{file_path}" if base_path else file_path
                local_path = self.download_dir / file_path

                try:
                    result = downloader.download_file(ftp, remote_path, local_path)
                    if result:
                        successful += 1
                    else:
                        failed += 1
                except Exception as e:
                    logger.error(f"Exception downloading {file_path}: {e}")
                    failed += 1

                logger.info(f"Progress: {successful + failed}/{len(file_paths)} files processed")

        except Exception as e:
            logger.error(f"Error initializing FTP connection: {e}")
        finally:
            if ftp:
                try:
                    ftp.quit()
                except Exception as e:
                    logger.warning(f"Error quitting FTP connection: {e}")
                    try:
                        ftp.close()
                    except Exception as inner_e:
                        logger.warning(f"Error closing FTP connection: {inner_e}")

        duration = time.time() - start_time

        return {
            'successful': successful,
            'failed': failed,
            'total': len(file_paths),
            'duration': duration
        }

    def download_concurrent(
        self,
        file_paths: List[str],
        base_path: str = "",
        max_retries: int = 3,
        retry_delay: float = 2.0
    ) -> Dict[str, Any]:
        """
        Download files concurrently using thread pool.

        Args:
            file_paths: List of relative file paths to download
            base_path: Base path on FTP server
            max_retries: Maximum retry attempts per file
            retry_delay: Delay between retries

        Returns:
            dict: Statistics with 'successful', 'failed', 'total', 'duration'
        """
        from .ftp_downloader import FTPDownloader

        successful = 0
        failed = 0
        start_time = time.time()

        def download_task(file_path: str) -> bool:
            """Task to download a single file with its own FTP connection."""
            ftp = None
            try:
                ftp = self.connection_factory()
                downloader = FTPDownloader(max_retries, retry_delay)
                remote_path = f"{base_path}/{file_path}" if base_path else file_path
                local_path = self.download_dir / file_path
                return downloader.download_file(ftp, remote_path, local_path)
            except Exception as e:
                logger.error(f"Exception in download_task for {file_path}: {e}")
                return False
            finally:
                if ftp:
                    try:
                        ftp.quit()
                    except Exception as e:
                        logger.warning(f"Error quitting FTP connection: {e}")
                        try:
                            ftp.close()
                        except Exception as inner_e:
                            logger.warning(f"Error closing FTP connection: {inner_e}")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(download_task, file_path): file_path
                for file_path in file_paths
            }

            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    result = future.result()
                    if result:
                        successful += 1
                    else:
                        failed += 1
                except Exception as e:
                    logger.error(f"Exception for {file_path}: {e}")
                    failed += 1

                logger.info(f"Progress: {successful + failed}/{len(file_paths)} files processed")

        duration = time.time() - start_time

        return {
            'successful': successful,
            'failed': failed,
            'total': len(file_paths),
            'duration': duration
        }

    def print_summary(self, stats: Dict[str, Any]) -> None:
        """Print download summary statistics."""
        logger.info("\nDownload Summary")
        logger.info(f"Total files: {stats['total']}")
        logger.info(f"Successful: {stats['successful']}")
        logger.info(f"Failed: {stats['failed']}")
        logger.info(f"Time taken: {stats['duration']:.2f} seconds")
        if stats['duration'] > 0:
            rate = stats['successful'] / stats['duration']
            logger.info(f"Download rate: {rate:.2f} files/second")


def batch_download(
    connection_factory: Callable[[], Any],
    file_paths: List[str],
    download_dir: str = "downloads",
    base_path: str = "",
    max_workers: int = 3,
    concurrent: bool = True,
    max_retries: int = 3,
    retry_delay: float = 2.0
) -> Dict[str, Any]:
    """
    Convenience function for batch downloading.

    Args:
        connection_factory: Function that returns a new FTP connection
        file_paths: List of file paths to download
        download_dir: Local download directory
        base_path: Base path on FTP server
        max_workers: Number of concurrent workers
        concurrent: Use concurrent downloads (True) or sequential (False)
        max_retries: Maximum retry attempts
        retry_delay: Delay between retries

    Returns:
        dict: Download statistics
    """
    downloader = FTPBatchDownloader(connection_factory, max_workers, download_dir)

    if concurrent:
        stats = downloader.download_concurrent(file_paths, base_path, max_retries, retry_delay)
    else:
        stats = downloader.download_single_threaded(file_paths, base_path, max_retries, retry_delay)

    downloader.print_summary(stats)
    return stats