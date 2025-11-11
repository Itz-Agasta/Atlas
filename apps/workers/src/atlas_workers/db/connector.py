"""Neon PostgreSQL database connector with Apache Arrow support."""

import io
from contextlib import contextmanager
from typing import Any, Generator, Optional

import psycopg2
import psycopg2.extras
from psycopg2.extensions import connection as Connection
from psycopg2.extensions import cursor as Cursor
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ..utils import get_logger

logger = get_logger(__name__)


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="", description="Neon PostgreSQL connection string"
    )
    DB_POOL_SIZE: int = Field(5, description="Connection pool size")
    DB_MAX_OVERFLOW: int = Field(10, description="Max overflow connections")
    DB_TIMEOUT: int = Field(30, description="Connection timeout in seconds")
    DB_COMMAND_TIMEOUT: int = Field(300, description="Command timeout in seconds")


class NeonDBConnector:
    """Neon PostgreSQL database connector optimized for Arrow data transfer."""

    def __init__(self, database_url: Optional[str] = None):
        """Initialize database connector.

        Args:
            database_url: PostgreSQL connection string (uses env var if not provided)
        """
        self.settings = DatabaseSettings()
        self.database_url = database_url or self.settings.DATABASE_URL
        self._connection: Optional[Connection] = None

        logger.info("Database connector initialized")

    @contextmanager
    def get_connection(self) -> Generator[Connection, None, None]:
        """Get a database connection (context manager).

        Yields:
            PostgreSQL connection
        """
        conn = None
        try:
            conn = psycopg2.connect(
                self.database_url,
                connect_timeout=self.settings.DB_TIMEOUT,
            )
            # Set statement timeout after connection (not in options)
            with conn.cursor() as cursor:
                cursor.execute(
                    f"SET statement_timeout = {self.settings.DB_COMMAND_TIMEOUT * 1000}"
                )
            logger.debug("Database connection established")
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.exception("Database connection error", error=str(e))
            raise
        finally:
            if conn:
                conn.close()
                logger.debug("Database connection closed")

    @contextmanager
    def get_cursor(
        self, cursor_factory: Optional[Any] = None
    ) -> Generator[Cursor, None, None]:
        """Get a database cursor (context manager).

        Args:
            cursor_factory: Optional cursor factory (e.g., RealDictCursor)

        Yields:
            Database cursor
        """
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=cursor_factory)
            try:
                yield cursor
            finally:
                cursor.close()

    def execute_query(
        self,
        query: str,
        params: Optional[tuple | dict] = None,
        fetch: bool = False,
    ) -> Optional[list[tuple]]:
        """Execute a query and optionally fetch results.

        Args:
            query: SQL query string
            params: Query parameters
            fetch: Whether to fetch and return results

        Returns:
            Query results if fetch=True, else None
        """
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            if fetch:
                return cursor.fetchall()
            return None

    def execute_many(
        self,
        query: str,
        params_list: list[tuple | dict],
    ) -> None:
        """Execute a query multiple times with different parameters.

        Args:
            query: SQL query string
            params_list: List of parameter tuples/dicts
        """
        with self.get_cursor() as cursor:
            cursor.executemany(query, params_list)
            logger.debug("Batch query executed", count=len(params_list))

    def copy_from_arrow(
        self,
        table_name: str,
        columns: list[str],
        arrow_buffer: io.BytesIO,
    ) -> int:
        """Bulk insert data from Arrow format using COPY command.

        Args:
            table_name: Target table name
            columns: List of column names
            arrow_buffer: Arrow IPC format buffer converted to CSV

        Returns:
            Number of rows inserted
        """
        import pyarrow as pa
        import pyarrow.csv as csv

        # Read Arrow buffer
        reader = pa.ipc.open_stream(arrow_buffer)
        table = reader.read_all()

        # Convert to CSV for COPY
        csv_buffer = io.BytesIO()
        csv.write_csv(table, csv_buffer)
        csv_buffer.seek(0)

        # Use COPY command for fast bulk insert
        with self.get_cursor() as cursor:
            cursor.copy_expert(
                f"""
                COPY {table_name} ({",".join(columns)})
                FROM STDIN WITH (FORMAT CSV, HEADER TRUE)
                """,
                csv_buffer,
            )
            row_count = cursor.rowcount
            logger.info(
                "Arrow data copied to database",
                table=table_name,
                rows=row_count,
            )
            return row_count

    def bulk_insert_dict(
        self,
        table_name: str,
        data: list[dict[str, Any]],
    ) -> int:
        """Bulk insert data from list of dictionaries.

        Args:
            table_name: Target table name
            data: List of row dictionaries

        Returns:
            Number of rows inserted
        """
        if not data:
            return 0

        columns = list(data[0].keys())
        placeholders = ", ".join([f"%({col})s" for col in columns])
        query = f"""
            INSERT INTO {table_name} ({", ".join(columns)})
            VALUES ({placeholders})
            ON CONFLICT DO NOTHING
        """

        with self.get_cursor() as cursor:
            cursor.executemany(query, data)
            row_count = cursor.rowcount
            logger.info(
                "Bulk insert completed",
                table=table_name,
                rows=row_count,
            )
            return row_count

    def upsert_dict(
        self,
        table_name: str,
        data: dict[str, Any],
        conflict_column: str,
        update_columns: Optional[list[str]] = None,
    ) -> bool:
        """Insert or update a single row.

        Args:
            table_name: Target table name
            data: Row data dictionary
            conflict_column: Column to check for conflicts (e.g., 'float_id')
            update_columns: Columns to update on conflict (None = all except conflict)

        Returns:
            True if successful
        """
        columns = list(data.keys())
        placeholders = ", ".join([f"%({col})s" for col in columns])

        # Determine update columns
        if update_columns is None:
            update_columns = [col for col in columns if col != conflict_column]

        update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])

        query = f"""
            INSERT INTO {table_name} ({", ".join(columns)})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_column}) DO UPDATE SET
                {update_clause}
        """

        try:
            with self.get_cursor() as cursor:
                cursor.execute(query, data)
                logger.debug("Upsert completed", table=table_name)
                return True
        except Exception as e:
            logger.exception("Upsert failed", table=table_name, error=str(e))
            return False

    def health_check(self) -> bool:
        """Check database connectivity.

        Returns:
            True if database is accessible
        """
        try:
            result = self.execute_query("SELECT 1", fetch=True)
            return result is not None
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return False
