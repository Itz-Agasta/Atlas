from pathlib import Path
from typing import Optional

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

    # Data Configuration
    ARGO_DAC: str = "incois"  # Data Assembly Center (incois, aoml, coriolis, etc.)
    LOCAL_STAGE_PATH: Path = Path("/tmp/raw_staging")
    PARQUET_STAGING_PATH: Path = Path("/tmp/parquet_staging")

    # Environment (prod or dev)
    ENVIRONMENT: str = "prod"

    # Logging
    LOG_LEVEL: str = "INFO"

    # Database (PostgreSQL for metadata, DuckDB for profiles)
    PG_WRITE_URL: Optional[str] = None
    DB_TIMEOUT: int = 30

    # Cloudflare R2 Configuration (distributed Parquet storage)
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: str = "atlas"
    S3_ENDPOINT: Optional[str] = None
    S3_REGION: str = "auto"

    # Parquet Conversion (NetCDF -> Parquet for DuckDB)
    # PARQUET_STAGING_PATH: Path = Path("./data/parquet_staging")
    PARQUET_COMPRESSION: str = "snappy"  # snappy, gzip, brotli


settings = Settings()
