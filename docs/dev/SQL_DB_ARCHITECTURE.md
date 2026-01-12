# Atlas SQL Database Architecture

> Reference for the PostgreSQL metadata layer.  
> **Last Updated**: January 2026  
> **Status**: Active and maintained

## Overview

Atlas uses **PostgreSQL + PostGIS** as the metadata layer for ARGO float information:

- **Purpose**: Fast metadata lookups, spatial queries, status tracking
- **Data**: Float metadata (static), current status (updated per sync), processing logs
- **Time-series data**: Stored separately in Parquet on S3 (see [DUCK_DB_ARCHITECTURE.md](DUCK_DB_ARCHITECTURE.md))

**Key Design Principle**: Keep PostgreSQL lean; use S3 Parquet for time-series data.

## Database Schema

### 1. `argo_float_metadata` (Static, Read-heavy)

Contains fixed float information that rarely changes.

**Columns**:

| Column                  | Type                     | Constraints       | Notes                                |
| ----------------------- | ------------------------ | ----------------- | ------------------------------------ |
| `float_id`              | BIGINT                   | PRIMARY KEY       | Unique identifier per float          |
| `wmo_number`            | TEXT                     | UNIQUE NOT NULL   | Official IFREMER ID (e.g., "2902235" |
| `status`                | TEXT                     | DEFAULT 'UNKNOWN' | ACTIVE, INACTIVE, DEAD, UNKNOWN      |
| `float_type`            | TEXT                     |                   | core, oxygen, biogeochemical, deep   |
| `data_centre`           | TEXT                     | NOT NULL          | Data center code (e.g., "IN", "GE")  |
| `project_name`          | TEXT                     |                   | e.g., "Argo India", "OceanSITES"     |
| `operating_institution` | TEXT                     |                   | e.g., "INCOIS", "MIO-OD"             |
| `pi_name`               | TEXT                     |                   | Principal investigator name          |
| `platform_type`         | TEXT                     |                   | e.g., "ARVOR", "APEX", "NEMO"        |
| `platform_maker`        | TEXT                     |                   | Manufacturer (e.g., "NKE")           |
| `float_serial_no`       | TEXT                     |                   | Serial number                        |
| `launch_date`           | TIMESTAMP WITH TIME ZONE |                   | Deployment date                      |
| `launch_lat`            | REAL                     |                   | Deployment latitude                  |
| `launch_lon`            | REAL                     |                   | Deployment longitude                 |
| `start_mission_date`    | TIMESTAMP WITH TIME ZONE |                   | Mission start                        |
| `end_mission_date`      | TIMESTAMP WITH TIME ZONE |                   | Mission end (nullable if ongoing)    |
| `created_at`            | TIMESTAMP WITH TIME ZONE | DEFAULT NOW()     | When added to Atlas                  |
| `updated_at`            | TIMESTAMP WITH TIME ZONE | DEFAULT NOW()     | Last metadata update                 |

**Indexes**:

```sql
CREATE UNIQUE INDEX idx_float_id ON argo_float_metadata(float_id);
CREATE UNIQUE INDEX idx_wmo_number ON argo_float_metadata(wmo_number);
CREATE INDEX idx_status ON argo_float_metadata(status);
CREATE INDEX idx_project_name ON argo_float_metadata(project_name);
CREATE INDEX idx_float_type ON argo_float_metadata(float_type);
```

**Example Row**:

```sql
INSERT INTO argo_float_metadata VALUES (
  2902226,
  '2902226',
  'ACTIVE',
  'core',
  'IN',
  'Argo India',
  'INCOIS',
  'Argo India PI',
  'ARVOR',
  'NKE',
  'SN12345',
  '2017-06-29'::timestamptz,
  -5.5,
  70.3,
  '2017-06-29'::timestamptz,
  NULL,
  NOW(),
  NOW()
);
```

### 2. `argo_float_status` (Hot Layer, Write-heavy)

Current position and status, updated on each sync. One row per float.

**Columns**:

| Column             | Type                     | Constraints             | Notes                            |
| ------------------ | ------------------------ | ----------------------- | -------------------------------- |
| `float_id`         | BIGINT                   | PRIMARY KEY, REFERENCES | Links to metadata table          |
| `location`         | GEOMETRY(POINT, 4326)    |                         | PostGIS point (lon, lat)         |
| `cycle_number`     | BIGINT                   |                         | Last profile cycle               |
| `battery_percent`  | INT                      |                         | 0-100, NULL if unknown           |
| `last_temperature` | REAL                     |                         | Surface temperature from Parquet |
| `last_salinity`    | REAL                     |                         | Surface salinity from Parquet    |
| `last_update`      | TIMESTAMP WITH TIME ZONE |                         | When status was last updated     |
| `updated_at`       | TIMESTAMP WITH TIME ZONE | DEFAULT NOW()           | Record update timestamp          |

**Indexes**:

```sql
CREATE UNIQUE INDEX idx_float_status_pk ON argo_float_status(float_id);
CREATE INDEX idx_float_status_location ON argo_float_status USING GIST(location);
CREATE INDEX idx_float_status_cycle ON argo_float_status(cycle_number);
```

**Constraints**:

```sql
ALTER TABLE argo_float_status
  ADD CONSTRAINT fk_float_id FOREIGN KEY (float_id)
  REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE;
```

**Example Row**:

```sql
INSERT INTO argo_float_status VALUES (
  2902226,
  ST_GeomFromText('POINT(70.3 -5.5)', 4326),  -- (lon, lat)
  371,
  85,
  28.5,
  34.2,
  NOW(),
  NOW()
);
```

### 3. `processing_log` (Audit Trail)

Records sync operations for debugging and observability.

**Columns**:

| Column               | Type                     | Notes                              |
| -------------------- | ------------------------ | ---------------------------------- |
| `id`                 | SERIAL                   | PRIMARY KEY                        |
| `float_id`           | BIGINT                   | Float being processed              |
| `operation`          | TEXT                     | e.g., "FULL_SYNC", "METADATA_SYNC" |
| `status`             | TEXT                     | "SUCCESS" or "ERROR"               |
| `error_details`      | JSONB                    | Error message if failed            |
| `processing_time_ms` | BIGINT                   | Time in milliseconds               |
| `profiles_synced`    | INT                      | Number of new/updated profiles     |
| `created_at`         | TIMESTAMP WITH TIME ZONE | DEFAULT NOW()                      |

**Indexes**:

```sql
CREATE INDEX idx_processing_log_float ON processing_log(float_id);
CREATE INDEX idx_processing_log_status ON processing_log(status);
CREATE INDEX idx_processing_log_created ON processing_log(created_at DESC);
CREATE INDEX idx_processing_log_float_time ON processing_log(float_id, created_at DESC);
```

## Common Queries

### Get Float Metadata

```sql
SELECT * FROM argo_float_metadata
WHERE wmo_number = '2902226'
  OR float_id = 2902226;
```

### Get Current Position

```sql
SELECT
  f.wmo_number,
  ST_X(s.location::geometry) as longitude,
  ST_Y(s.location::geometry) as latitude,
  s.cycle_number,
  s.battery_percent,
  s.last_update
FROM argo_float_status s
JOIN argo_float_metadata f ON s.float_id = f.float_id
WHERE f.float_id = 2902226;
```

### Find Floats Near Location (PostGIS)

```sql
-- All active floats within 500km of Sri Lanka
SELECT
  f.wmo_number,
  f.operating_institution,
  ST_AsText(s.location) as position
FROM argo_float_status s
JOIN argo_float_metadata f ON s.float_id = f.float_id
WHERE f.status = 'ACTIVE'
  AND ST_DWithin(
    s.location::geography,
    ST_GeogFromText('POINT(80.77 7.87)'),  -- Sri Lanka center
    500000  -- 500km in meters
  )
ORDER BY ST_Distance(s.location::geography, ST_GeogFromText('POINT(80.77 7.87)'));
```

### Bounding Box Query (Indian Ocean)

```sql
SELECT
  f.wmo_number,
  s.cycle_number,
  s.battery_percent
FROM argo_float_status s
JOIN argo_float_metadata f ON s.float_id = f.float_id
WHERE ST_Intersects(
  s.location,
  ST_MakeEnvelope(60, -10, 100, 20, 4326)  -- (lon_min, lat_min, lon_max, lat_max)
);
```

### Sync Status History

```sql
SELECT
  float_id,
  operation,
  status,
  processing_time_ms,
  profiles_synced,
  created_at
FROM processing_log
WHERE float_id = 2902226
ORDER BY created_at DESC
LIMIT 10;
```

## Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

**PostGIS Version**: 3.3+

## Performance Considerations

### Index Strategy

- **Metadata lookups**: Indexed on `float_id`, `wmo_number`, `status`
- **Spatial queries**: GIST index on `location` for fast range queries
- **Sync logs**: Indexed on `created_at DESC` for recent history

### Query Performance

| Query Type                | Execution Time | Index Used            |
| ------------------------- | -------------- | --------------------- |
| Float by ID               | <1ms           | PK index              |
| 500km radius search       | 50-100ms       | GIST (location)       |
| Filter by status          | 10-50ms        | B-tree (status)       |
| Bounding box (100 floats) | 100-200ms      | GIST + spatial filter |

### Scaling Notes

- **Metadata table**: ~10K-50K floats, minimal growth
- **Status table**: Same size, updated frequently but fast (index on PK)
- **Processing logs**: Grows rapidly (~1K entries/day); archive quarterly

## Future Considerations

1. **Replication**: Set up read replicas for spatial query distribution
2. **Partitioning**: Partition processing_log by date range
3. **Caching**: Cache float status in Redis for high-traffic queries
4. **Data retention**: Archive old processing logs (>30 days)
