"""FTP connection utilities for establishing and managing FTP connections."""

from ftplib import FTP
from contextlib import contextmanager

from ...utils.logging import get_logger

logger = get_logger(__name__)

class FTPConnection:
    """FTP connection manager with configuration."""
    
    def __init__(self, host, base_path="/", timeout=60, passive=True):
        """
        Initialize FTP connection configuration.
        
        Args:
            host: FTP server hostname
            base_path: Base directory path on the server
            timeout: Connection timeout in seconds
            passive: Use passive mode (recommended for firewalls)
        """
        self.host = host
        self.base_path = base_path
        self.timeout = timeout
        self.passive = passive
    
    def connect(self):
        """
        Create and configure an FTP connection.
        
        Returns:
            FTP: Connected FTP instance
        """
        ftp = FTP()
        ftp.connect(self.host, timeout=self.timeout)
        ftp.login()  # Anonymous login
        
        if self.passive:
            ftp.set_pasv(True)
        
        # Navigate to base path
        if self.base_path and self.base_path != "/":
            ftp.cwd(self.base_path)
        
        return ftp
    
    @contextmanager
    def connection(self):
        """
        Context manager for FTP connections.
        Ensures proper connection cleanup.
        
        Yields:
            FTP: Connected FTP instance
        """
        ftp = None
        try:
            ftp = self.connect()
            yield ftp
        finally:
            if ftp:
                try:
                    ftp.quit()
                except Exception as e:
                    logger.warning(f"Error quitting FTP connection: {e}")
                    ftp.close()
    
    def test_connection(self):
        """
        Test FTP connection to the server.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        logger.info(f"Testing FTP connection to {self.host}...")
        try:
            with self.connection() as ftp:
                logger.info(f"Connected to: {ftp.getwelcome()}")
                logger.info(f"Current directory: {ftp.pwd()}")
                logger.info("FTP connection test successful!")
                return True
        except Exception as e:
            logger.error(f"FTP connection test failed: {e}")
            return False


def create_ftp_connection(host, base_path="/", timeout=60, passive=True):
    """
    Factory function to create a simple FTP connection.
    
    Args:
        host: FTP server hostname
        base_path: Base directory path on the server
        timeout: Connection timeout in seconds
        passive: Use passive mode
    
    Returns:
        FTP: Connected FTP instance
    """
    manager = FTPConnection(host, base_path, timeout, passive)
    return manager.connect()