# ARGO Workers Architecture

> Technical reference for the ARGO data processing pipeline.  
> **Last Updated**: January 2026  
> **Status**: Active and maintained

## Overview

The workers package (located at `apps/workers/`) downloads ARGO oceanographic float data from IFREMER, parses NetCDF files into Parquet format, uploads metadata to PostgreSQL, and stores time-series data in S3. Optimized for throughput with concurrent HTTPS downloads and vectorized NetCDF parsing.

**End-to-end benchmark** (float 2902232, 348 profiles):

- Download: 2.40s (concurrent HTTPS)
- Parse: 0.18s (xarray vectorized)
- Upload: 1.57s (PostgreSQL metadata + S3 Parquet)
- **Total: ~4.15s per float**

## Key Design Decisions

### 1. HTTPS vs FTP Protocol

IFREMER provides data via both FTP (`ftp.ifremer.fr`) and HTTPS (`data-argo.ifremer.fr`).

**Benchmark Results** (float 2902232, ~5MB total):

| Protocol               | Total Time | Speed         | Connection | Notes                    |
| ---------------------- | ---------- | ------------- | ---------- | ------------------------ |
| FTP (sequential)       | 23.4s      | 1.7 Mbps      | 2.8s       | Slow, single connection  |
| HTTPS (sequential)     | 9.0s       | 4.5 Mbps      | -          | 2.6x faster than FTP     |
| **HTTPS (concurrent)** | **4.0s**   | **10.2 Mbps** | -          | **5.8x faster than FTP** |

**Decision**: Use HTTPS with concurrent downloads via `httpx.AsyncClient`. Why:

1. **Speed**: 5-6x faster than FTP with concurrent requests
2. **Reliability**: HTTP has better error handling, retries, CDN caching
3. **Firewall-friendly**: FTP passive mode often blocked in cloud environments
4. **Simpler code**: `httpx.AsyncClient` vs `ftplib` with connection management

### 2. Aggregate Files vs Individual Profiles

IFREMER provides two formats:

- **Individual**: `profiles/D{float_id}_{cycle}.nc` (one file per profile, ~14KB each)
- **Aggregate**: `{float_id}_prof.nc` (ALL profiles in single file, ~5MB)

| Approach      | Files     | Parse Time | Notes                                  |
| ------------- | --------- | ---------- | -------------------------------------- |
| Individual    | 348 files | 12s        | One HTTP request per file              |
| **Aggregate** | 1 file    | **0.5s**   | Single 5MB download, xarray batch read |

**Decision**: Use aggregate files exclusively. ~24x faster parsing via xarray vectorized operations.

### 3. Data Storage Strategy

Current hybrid approach:

- **PostgreSQL**: Float metadata (`argo_float_metadata` table) and status (`argo_float_status`)
- **S3 (Parquet)**: Time-series profiles in denormalized "long" format at `s3://atlas/profiles/{float_id}/data.parquet`

This separation allows:

- Fast metadata queries via SQL (for router agent)
- Efficient time-series analysis via DuckDB (no network latency, fast predicate pushdown)
- Cost-effective storage (Parquet compression is 5-10x better than normalized PostgreSQL tables)

| Approach   | Storage          | Query Speed | Cost/1M rows |
| ---------- | ---------------- | ----------- | ------------ |
| Normalized | PostgreSQL       | Fast (SQL)  | ~$100        |
| **Hybrid** | **PG + Parquet** | **Fast**    | **~$20**     |
| JSONB      | PostgreSQL only  | Medium      | ~$80         |

**Decision**: Hybrid approach for scalability.

### 4. Parquet Schema Design

Data stored in denormalized "long" format (one row = one measurement at one depth):

```
float_id (BIGINT) | cycle_number (INT) | level (INT) | pressure (DOUBLE) |
temperature (DOUBLE) | salinity (DOUBLE) | oxygen (DOUBLE) | ...
```

This enables:

- **Efficient compression**: Repetitive metadata (float_id, cycle) compresses via dictionary encoding
- **Fast DuckDB queries**: Predicate pushdown on pressure, temperature, etc.
- **Memory efficient**: Can process 1000s of profiles without loading into RAM

## Processing Pipeline

### Phase 1: Download (2s)

