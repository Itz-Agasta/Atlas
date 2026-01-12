# DuckDB Architecture & Parquet Schema

> Reference for the denormalized time-series data format used by Atlas.  
> **Last Updated**: January 2026  
> **Status**: Active and in use

## Overview

Atlas uses a **denormalized "long" format** for Parquet files stored in S3. This design enables:

- **Fast DuckDB queries**: Predicate pushdown, vectorized operations
- **Efficient compression**: Dictionary encoding for repeated values (float_id, cycle)
- **Flexible analysis**: One row per depth level allows direct statistical queries
- **Cost effective**: Parquet compression achieves 8:1 ratio vs normalized PostgreSQL

## File Structure

**Location**: `s3://atlas/profiles/{float_id}/data.parquet`

Each file contains all profiles (cycles) for a single float in denormalized format.

### Denormalized Schema

One row = one measurement at one depth level per profile:

````sql
-- Logical schema (as seen from DuckDB)
CREATE TABLE argo_measurements (
    -- Identity & Partitioning
    float_id        BIGINT,       -- dictionary encoded
    cycle_number    DOUBLE,       -- dictionary + delta encoded
    level           BIGINT,       -- 0 … N_LEVELS-1

    -- Spatiotemporal (per profile, repeated but compressed)
    profile_timestamp TIMESTAMP WITH TIME ZONE,  -- delta encoded
    latitude          DOUBLE,      -- dictionary + delta (nullable)
    longitude         DOUBLE,      -- (nullable)

    -- Core Measurements
    pressure          DOUBLE,      -- dbar ≈ depth in meters
    temperature       DOUBLE,      -- °C
    salinity          DOUBLE,      -- PSU

    -- Quality Flags
    position_qc       VARCHAR,     -- 1=good, 2=probably good, 3=uncertain, etc.
    pres_qc           VARCHAR,
    temp_qc           VARCHAR,
    psal_qc           VARCHAR,

    -- Adjusted Values (delayed-mode processing)
    temperature_adj   DOUBLE,      -- May be NULL for real-time data
    salinity_adj      DOUBLE,
    pressure_adj      DOUBLE,
    temp_adj_qc       VARCHAR,
    psal_adj_qc       VARCHAR,

    -- Provenance & Mode
    data_mode         VARCHAR,     -- 'R' (realtime), 'D' (delayed), 'A' (adjusted)

    -- BGC (Biogeochemical) Sensors - ~80% NULL (sparse)
    oxygen            DOUBLE,      -- µmol/kg
    oxygen_qc         VARCHAR,
    chlorophyll       DOUBLE,      -- mg/m³
    chlorophyll_qc    VARCHAR,
    nitrate           DOUBLE,      -- mmol/m³
    nitrate_qc        VARCHAR,


## Why Denormalized?

**Normalized Approach** (87K rows per float):

```sql
-- One row per depth level
float_id | cycle | level | temperature
─────────────────────────────────────
2902226  | 1     | 0     | 28.5
2902226  | 1     | 1     | 28.4
2902226  | 1     | 2     | 28.3
-- ... 87,000 rows total
````

**Cost**:

- Storage: 87K rows × ~200 bytes = 17MB uncompressed
- Query: Must JOIN with metadata, aggregate, etc.
- Slow time-series queries

**Denormalized Approach** (our choice, ~87K rows per float):

```sql
-- Same 87K rows, but one Parquet file
-- Compression: 17MB → ~2MB (8:1 ratio)
-- Query: Direct access, no joins needed
```

**Advantages**:

- **Compression**: Dictionary encoding of float_id, cycle_number → 8:1 compression
- **Speed**: DuckDB predicate pushdown on pressure, temperature directly
- **Joins not needed**: All spatiotemporal data in one table
- **Cost**: $0.10/GB storage instead of $0.50/GB in PostgreSQL

## S3 Storage Structure

```
s3://atlas/
└── profiles/
    ├── 2902226/
    │   └── data.parquet         (5.4MB, 87K rows, 371 profiles)
    ├── 2902227/
    │   └── data.parquet
    └── 2902235/
        └── data.parquet
```

Each file is a complete Parquet dataset for that float.

## DuckDB Query Examples

### 1. Get All Profiles for a Float

```sql
SELECT DISTINCT cycle_number, profile_timestamp, latitude, longitude
FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
WHERE temperature IS NOT NULL
ORDER BY cycle_number
```

### 2. Temperature Profile at Specific Depth

```sql
SELECT cycle_number, profile_timestamp, temperature
FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
WHERE pressure BETWEEN 100 AND 110  -- ~100m depth
ORDER BY cycle_number
```

### 3. Temperature Trend Over Time

```sql
SELECT
  cycle_number,
  profile_timestamp,
  AVG(temperature) as avg_temp,
  MIN(temperature) as min_temp,
  MAX(temperature) as max_temp
FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
WHERE pressure < 50  -- surface waters
GROUP BY cycle_number, profile_timestamp
ORDER BY cycle_number
```

### 4. Profile Statistics

```sql
SELECT
  cycle_number,
  COUNT(*) as n_levels,
  MAX(pressure) as max_depth,
  COUNT(CASE WHEN temperature_adj IS NOT NULL THEN 1 END) as adjusted_temps
FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
GROUP BY cycle_number
ORDER BY cycle_number
```

### 5. Quality Control Analysis

```sql
SELECT
  data_mode,
  COUNT(*) as row_count,
  COUNT(CASE WHEN temp_qc = '1' THEN 1 END) as good_quality_temps
FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
WHERE temperature IS NOT NULL
GROUP BY data_mode
```

## Compression Strategy

**Parquet Compression**: Snappy (default)

Expected ratios:

- Raw NetCDF: 5.4MB (single file)
- Parquet uncompressed: 17MB (87K rows × ~200 bytes)
- Parquet compressed: 2MB (8:1 ratio)

**Why compression is effective**:

1. **Repeated values**: float_id (1 value), cycle_number (350 values) → dictionary encoding
2. **Delta encoding**: Timestamps, depths (monotonic) → delta encoding
3. **Sparse data**: NULLs in BGC fields → no storage overhead

## Column Details

### Spatiotemporal Columns

- **profile_timestamp**: When the profile was recorded (UTC)
- **latitude/longitude**: Location of the float at profile time (can be NULL)
- **pressure**: Depth equivalent in decibar (~meters)

### Quality Flags

Based on IFREMER QC standards:

- `'0'`: No QC performed
- `'1'`: Good
- `'2'`: Probably good
- `'3'`: Probably bad
- `'4'`: Bad
- `'8'`: Estimated
- `'9'`: Missing

### BGC Data

Optional biogeochemical sensors (sparse, ~80% NULL):

- **oxygen**: Dissolved O2 (µmol/kg)
- **chlorophyll**: Fluorescence-derived (mg/m³)
- **nitrate**: Estimated (mmol/m³)

Future additions: pH, CDOM, backscatter

## Inspecting Parquet Files

```bash
# Show schema
duckdb -c "DESCRIBE SELECT * FROM read_parquet('s3://atlas/profiles/2902226/data.parquet');"

# Show metadata
duckdb -c "SELECT COUNT(*) as rows, COUNT(DISTINCT cycle_number) as profiles FROM read_parquet('s3://atlas/profiles/2902226/data.parquet');"

# Sample data
duckdb -c "SELECT * FROM read_parquet('s3://atlas/profiles/2902226/data.parquet') LIMIT 10;"
```

| column_name       | column_type              | null | key  | default | extra |
| ----------------- | ------------------------ | ---- | ---- | ------- | ----- |
| float_id          | BIGINT                   | YES  | NULL | NULL    | NULL  |
| cycle_number      | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| level             | BIGINT                   | YES  | NULL | NULL    | NULL  |
| profile_timestamp | TIMESTAMP WITH TIME ZONE | YES  | NULL | NULL    | NULL  |
| latitude          | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| longitude         | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| pressure          | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| temperature       | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| salinity          | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| position_qc       | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| pres_qc           | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| temp_qc           | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| psal_qc           | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| temperature_adj   | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| salinity_adj      | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| pressure_adj      | DOUBLE                   | YES  | NULL | NULL    | NULL  |
| temp_adj_qc       | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| psal_adj_qc       | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| data_mode         | VARCHAR                  | YES  | NULL | NULL    | NULL  |
| oxygen            | INTEGER                  | YES  | NULL | NULL    | NULL  |
| oxygen_qc         | INTEGER                  | YES  | NULL | NULL    | NULL  |
| chlorophyll       | INTEGER                  | YES  | NULL | NULL    | NULL  |
| chlorophyll_qc    | INTEGER                  | YES  | NULL | NULL    | NULL  |
| nitrate           | INTEGER                  | YES  | NULL | NULL    | NULL  |
| nitrate_qc        | INTEGER                  | YES  | NULL | NULL    | NULL  |
| year              | BIGINT                   | YES  | NULL | NULL    | NULL  |
| month             | BIGINT                   | YES  | NULL | NULL    | NULL  |

(27 rows, 6 columns)
