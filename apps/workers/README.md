# ARGO Data Processing Workers

This package contains Python workers for processing oceanographic ARGO float data from the `data-argo.ifremer.fr` repository. It provides both individual worker components and a unified main application for end-to-end ARGO data processing. The package is designed to be deployed as AWS Lambda functions.

## Architecture Overview

The package provides a unified ARGO data processing pipeline that combines multiple worker components into a cohesive system. The main application orchestrates the entire workflow from data download to database upload.

Key components:

- **FTP Sync**: Downloads ARGO data from IFREMER repository
- **NetCDF Processing**: Parses and extracts data from NetCDF files
- **Database Operations**: Handles data upload and storage
- **Main Application**: Orchestrates the complete processing pipeline

![workers arch](../../docs/imgs/workers.png)

## Package Structure

```
src/atlas_workers/
├── __init__.py              # Package exports
├── config.py                # Configuration management (Pydantic Settings)
├── main.py                  # Main application entry point
├── operations.py            # Core processing operations
├── lambda_handler.py        # AWS Lambda handler
├── lambda_handlers.py       # Additional Lambda handlers
├── db/
│   ├── __init__.py
│   ├── connector.py         # Database connection management
│   └── operations.py        # Database operations
├── models/
│   ├── argo.py              # Data models (FloatMetadata, ProfileData)
│   └── __init__.py
├── utils/
│   ├── logging.py           # Structured logging setup
│   └── __init__.py
└── workers/
    ├── ftp_sync.py/         # FTP sync worker
    ├── netcdf_processor/    # NetCDF processing workers
    └── __init__.py
```

## Worker #1: FTP Sync

Downloads ARGO float data from the IFREMER repository.

### Features

- **Incremental Sync**: Only downloads new/modified files
- **Manifest Tracking**: Remembers downloaded files
- **Concurrent Downloads**: Parallel processing via asyncio
- **HTTP Fallback**: Uses HTTPS when FTP unavailable
- **Retry Logic**: Automatic retries on network failures

### Command Line

```bash
# Run worker directly
uv run python -m src.atlas_workers.workers.ftp_sync

# With specific float IDs
export FLOAT_IDS="2902224,2902225"
uv run python -m src.atlas_workers.workers.ftp_sync
```

### Configuration

Via `config.py` or `.env`:

```ini
FTP_SERVER=data-argo.ifremer.fr
FTP_PORT=21
FTP_TIMEOUT=300
FTP_MAX_RETRIES=3
FTP_RETRY_DELAY=5
ARGO_DAC=incois
LOCAL_CACHE_PATH=/tmp/argo_data
ENABLE_INCREMENTAL_SYNC=true
HTTP_BASE_URL=https://data-argo.ifremer.fr
HTTP_TIMEOUT=30
HTTP_MAX_RETRIES=3
```

### Output

Returns sync statistics:

```json
{
  "total_floats": 312,
  "files_downloaded": 150,
  "files_skipped": 2050,
  "bytes_downloaded": 3145728,
  "errors": 0,
  "start_time": "2025-11-07T10:30:00.000000",
  "end_time": "2025-11-07T10:45:00.000000"
}
```

## Worker #2: NetCDF Parser

Converts NetCDF ARGO files to structured data formats (Arrow/Parquet/JSON).

### Features

- **Multi-format Export**: JSON, Arrow/Parquet
- **Automatic Type Detection**: Safely handles missing values
- **Profile Statistics**: Calculates min/max/avg for each profile
- **Quality Flags**: Preserves data quality indicators
- **Batch Processing**: Process entire float directories

### Configuration

```ini
OUTPUT_ARROW_FORMAT=true
ARROW_COMPRESSION=zstd
PROFILE_BATCH_LIMIT=None  # None = all, or limit to number
BATCH_SIZE=10
MAX_WORKERS=4
```

### Data Models

The parser returns `ProfileData` objects with full Pydantic validation and serialization:

