"""FTP recursive file scanner for finding files across directory trees."""

import time
from typing import List, Optional
from .ftp_navigation import list_files_with_extension, change_directory_safe

from ...utils.logging import get_logger

logger = get_logger(__name__)

class FTPScanner:
    """Recursive scanner for finding files on FTP servers."""
    
    def __init__(self, max_depth=10, delay=0.2, verbose=True):
        """
        Initialize FTP scanner.
        
        Args:
            max_depth: Maximum recursion depth
            delay: Delay between directory scans (seconds)
            verbose: Print progress messages
        """
        self.max_depth = max_depth
        self.delay = delay
        self.verbose = verbose
    
    def find_files(self, ftp, base_path="", extension=".nc", depth=0) -> List[str]:
        """
        Recursively find all files with specified extension.
        
        Args:
            ftp: FTP connection instance
            base_path: Relative base path for file paths
            extension: File extension to search for
            depth: Current recursion depth
        
        Returns:
            List[str]: List of relative file paths
        """
        if depth > self.max_depth:
            return []
        
        current_dir = ftp.pwd()
        if self.verbose:
            logger.info(f"{'  ' * depth}Scanning: {current_dir}")
        
        directories, files = list_files_with_extension(ftp, ".", extension)
        
        all_files = []
        
        # Add files from current directory
        for file in files:
            if base_path:
                file_path = f"{base_path}/{file}"
            else:
                rel_path = ftp.pwd().replace(ftp.pwd().split('/')[0], '').lstrip('/')
                file_path = f"{rel_path}/{file}" if rel_path else file
            
            all_files.append(file_path)
            if self.verbose:
                logger.info(f"{'  ' * depth}Found: {file}")
        
        # Recursively search subdirectories
        for directory in directories:
            if change_directory_safe(ftp, directory):
                sub_path = f"{base_path}/{directory}" if base_path else directory
                sub_files = self.find_files(ftp, sub_path, extension, depth + 1)
                all_files.extend(sub_files)
                ftp.cwd('..')  # Go back to parent
                
                # Delay to avoid overwhelming server
                if self.delay > 0:
                    time.sleep(self.delay)
        
        return all_files
    
    def scan_multiple_directories(self, ftp, directories, extension=".nc", 
                                  inter_dir_delay=1.0) -> List[str]:
        """
        Scan multiple top-level directories.
        
        Args:
            ftp: FTP connection instance
            directories: List of directory paths to scan
            extension: File extension to search for
            inter_dir_delay: Delay between scanning different directories
        
        Returns:
            List[str]: Combined list of all file paths found
        """
        base_dir = ftp.pwd()
        all_files = []
        
        for directory in directories:
            if self.verbose:
                logger.info(f"\nScanning directory: {directory}")
            
            try:
                # Navigate to directory
                full_path = f"{base_dir}/{directory}" if base_dir != "/" else f"/{directory}"
                if change_directory_safe(ftp, full_path):
                    files = self.find_files(ftp, directory, extension)
                    all_files.extend(files)
                    
                    if self.verbose:
                        logger.info(f"Found {len(files)} files in {directory}")
                    
                    # Return to base directory
                    ftp.cwd(base_dir)
                    
                    # Brief pause between directory scans
                    if inter_dir_delay > 0:
                        time.sleep(inter_dir_delay)
            
            except Exception as e:
                logger.error(f"Error scanning directory {directory}: {e}")
        
        return all_files

    def find_named_file(self, ftp, filename: str, base_path: str = "", depth: int = 0) -> Optional[str]:
        """
        Recursively search for a specific named file.

        Args:
            ftp: FTP connection instance
            filename: Name of the file to search for
            base_path: Relative base path for file paths
            depth: Current recursion depth

        Returns:
            Optional[str]: Relative path to the found file, or None if not found
        """
        if depth > self.max_depth:
            return None

        current_dir = ftp.pwd()
        if self.verbose:
            logger.info(f"{'  ' * depth}Searching for '{filename}' in: {current_dir}")

        directories, files = list_files_with_extension(ftp, ".", "")
        for file in files:
            if file == filename:
                if base_path:
                    file_path = f"{base_path}/{file}"
                else:
                    rel_path = ftp.pwd().replace(ftp.pwd().split('/')[0], '').lstrip('/')
                    file_path = f"{rel_path}/{file}" if rel_path else file
                logger.info(f"Found file '{filename}' at: {file_path}")
                return file_path

        for directory in directories:
            if change_directory_safe(ftp, directory):
                sub_path = f"{base_path}/{directory}" if base_path else directory
                found = self.find_named_file(ftp, filename, sub_path, depth + 1)
                ftp.cwd('..')
                if found:
                    return found
                if self.delay > 0:
                    time.sleep(self.delay)

        return None
