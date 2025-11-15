"""FTP file downloader with retry logic and progress tracking."""

import time
from pathlib import Path
from ftplib import error_perm, FTP
from typing import Callable, Optional, Union

from ...utils.logging import get_logger

logger = get_logger(__name__)

class FTPDownloader:
    """File downloader with retry logic and progress tracking."""

    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 2.0,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> None:
        """
        Initialize FTP downloader.

        Args:
            max_retries: Maximum number of download attempts
            retry_delay: Delay between retries in seconds
            progress_callback: Optional callback function(downloaded, total, filename)
        """
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.progress_callback = progress_callback

    def download_file(
        self,
        ftp: FTP,
        remote_path: str,
        local_path: Union[Path, str],
        skip_existing: bool = True,
    ) -> bool:
        """
        Download a single file from FTP server.

        Args:
            ftp: FTP connection instance
            remote_path: Full remote file path
            local_path: Local file path (Path object or string)
            skip_existing: Skip if file already exists and is not empty

        Returns:
            bool: True if successful, False otherwise
        """
        local_file_path = Path(local_path)

        # Skip if file exists and is not empty
        if skip_existing and local_file_path.exists() and local_file_path.stat().st_size > 0:
            logger.info(f"File already exists, skipping: {local_file_path.name}")
            return True

        # Create directory structure
        try:
            local_file_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create directory for {local_file_path}: {e}")
            return False

        for attempt in range(self.max_retries):
            try:
                logger.info(f"Downloading (attempt {attempt + 1}/{self.max_retries}): {remote_path}")

                # Navigate to file's directory
                remote_dir = '/'.join(remote_path.split('/')[:-1])
                remote_file = remote_path.split('/')[-1]

                ftp.cwd(remote_dir)

                # Get file size
                try:
                    file_size = ftp.size(remote_file)
                except Exception as e:
                    logger.warning(f"Could not get file size for {remote_file}: {e}")
                    file_size = 0

                downloaded = 0

                def write_callback(data: bytes) -> None:
                    nonlocal downloaded
                    f.write(data)
                    downloaded += len(data)

                    # Call progress callback
                    if self.progress_callback:
                        self.progress_callback(downloaded, file_size, remote_file)
                    # Default progress indicator
                    elif file_size > 0 and downloaded % (1024 * 1024) == 0:
                        progress = (downloaded / file_size) * 100
                        mb_downloaded = downloaded / (1024 * 1024)
                        logger.info(f"  Progress: {progress:.1f}% ({mb_downloaded:.1f}MB)")

                with open(local_file_path, 'wb') as f:
                    ftp.retrbinary(f'RETR {remote_file}', write_callback)

                logger.info(f"Successfully downloaded: {remote_file}")
                return True

            except error_perm as e:
                logger.warning(f"Permission error (attempt {attempt + 1}): {e}")
            except Exception as e:
                logger.error(f"Error downloading {remote_path} (attempt {attempt + 1}): {e}")

            # Retry logic
            if attempt < self.max_retries - 1:
                logger.info(f"Retrying in {self.retry_delay} seconds...")
                time.sleep(self.retry_delay)
                if local_file_path.exists():
                    try:
                        local_file_path.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to remove partial file {local_file_path}: {e}")

        logger.error(f"Failed to download {remote_path} after {self.max_retries} attempts")
        return False


def download_file_simple(
    ftp: FTP,
    remote_path: str,
    local_path: Union[Path, str],
    max_retries: int = 3,
    retry_delay: float = 2.0,
    skip_existing: bool = True,
) -> bool:
    """
    Simple function to download a file via FTP.

    Args:
        ftp: FTP connection instance
        remote_path: Full remote file path
        local_path: Local file path
        max_retries: Maximum download attempts
        retry_delay: Delay between retries
        skip_existing: Skip existing files

    Returns:
        bool: True if successful, False otherwise
    """
    downloader = FTPDownloader(max_retries, retry_delay)
    return downloader.download_file(ftp, remote_path, local_path, skip_existing)


def create_progress_callback(show_mb: bool = True) -> Callable[[int, int, str], None]:
    """
    Create a progress callback function.

    Args:
        show_mb: Show progress in MB

    Returns:
        Callable: Progress callback function
    """
    last_printed = [0]  # Use list to allow modification in closure

    def callback(downloaded: int, total: int, filename: str) -> None:
        if total > 0:
            # Print every 1MB
            if downloaded - last_printed[0] >= 1024 * 1024:
                progress = (downloaded / total) * 100
                if show_mb:
                    mb_downloaded = downloaded / (1024 * 1024)
                    mb_total = total / (1024 * 1024)
                    logger.info(f"  {filename}: {progress:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f}MB)")
                else:
                    logger.info(f"  {filename}: {progress:.1f}%")
                last_printed[0] = downloaded

    return callback