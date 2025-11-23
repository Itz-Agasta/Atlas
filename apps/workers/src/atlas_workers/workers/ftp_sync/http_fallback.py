"""
HTTP Fallback Downloader for ARGO data.

Provides HTTP-based download functionality as a fallback when FTP fails.
Uses httpx for async HTTP requests with connection pooling and HTTP/2 support.
"""

from pathlib import Path
from typing import Optional
import httpx
import asyncio

from ...utils.logging import get_logger
from ...config import settings


logger = get_logger(__name__)


class HTTPDownloadError(Exception):
    """Raised when HTTP download fails."""
    pass


class HTTPFallbackDownloader:
    """HTTP-based downloader for ARGO data files using httpx."""
    
    def __init__(
        self, 
        base_url: Optional[str] = None, 
        timeout: int = None,
        http2: bool = True
    ):
        """
        Initialize HTTP fallback downloader.
        
        Args:
            base_url: Base URL for HTTP downloads (default: https://FTP_SERVER)
            timeout: Request timeout in seconds (default: FTP_TIMEOUT from config)
            http2: Enable HTTP/2 support (default: True)
        """
        self.base_url = base_url or f"{settings.HTTP_BASE_URL}"
        self.timeout = timeout or settings.HTTP_TIMEOUT
        self.max_retries = settings.HTTP_MAX_RETRIES
        self.retry_delay = settings.HTTP_RETRY_DELAY
        self.http2 = http2
        
        # Create a persistent client for connection pooling
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        """Context manager entry - creates HTTP client."""
        await self._ensure_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - closes HTTP client."""
        await self.close()
    
    async def _ensure_client(self):
        """Ensure HTTP client is initialized."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                http2=self.http2,
                follow_redirects=True,
                limits=httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=20,
                    keepalive_expiry=30.0
                )
            )
    
    async def close(self):
        """Close HTTP client and release connections."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
    
    async def download_file(
        self, 
        remote_path: str, 
        local_path: Path = settings.LOCAL_CACHE_PATH,
        base_path: str = "dac"
    ) -> int:
        """
        Download file via HTTP with retry logic.
        
        Args:
            remote_path: Remote file path (e.g., "incois/2902224/profiles/R2902224_001.nc")
            local_path: Local path to save file
            base_path: Base path on server (default: "dac")
            
        Returns:
            Size of downloaded file in bytes
            
        Raises:
            HTTPDownloadError: If download fails after all retries
        """
        # Construct full URL
        url = f"{self.base_url}/{base_path}/{remote_path}"
        
        # Create parent directories
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Ensure client is ready
        await self._ensure_client()
        
        # Retry loop
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"HTTP download attempt {attempt}/{self.max_retries}: {url}")
                
                size = await self._download_with_streaming(url, local_path)
                
                logger.debug(f"HTTP download successful: {remote_path} ({size:,} bytes)")
                return size
                
            except Exception as e:
                last_error = e
                logger.warning(
                    f"HTTP download attempt {attempt}/{self.max_retries} failed for {remote_path}: {e}"
                )
                
                if attempt < self.max_retries:
                    logger.debug(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
        
        # All retries failed
        error_msg = f"HTTP download failed after {self.max_retries} attempts: {remote_path}"
        logger.error(error_msg)
        raise HTTPDownloadError(error_msg) from last_error
    
    async def _download_with_streaming(self, url: str, local_path: Path) -> int:
        """
        Download file with streaming.
        
        Args:
            url: Full URL to download
            local_path: Local path to save file
            
        Returns:
            Size of downloaded file in bytes
        """
        # Stream the response
        async with self._client.stream('GET', url) as response:
            # Check if request was successful
            if response.status_code != 200:
                raise HTTPDownloadError(
                    f"HTTP {response.status_code}: {response.reason_phrase} for {url}"
                )
            
            # Download file in chunks
            total_size = 0
            with open(local_path, 'wb') as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    f.write(chunk)
                    total_size += len(chunk)
            
            return total_size
    
    async def check_file_exists(
        self, 
        remote_path: str,
        base_path: str = "dac"
    ) -> bool:
        """
        Check if file exists on HTTP server using HEAD request.
        
        Args:
            remote_path: Remote file path
            base_path: Base path on server (default: "dac")
            
        Returns:
            True if file exists, False otherwise
        """
        url = f"{self.base_url}/{base_path}/{remote_path}"
        
        try:
            await self._ensure_client()
            response = await self._client.head(url)
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"HEAD request failed for {url}: {e}")
            return False
    
    async def get_file_info(
        self,
        remote_path: str,
        base_path: str = "dac"
    ) -> Optional[dict]:
        """
        Get file metadata using HEAD request.
        
        Args:
            remote_path: Remote file path
            base_path: Base path on server (default: "dac")
            
        Returns:
            Dictionary with file info (size, content-type, last-modified) or None
        """
        url = f"{self.base_url}/{base_path}/{remote_path}"
        
        try:
            await self._ensure_client()
            response = await self._client.head(url)
            
            if response.status_code == 200:
                return {
                    'size': int(response.headers.get('content-length', 0)),
                    'content_type': response.headers.get('content-type'),
                    'last_modified': response.headers.get('last-modified'),
                    'etag': response.headers.get('etag')
                }
        except Exception as e:
            logger.debug(f"HEAD request failed for {url}: {e}")
        
        return None


# Convenience function for simple usage
async def download_file_http(
    remote_path: str,
    local_path: Path,
    base_path: str = "dac",
    base_url: Optional[str] = None
) -> int:
    """
    Convenience function to download a single file via HTTP.
    
    Args:
        remote_path: Remote file path
        local_path: Local path to save file
        base_path: Base path on server (default: "dac")
        base_url: Base URL for downloads (default: https://FTP_SERVER)
        
    Returns:
        Size of downloaded file in bytes
        
    Raises:
        HTTPDownloadError: If download fails
    """
    async with HTTPFallbackDownloader(base_url=base_url) as downloader:
        return await downloader.download_file(remote_path, local_path, base_path)