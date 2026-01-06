# ARGO Data Processing Workers

Python workers for downloading and processing oceanographic ARGO float data from IFREMER DAC, uploading to Dbs.

## Quick Start

```bash
cd apps/workers
uv sync

# Process a single float
infisical run -- uv run python -m src.atlas_workers.main --id 2902224
# or
make run-sync FLOAT_ID=2902224

# Full sync all floats
infisical run -- uv run python -m src.atlas_workers.main --all
# or
make run-syncAll

# Weekly update
infisical run -- uv run python -m src.atlas_workers.main --update
# or
make run-update
```

## Architecture

```
Download (HTTPS)  ->  Parse (NetCDF)  ->  Upload (PostgreSQL + S3)
     ~5s               ~0.19s               ~2s
```

## Package Structure

```
src/atlas_workers/
├── main.py              # CLI entry point and sync orchestration
├── db/
│   ├── pg.py            # PostgreSQL client
│   └── s3.py            # S3 client for Parquet uploads
├── models/
│   ├── argo.py          # Pydantic models for FloatMetadata, Status
│   └── __init__.py
├── workers/
│   ├── argo_sync.py     # HTTPS download from IFREMER DAC
│   └── netcdf_parser.py # NetCDF parsing and processing
├── utils/
│   ├── get_logger.py    # Structured logging
│   └── __init__.py
└── __init__.py
```

## Documentation

See [main README](../../README.md) for project overview.