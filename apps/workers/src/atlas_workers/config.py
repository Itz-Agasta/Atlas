"""Configuration settings for Atlas Workers."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # FTP Configuration
    FTP_SERVER: str = "data-argo.ifremer.fr"
    FTP_PORT: int = 21
    FTP_TIMEOUT: int = 300
    FTP_MAX_RETRIES: int = 3
    FTP_RETRY_DELAY: int = 5

    # Data Configuration
    ARGO_DAC: str = "incois"  # Data Assembly Center
    LOCAL_CACHE_PATH: Path = Path("/tmp/argo_data")
    ENABLE_INCREMENTAL_SYNC: bool = True

    # HTTP Configuration (for HTTPS fallback)
    HTTP_BASE_URL: str = "https://data-argo.ifremer.fr"
    HTTP_TIMEOUT: int = 30
    HTTP_MAX_RETRIES: int = 3

    # Processing Configuration
    BATCH_SIZE: int = 10
    MAX_WORKERS: int = 4
    PROFILE_BATCH_LIMIT: Optional[int] = None  # None = process all

    # Output Configuration
    OUTPUT_ARROW_FORMAT: bool = True
    ARROW_COMPRESSION: str = "zstd"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text

    # Environment
    ENVIRONMENT: str = "development"  # development, staging, production


settings = Settings()
