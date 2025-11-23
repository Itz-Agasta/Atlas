import sys
from pathlib import Path

from loguru import logger

from ..config import settings


def setup_logging() -> None:
    """Configure loguru logging with colored console output for dev and JSON for production."""

    # Remove default handler
    logger.remove()

    # Get logging level
    log_level = settings.LOG_LEVEL

    # Configure based on environment and log format
    # Development always gets colored output for better readability
    if settings.ENVIRONMENT == "development":
        # Development: Colored console output
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | <level>{message}</level>",
            level=log_level,
            colorize=True,
            enqueue=True,
        )
    elif settings.LOG_FORMAT == "json" or settings.ENVIRONMENT == "production":
        # Production: JSON structured logging for OpenTelemetry/Grafana/Loki
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {name}:{function}:{line} | {message}",
            serialize=True,  # JSON output
            level=log_level,
            enqueue=True,  # Async logging for better performance
        )
    else:
        # Fallback: Colored console output
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | <level>{message}</level>",
            level=log_level,
            colorize=True,
            enqueue=True,
        )

    # Add file logging for errors in production
    if settings.ENVIRONMENT == "production":
        log_file = Path("./logs/atlas_workers.log")
        log_file.parent.mkdir(exist_ok=True)

        logger.add(
            log_file,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {name}:{function}:{line} | {message}",
            serialize=True,
            level="WARNING",
            rotation="10 MB",
            retention="1 week",
            enqueue=True,
        )


def get_logger(name: str):
    return logger.bind(name=name)
