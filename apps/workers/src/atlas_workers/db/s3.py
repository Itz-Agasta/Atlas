from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ..utils import get_logger

logger = get_logger(__name__)


class S3Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    S3_ACCESS_KEY: Optional[str] = Field(default=None, description="R2 access key")
    S3_SECRET_KEY: Optional[str] = Field(default=None, description="R2 secret key")
    S3_BUCKET_NAME: str = Field(default="atlas", description="R2 bucket name")
    S3_ENDPOINT: Optional[str] = Field(default=None, description="R2 endpoint URL")
    S3_REGION: str = Field(default="auto", description="R2 region")


class S3Client:
    def __init__(self, settings: Optional[S3Settings] = None):
        self.settings = settings or S3Settings()

        if not self.settings.S3_ACCESS_KEY or not self.settings.S3_SECRET_KEY:
            raise ValueError("S3_ACCESS_KEY and S3_SECRET_KEY not configured")

        if not self.settings.S3_ENDPOINT:
            raise ValueError("S3_ENDPOINT not configured")

        self.client = boto3.client(
            "s3",
            endpoint_url=self.settings.S3_ENDPOINT,
            aws_access_key_id=self.settings.S3_ACCESS_KEY,
            aws_secret_access_key=self.settings.S3_SECRET_KEY,
            region_name=self.settings.S3_REGION,
        )

        self.bucket_name = self.settings.S3_BUCKET_NAME

    def upload_file(self, float_id: str, local_path: Path) -> bool:
        """Upload Parquet file to R2 with Hive-style partitioning.

        Structure: profiles/{float_id}/data.parquet

        Args:
            float_id: Float ID for partitioning
            local_path: Local path to parquet file

        Returns:
            True if successful, False otherwise
        """
        if not local_path.exists():
            logger.warning(
                "Local file not found", float_id=float_id, path=str(local_path)
            )
            return False

        # Use Hive-style partitioning: profiles/float_id/data.parquet
        s3_key = f"profiles/{float_id}/data.parquet"  # TODO: will chnage it later - atlas/{DAC-name}/{float-id}/data.parquet

        try:
            file_size = local_path.stat().st_size
            self.client.upload_file(str(local_path), self.bucket_name, s3_key)

            logger.debug(
                "file uploaded to bucket",
                float_id=float_id,
                s3_key=s3_key,
                file_size_mb=round(file_size / (1024 * 1024), 2),
            )

            return True

        except (ClientError, BotoCoreError) as e:
            logger.error("R2 error", exc_info=e)
            return False
        except Exception as e:
            logger.error("Unexpected R2 error", exc_info=e)
            return False
