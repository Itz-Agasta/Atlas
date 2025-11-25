# ARGO Data Processing Workers

Python workers for downloading and processing oceanographic ARGO float data from IFREMER, uploading to Neon PostgreSQL.

## Quick Start

```bash
cd apps/workers
uv sync

# Process a single float
make run-single FLOAT_ID=2902224

# With secrets via Infisical
infisical run --env=dev -- uv run python -m src.atlas_workers.main --float-id 2902224
```

## Architecture

```
Download (HTTPS)  →  Parse (xarray)  →  Upload (Neon PostgreSQL)
     ~5s               ~0.5s               ~20s
```

**Performance** (359 profiles):

- Uses aggregate `_prof.nc` files (all profiles in one file)
- 25x faster than parsing individual files (0.5s vs 12s)
- JSONB measurements stored pre-serialized

## Package Structure

```
src/atlas_workers/
├── main.py              # CLI entry point
├── operations.py        # Download → Process → Upload orchestration
├── config.py            # Settings (Pydantic)
├── db/
│   ├── connector.py     # Neon DB connection (execute_values)
│   └── operations.py    # ArgoDataUploader
├── models/
│   └── argo.py          # FloatMetadata, ProfileData (Pydantic)
├── workers/
│   ├── argo_sync/       # HTTPS download from IFREMER
│   └── netcdf_processor/
│       ├── netcdf_parser.py           # Main parser interface
│       └── netcdf_aggregate_parser.py # Aggregate file parser
└── utils/
    └── logging.py
```

## Commands

```bash
# Single float
make run-single FLOAT_ID=2902224

# Skip download (use cached files)
infisical run --env=dev -- uv run python -m src.atlas_workers.main \
    --float-id 2902224 --skip-download

# No database upload (download + parse only)
infisical run --env=dev -- uv run python -m src.atlas_workers.main \
    --float-id 2902224 --no-upload

# Test database connection
infisical run --env=dev -- uv run python -m src.atlas_workers.main --test-db
```

## Configuration

Environment variables (or `.env`):

```ini
# FTP/HTTPS
FTP_SERVER=data-argo.ifremer.fr
ARGO_DAC=incois
LOCAL_CACHE_PATH=/tmp/argo_data
USE_AGGREGATE_ONLY=true

# Database
DATABASE_URL=postgresql://...

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

## Data Flow

1. **Download**: FTP sync fetches aggregate files (`{float_id}_prof.nc`, `_meta.nc`)
2. **Parse**: xarray extracts profiles from NetCDF, pre-serializes measurements to JSON
3. **Upload**: `execute_values` batch inserts to Neon with JSONB measurements

## Testing

```bash
# Run tests
uv run pytest tests/ -v

# With coverage
uv run pytest tests/ --cov=src/atlas_workers --cov-report=html
```

## Documentation

See [docs/dev/WORKER_ARCHITECTURE.md](../../docs/dev/WORKER_ARCHITECTURE.md) for:

- Performance benchmarks
- Design decisions
- Database schema