```python
# Concurrent HTTPS download using httpx
async with httpx.AsyncClient() as client:
    tasks = [
        client.get(f"https://data-argo.ifremer.fr/{float_id}_prof.nc"),
        client.get(f"https://data-argo.ifremer.fr/{float_id}_meta.nc"),
        client.get(f"https://data-argo.ifremer.fr/{float_id}_tech.nc"),
    ]
    responses = await asyncio.gather(*tasks)
```

### Phase 2: Parse (0.5s)

xarray-based vectorized extraction followed by loop-based row denormalization:

```python
# xarray reads all profiles at once
ds = xr.open_dataset(f"{float_id}_prof.nc")

# Vectorized extraction (NumPy operations)
temperatures = ds['TEMP'].values  # (n_profiles, n_levels) array
salinities = ds['PSAL'].values
pressures = ds['PRES'].values

# Build denormalized rows (one row per depth level)
rows = []
for cycle_idx in range(n_profiles):
    for level_idx in range(n_levels):
        rows.append({
            'float_id': float_id,
            'cycle_number': cycle_idx,
            'level': level_idx,
            'pressure': pressures[cycle_idx, level_idx],
            'temperature': temperatures[cycle_idx, level_idx],
            'salinity': salinities[cycle_idx, level_idx],
            # ... additional fields
        })
```

### Phase 3: Upload (2s)

Parallel uploads to PostgreSQL and S3:

```python
# Write to PostgreSQL (metadata)
db.execute_values(
    "INSERT INTO argo_float_metadata (float_id, wmo_number, ...) VALUES (%s, %s, ...)",
    metadata
)

# Write to S3 (time-series)
table = pa.Table.from_pylist(rows)
pq.write_table(table, f"s3://atlas/profiles/{float_id}/data.parquet")
```

## Database Schema

### PostgreSQL Tables

```sql
-- Float metadata (1 row per float)
CREATE TABLE argo_float_metadata (
    float_id BIGINT PRIMARY KEY,
    wmo_number TEXT UNIQUE NOT NULL,
    float_type TEXT,
    status TEXT DEFAULT 'UNKNOWN',
    data_centre TEXT NOT NULL,
    project_name TEXT,
    operating_institution TEXT,
    platform_type TEXT,
    platform_maker TEXT,
    pi_name TEXT,
    launch_date TIMESTAMPTZ,
    launch_lat REAL,
    launch_lon REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status ON argo_float_metadata(status);
CREATE INDEX idx_project ON argo_float_metadata(project_name);

-- Current position (1 row per float, updated frequently)
CREATE TABLE argo_float_status (
    float_id BIGINT PRIMARY KEY REFERENCES argo_float_metadata,
    location GEOMETRY(POINT, 4326),  -- PostGIS spatial index
    cycle_number INT,
    battery_percent INT,
    last_update TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location ON argo_float_status USING GIST(location);
```

### Parquet Schema (S3)

Located at: `s3://atlas/profiles/{float_id}/data.parquet`

**Fields** (denormalized "long" format):

- `float_id` (BIGINT) - dictionary compressed
- `cycle_number` (DOUBLE) - dictionary + delta compressed
- `level` (BIGINT) - 0 to N_LEVELS-1
- `profile_timestamp` (TIMESTAMP WITH TIME ZONE) - delta encoded
- `latitude` (DOUBLE) - dictionary + delta
- `longitude` (DOUBLE)
- `pressure` (DOUBLE) - dbar (≈ meters)
- `temperature` (DOUBLE) - °C
- `salinity` (DOUBLE) - PSU
- `temperature_adj` (DOUBLE) - adjusted (delayed-mode)
- `salinity_adj` (DOUBLE)
- `oxygen` (DOUBLE) - µmol/kg
- `chlorophyll` (DOUBLE)
- `nitrate` (DOUBLE)
- Quality flags (VARCHAR): `pres_qc`, `temp_qc`, `psal_qc`, etc.
- `data_mode` (VARCHAR) - 'R','D','A'

**Compression**: Parquet default (snappy). Typical compression ratio: 8:1

## Performance Analysis

### Current Timing (January 2026)

```
Float: 2902232 (348 profiles, ~87K rows per profile)

Download:  2.40s  (concurrent HTTPS)
Parse:     0.18s  (xarray vectorized)
Upload:   1.57s  (PostgreSQL + S3 Parquet)
─────────────────
Total:    4.15s per float ~Avg (2-5 sec/float)
```