```python
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

class ProfileData(BaseModel):
    float_id: str = Field(..., description="WMO float ID")
    cycle_number: int = Field(..., description="Profile cycle")
    profile_time: datetime = Field(..., description="Time of measurement")
    latitude: float = Field(..., description="Surface latitude")
    longitude: float = Field(..., description="Surface longitude")
    measurements: list[MeasurementProfile] = Field(
        default_factory=list, description="Depth profiles"
    )
    max_depth: Optional[float] = Field(None, description="Maximum depth reached")
    quality_status: Optional[str] = Field(
        "REAL_TIME", description="REAL_TIME or DELAYED"
    )
    metadata: Optional[dict[str, Any]] = Field(None, description="Additional info")

class MeasurementProfile(BaseModel):
    depth: float = Field(..., description="Pressure in meters")
    temperature: Optional[float] = Field(None, description="°C")
    salinity: Optional[float] = Field(None, description="PSU (Practical Salinity Units)")
    oxygen: Optional[float] = Field(None, description="µmol/kg (dissolved O2)")
    chlorophyll: Optional[float] = Field(None, description="mg/m³")
    qc_flags: Optional[dict[str, int]] = Field(
        None, description="Quality control flags"
    )
```

These Pydantic models provide automatic validation, JSON serialization, and type safety.

### Output Examples

**JSON Format:**

```json
[
  {
    "float_id": "2902224",
    "cycle_number": 320,
    "profile_time": "2025-11-06T03:20:00",
    "latitude": -4.8,
    "longitude": 72.1,
    "measurements": [
      {
        "depth": 0.0,
        "temperature": 15.2,
        "salinity": 34.5,
        "oxygen": 210.0,
        "chlorophyll": 0.8
      },
      {
        "depth": 1000.0,
        "temperature": 2.5,
        "salinity": 34.7,
        "oxygen": 145.0,
        "chlorophyll": 0.5
      }
    ],
    "max_depth": 2087.0,
    "quality_status": "REAL_TIME"
  }
]
```

**Arrow/Parquet Format:**

Columnar data optimized for storage and analytics:

- `float_id` (string)
- `cycle_number` (int64)
- `profile_time` (timestamp)
- `latitude`, `longitude` (float64)
- `max_depth` (float64)
- `measurement_count` (int32)

## Data Flow

```
1. FTP Sync Downloads Files
   ↓
2. Files stored at /tmp/argo_data/incois/[float_id]/
   ↓
3. NetCDF Parser reads files
   ↓
4. Extracts ProfileData objects
   ↓
5. Exports to Arrow/Parquet (compressed columnar format)
   ↓
6. Ready for database ingestion (PostgreSQL → Redis HOT layer)
   ↓
7. Dashboard receives data via API
```

## Quick Start

### Prerequisites

- Python 3.11+
- `uv` package manager (recommended)

### Local Development Setup

```bash
cd apps/workers

uv sync
```

### Environment Configuration

Create a `.env` file in the workers directory:

```bash
# FTP Configuration
FTP_SERVER=data-argo.ifremer.fr
FTP_PORT=21
ARGO_DAC=incois
LOCAL_CACHE_PATH=/tmp/argo_data

# Processing
BATCH_SIZE=10
MAX_WORKERS=4
PROFILE_BATCH_LIMIT=5  # Limit for testing, None for all

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json  # or 'text'
ENVIRONMENT=development
```

### Running the Worker

Use the provided Makefile commands to run the ARGO data processing:

```bash
# Process a single ARGO float
make run-single FLOAT_ID=2902224

# Process multiple floats in batch mode
make run-batch

# View all available commands
make help
```

**Note**: These commands automatically use `infisical` for secret management and run in the development environment.

## Testing

Run the full test suite:

```bash
# With uv
uv run pytest tests/ -v

# Run specific test
uv run pytest tests/test_ftp_sync.py::test_sync_worker_initialization -v

# With coverage
uv run pytest tests/ --cov=src/atlas_workers --cov-report=html
```

## Extras

```python
infisical run --env=dev -- uv run python -m src.atlas_workers.main --float-id 2902225 --skip-download
```

### Test Files

- `tests/test_ftp_sync.py` - FTP worker tests
- `tests/test_netcdf_parser.py` - Parser worker tests
- `tests/conftest.py` - Pytest fixtures
