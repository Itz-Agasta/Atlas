import sys

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
    if settings.ENVIRONMENT == "dev":
        # Development: Colored console output
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | <level>{message}</level>",
            level=log_level,
            colorize=True,
            enqueue=True,
        )
    elif settings.ENVIRONMENT == "prod":
        # Production: JSON structured logging for OpenTelemetry/Grafana/Loki
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {name}:{function}:{line} | {message}",
            serialize=True,  # JSON output
            level=log_level,
            enqueue=False,  # Ref: https://github.com/Delgan/loguru/issues/418
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


def get_logger(name: str):
    return logger.bind(name=name)
