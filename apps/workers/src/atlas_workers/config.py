from pathlib import Path
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        env_parse_none_str="None",
    )

    # HTTPS Configuration
    HTTP_BASE_URL: str = "https://data-argo.ifremer.fr"
    HTTP_TIMEOUT: int = 30
    HTTP_MAX_RETRIES: int = 3
    HTTP_RETRY_DELAY: int = 5  # Seconds between retries

    # Data Configuration
    ARGO_DAC: str = "incois"  # Data Assembly Center (incois, aoml, coriolis, etc.)
    LOCAL_CACHE_PATH: Path = Path("./data/argo_cache")
    ENABLE_INCREMENTAL_SYNC: bool = True

    # Use aggregate _prof.nc files only (skip individual profile downloads)
    # Aggregate files contain ALL profiles in a single file - 25x faster parsing
    USE_AGGREGATE_ONLY: bool = True

    # Bypass manifest cache - re-download all files
    # Use for debugging & benchmarking or when cache is stale
    FORCE_REDOWNLOAD: bool = False

    # Processing Configuration
    BATCH_SIZE: int = 10
    MAX_WORKERS: int = 4
    PROFILE_BATCH_LIMIT: Optional[int] = None  # None = process all profiles

    # Logging
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_FORMAT: Literal["json", "text"] = "text"  # json for production

    # Environment
    ENVIRONMENT: str = "development"  # development, staging, production

    # Database (PostgreSQL for metadata, DuckDB for profiles)
    PG_WRITE_URL: Optional[str] = None  # PostgreSQL connection string

    # DuckDB Configuration (profile data warehouse)
    DUCKDB_PATH: Path = Path("./data/duckdb")

    # Parquet Conversion (NetCDF -> Parquet for DuckDB)
    PARQUET_STAGING_PATH: Path = Path("./data/parquet_staging")
    PARQUET_COMPRESSION: str = "snappy"  # snappy, gzip, brotli

    # Cloudflare R2 Configuration (distributed Parquet storage)
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: str = "atlas"
    S3_ENDPOINT: Optional[str] = None
    S3_REGION: str = "auto"


settings = Settings()
