"""
FTP Connection Pool Manager for efficient file downloads.

Provides connection pooling and reuse for FTP operations to reduce
connection overhead and improve download performance.
"""

import asyncio
from pathlib import Path
from ftplib import FTP
from collections import deque
import time

from ...utils.logging import get_logger
from ...config import settings


logger = get_logger(__name__)


class FTPConnectionError(Exception):
    """Raised when FTP connection fails."""
    pass


class FTPConnection:
    """Wrapper for FTP connection with basic metadata."""
    
    def __init__(self, ftp: FTP):
        self.ftp = ftp
        self.last_used = time.time()
        self.is_alive = True
    
    def mark_used(self):
        """Mark connection as recently used."""
        self.last_used = time.time()
    
    def test_alive(self) -> bool:
        """Test if connection is still alive."""
        try:
            self.ftp.voidcmd("NOOP")
            return True
        except Exception:
            self.is_alive = False
            return False
    
    def close(self):
        """Close FTP connection."""
        try:
            self.ftp.quit()
        except Exception:
            try:
                self.ftp.close()
            except Exception:
                pass
        self.is_alive = False


class FTPConnectionPool:
    """Simple connection pool for FTP connections."""
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        timeout: int = None,
        max_connections: int = 5,
        max_idle_time: float = 60.0
    ):
        """
        Initialize FTP connection pool.
        
        Args:
            host: FTP server hostname
            port: FTP server port
            timeout: Connection timeout in seconds
            max_connections: Maximum number of pooled connections
            max_idle_time: Maximum idle time before closing connection (seconds)
        """
        self.host = host or settings.FTP_SERVER
        self.port = port or settings.FTP_PORT or 21
        self.timeout = timeout or settings.FTP_TIMEOUT
        self.max_connections = max_connections
        self.max_idle_time = max_idle_time
        
        self._pool: deque[FTPConnection] = deque()
        self._lock = asyncio.Lock()
        self._closed = False
    
    async def __aenter__(self):
        """Context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        await self.close_all()
    
    def _create_connection(self) -> FTPConnection:
        """Create a new FTP connection."""
        try:
            ftp = FTP(timeout=self.timeout)
            ftp.connect(self.host, self.port)
            ftp.login()  # Anonymous login
            
            conn = FTPConnection(ftp)
            logger.debug(f"Created new FTP connection to {self.host}:{self.port}")
            return conn
        except Exception as e:
            logger.error(f"Failed to create FTP connection: {e}")
            raise FTPConnectionError(f"Failed to connect to {self.host}:{self.port}") from e
    
    async def get_connection(self) -> FTPConnection:
        """
        Get an FTP connection from the pool.
        
        Returns:
            FTPConnection object
        """
        async with self._lock:
            if self._closed:
                raise FTPConnectionError("Connection pool is closed")
            
            # Try to reuse existing connection
            while self._pool:
                conn = self._pool.popleft()
                
                # Check if connection idle too long
                if (time.time() - conn.last_used) > self.max_idle_time:
                    logger.debug("Connection idle too long, closing")
                    conn.close()
                    continue
                
                # Test if connection is still alive
                if not conn.test_alive():
                    logger.debug("Connection dead, closing")
                    conn.close()
                    continue
                
                # Connection is good, reuse it
                conn.mark_used()
                logger.debug("Reusing FTP connection from pool")
                return conn
            
            # No reusable connection, create new one
            loop = asyncio.get_event_loop()
            conn = await loop.run_in_executor(None, self._create_connection)
            logger.debug("Using new FTP connection")
            return conn
    
    async def return_connection(self, conn: FTPConnection):
        """
        Return a connection to the pool.
        
        Args:
            conn: FTPConnection to return
        """
        async with self._lock:
            if self._closed or not conn.is_alive:
                conn.close()
                return
            
            # Only keep connection if pool not full
            if len(self._pool) < self.max_connections:
                conn.mark_used()
                self._pool.append(conn)
                logger.debug(f"Returned connection to pool (pooled: {len(self._pool)})")
            else:
                conn.close()
                logger.debug("Pool full, closing connection")
    
    async def close_all(self):
        """Close all connections in the pool."""
        async with self._lock:
            self._closed = True
            
            while self._pool:
                conn = self._pool.popleft()
                conn.close()
            
            logger.debug("Closed all FTP connections")


class FTPDownloader:
    """FTP downloader with connection pooling."""
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        timeout: int = None,
        max_connections: int = 5
    ):
        """
        Initialize FTP downloader.
        
        Args:
            host: FTP server hostname
            port: FTP server port
            timeout: Connection timeout
            max_connections: Maximum pooled connections
        """
        self.pool = FTPConnectionPool(
            host=host,
            port=port,
            timeout=timeout,
            max_connections=max_connections
        )
        self.max_retries = settings.FTP_MAX_RETRIES
        self.retry_delay = settings.FTP_RETRY_DELAY
    
    async def __aenter__(self):
        """Context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        await self.close()
    
    async def close(self):
        """Close all connections."""
        await self.pool.close_all()
    
    async def download_file(
        self,
        remote_path: str,
        local_path: Path,
        base_path: str = "dac"
    ) -> int:
        """
        Download file via FTP with retry logic and connection pooling.
        
        Args:
            remote_path: Remote file path
            local_path: Local path to save file
            base_path: Base directory on FTP server
            
        Returns:
            Size of downloaded file in bytes
            
        Raises:
            FTPConnectionError: If download fails after all retries
        """
        # Create parent directories
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Retry loop
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"FTP download attempt {attempt}/{self.max_retries}: {remote_path}")
                
                size = await self._download_with_pool(remote_path, local_path, base_path)
                
                logger.debug(f"FTP download successful: {remote_path} ({size:,} bytes)")
                return size
                
            except Exception as e:
                last_error = e
                logger.warning(
                    f"FTP download attempt {attempt}/{self.max_retries} failed for {remote_path}: {e}"
                )
                
                if attempt < self.max_retries:
                    logger.debug(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
        
        # All retries failed
        error_msg = f"FTP download failed after {self.max_retries} attempts: {remote_path}"
        logger.error(error_msg)
        raise FTPConnectionError(error_msg) from last_error
    
    async def _download_with_pool(
        self,
        remote_path: str,
        local_path: Path,
        base_path: str
    ) -> int:
        """
        Download file using connection from pool.
        
        Args:
            remote_path: Remote file path
            local_path: Local path to save file
            base_path: Base directory
            
        Returns:
            Size of downloaded file in bytes
        """
        conn = await self.pool.get_connection()
        
        try:
            # Run download in thread pool
            loop = asyncio.get_event_loop()
            size = await loop.run_in_executor(
                None,
                self._download_sync,
                conn.ftp,
                remote_path,
                local_path,
                base_path
            )
            
            # Return connection to pool
            await self.pool.return_connection(conn)
            
            return size
            
        except Exception as e:
            # Connection might be dead, don't return to pool
            conn.is_alive = False
            await self.pool.return_connection(conn)
            raise
    
    def _download_sync(
        self,
        ftp: FTP,
        remote_path: str,
        local_path: Path,
        base_path: str
    ) -> int:
        """
        Synchronous FTP download.
        
        Args:
            ftp: FTP connection
            remote_path: Remote file path
            local_path: Local path to save file
            base_path: Base directory
            
        Returns:
            Size of downloaded file in bytes
        """
        # Change to base directory
        ftp.cwd(f"/{base_path}")
        
        # Download file
        with open(local_path, 'wb') as f:
            ftp.retrbinary(f'RETR {remote_path}', f.write)
        
        # Get file size
        size = local_path.stat().st_size
        return size