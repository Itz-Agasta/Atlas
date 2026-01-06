__version__ = "0.1.0"
__author__ = "Agasta"

from .config import settings
from .models import FloatMetadata, FloatStatus
from .utils import get_logger, setup_logging

# Initialize logging on module import
setup_logging()

__all__ = [
    "settings",
    "get_logger",
    "setup_logging",
    "FloatMetadata",
    "FloatStatus",
]
