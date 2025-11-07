"""Structured logging setup."""

import logging
import sys

import structlog

from ..config import settings


def setup_logging() -> None:
    """Configure structured logging with structlog."""

    # Get logging level with validation
    log_level_str = settings.LOG_LEVEL
    try:
        log_level = getattr(logging, log_level_str)
        if not isinstance(log_level, int):
            raise AttributeError(f"Invalid logging level: {log_level_str}")
    except AttributeError:
        # Fallback to INFO for invalid log levels
        logging.getLogger(__name__).warning(
            f"Invalid LOG_LEVEL '{log_level_str}', falling back to INFO"
        )
        log_level = logging.INFO

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
            if settings.LOG_FORMAT == "json"
            else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)
