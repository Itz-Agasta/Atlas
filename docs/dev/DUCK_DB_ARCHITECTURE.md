# Duck-db Architecture & Schemas

We use a **Denormalized "Long" Format** schema. This means we flatten the arrays so that **one row = one measurement at one depth**.

```sql
-- File: s3://atlas/profiles/{float_id}/data.parquet
-- DuckDB CREATE Statement (reference for devs)
CREATE TABLE argo_measurements (
    -- Identity & partitioning
    float_id        BIGINT,     -- dictionary
    cycle_number    DOUBLE,     -- dictionary
    level           BIGINT,     -- 0 … N_LEVELS-1  (critical!)

    -- Spatiotemporal (per profile, repeated but delta/dictionary crush it)
    profile_timestamp TIMESTAMP WITH TIME ZONE,  -- delta encoded (can be NULL if invalid)
    latitude          DOUBLE,      -- dictionary + delta (can be NULL)
    longitude         DOUBLE,      -- can be NULL

    -- Core measurements (always present)
    pressure          DOUBLE,     -- dbar ≈ depth in meters
    temperature       DOUBLE,     -- °C, gorilla
    salinity          DOUBLE,     -- PSU, gorilla

    -- Quality flags (single ASCII char -> dictionary heaven)
    position_qc       VARCHAR,
    pres_qc           VARCHAR,
    temp_qc           VARCHAR,
    psal_qc           VARCHAR,

    -- Adjusted values (delayed-mode, often better)
    temperature_adj   DOUBLE,
    salinity_adj      DOUBLE,
    pressure_adj      DOUBLE,  -- renamed from pres_adj to match code
    temp_adj_qc       VARCHAR,
    psal_adj_qc       VARCHAR,

    -- Provenance
    data_mode         VARCHAR,   -- 'R','D','A' (can be NULL)

    -- Optional BGC sensors (80–95% NULL → sparse encoding)
    oxygen            DOUBLE,    -- µmol/kg (inferred as DOUBLE in some files)
    oxygen_qc         VARCHAR,
    chlorophyll       DOUBLE,
    chlorophyll_qc    VARCHAR,
    nitrate           DOUBLE,
    nitrate_qc        VARCHAR,
    -- add pH, CDOM, backscatter, etc. here later

    -- For predicate pushdown only (not for partitioning directories)
    year              BIGINT,    -- extracted from profile_timestamp
    month             BIGINT
)
-- Physical layout:
-- • One Parquet file per float: s3://atlas/profiles/{float_id}/data.parquet
-- • Row groups: 500k–2M rows (≈ one float or a few)
-- • Sort inside each row group: float_id, cycle_number, level
-- • Compression: Snappy -> expect 10–15× overall
-- • Dictionary encoding on all categorical columns (float_id, cycle_number, qc flags, data_mode)"
```

**level:** Not directly in JSON. Generate as 0-based index (0 to N_LEVELS-1) for each profile's depth levels. For example, for a profile with 59 levels, create rows with level=0,1,...,58.

## 2. S3 Storage Structure

We organize files in `Cloudflare R2` using **Hive-style partitioning**. This allows DuckDB to automatically understand which file belongs to which float just by looking at the folder name.

```text
s3://atlas/
└── profiles/
    ├── 2902226/
    │   └── data.parquet    <-- Contains all profiles for that float (5.4MB, 371 profiles, 2017-2021)
    ├── 2902227/
    │   └── data.parquet
    └── 2902235/
        └── data.parquet
```

> Later we can add traj.parquet too for that float under.

## Parquet Schema Example

To inspect a Parquet file with DuckDB:

```bash
duckdb -c "DESCRIBE SELECT * FROM read_parquet('./apps/workers/data/parquet_staging/2902226_profiles.parquet');"
```

Example output:

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
