"""FTP directory navigation and listing utilities."""

from ftplib import error_perm, FTP
from typing import Tuple, List

from ...utils.logging import get_logger

logger = get_logger(__name__)

def is_directory(
        ftp: FTP, 
        name: str
        ) -> bool:
    """
    Check if an FTP item is a directory.

    Args:
        ftp: FTP connection instance
        name: Name of the item to check

    Returns:
        bool: True if item is a directory, False otherwise
    """
    current = ftp.pwd()
    try:
        ftp.cwd(name)
        ftp.cwd(current)
        return True
    except error_perm:
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking if '{name}' is a directory: {e}")
        return False


def list_directory(
        ftp: FTP, 
        path: str = "."
        ) -> Tuple[List[str], List[str]]:
    """
    List contents of an FTP directory.

    Args:
        ftp: FTP connection instance
        path: Directory path to list (default: current directory)

    Returns:
        Tuple[List[str], List[str]]: (directories, files) found in the path
    """
    items: List[str] = []
    directories: List[str] = []
    files: List[str] = []
    try:
        ftp.cwd(path)
        ftp.retrlines('NLST', items.append)
        for item in items:
            # Skip parent directory references and empty names
            if item in ['.', '..', '']:
                continue
            try:
                if is_directory(ftp, item):
                    directories.append(item)
                else:
                    files.append(item)
            except Exception as e:
                logger.warning(f"Error checking item '{item}' in '{path}': {e}")
        return directories, files
    except error_perm as e:
        logger.warning(f"Permission error accessing {path}: {e}")
        return [], []
    except Exception as e:
        logger.error(f"Error listing directory {path}: {e}")
        return [], []


def list_files_with_extension(
        ftp: FTP, 
        path: str = ".", 
        extension: str = ".nc"
        ) -> Tuple[List[str], List[str]]:
    """
    List contents of an FTP directory, filtering files by extension.

    Args:
        ftp: FTP connection instance
        path: Directory path to list
        extension: File extension to filter (e.g., ".nc", ".txt")

    Returns:
        Tuple[List[str], List[str]]: (directories, filtered_files)
    """
    items: List[str] = []
    directories: List[str] = []
    files: List[str] = []
    try:
        ftp.cwd(path)
        ftp.retrlines('NLST', items.append)
        for item in items:
            if item in ['.', '..', '']:
                continue
            try:
                if is_directory(ftp, item):
                    directories.append(item)
                elif item.endswith(extension):
                    files.append(item)
            except Exception as e:
                logger.warning(f"Error checking item '{item}' in '{path}': {e}")
        return directories, files
    except error_perm as e:
        logger.warning(f"Permission error accessing {path}: {e}")
        return [], []
    except Exception as e:
        logger.error(f"Error listing directory {path}: {e}")
        return [], []


def get_file_size(
        ftp: FTP, 
        filename: str
        ) -> int:
    """
    Get the size of a file on the FTP server.

    Args:
        ftp: FTP connection instance
        filename: Name of the file

    Returns:
        int: File size in bytes, or 0 if unable to determine
    """
    try:
        size = ftp.size(filename)
        if size is None:
            logger.warning(f"Size for file '{filename}' is None.")
            return 0
        return size
    except error_perm as e:
        logger.warning(f"Permission error getting size for file '{filename}': {e}")
        return 0
    except Exception as e:
        logger.warning(f"Error getting size for file '{filename}': {e}")
        return 0


def change_directory_safe(ftp: FTP, path: str) -> bool:
    """
    Safely change to a directory, returning to original on failure.

    Args:
        ftp: FTP connection instance
        path: Directory path to change to

    Returns:
        bool: True if successful, False otherwise
    """
    current_dir = ftp.pwd()
    try:
        ftp.cwd(path)
        return True
    except error_perm as e:
        logger.warning(f"Permission error changing to directory '{path}': {e}")
    except Exception as e:
        logger.error(f"Error changing to directory '{path}': {e}")
    try:
        ftp.cwd(current_dir)
    except Exception as inner_e:
        logger.warning(f"Error returning to original directory '{current_dir}': {inner_e}")
    return False