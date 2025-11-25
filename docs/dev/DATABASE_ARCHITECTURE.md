# Atlas SQL Database Architecture

**Version:** 1.6  
**Last Updated:** November 23, 2025  
**PostgreSQL Version:** 17 (Neon Serverless)

---

## Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Database Schema](#database-schema)
4. [PostgreSQL Extensions](#postgresql-extensions)
5. [Data Model Patterns](#data-model-patterns)
6. [Index Strategy](#index-strategy)
7. [Benefits for AI Agents](#benefits-for-ai-agents)
8. [Benefits for Frontend](#benefits-for-frontend)
9. [Performance Optimizations](#performance-optimizations)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The Atlas SQL database is designed to store and query oceanographic data from the **ARGO Float Network**, a global array of ~4,000 autonomous profiling floats that measure ocean properties (temperature, salinity, oxygen, chlorophyll) from surface to 2000m depth.

### Key Design Goals

- **Flexible Schema**: Support variable oceanographic parameters without rigid column structure
- **Spatial Queries**: Enable geographic filtering for floats and profiles
- **Fast Analytics**: Pre-compute common metrics for dashboard performance
- **AI-Friendly**: Structured metadata + flexible measurements for LLM processing
- **Observability**: Track processing operations with detailed timing and error logs

---

## Design Philosophy

### 1. **Hot/Cold Data Separation**

The architecture separates **static metadata** from **time-series profiles** and **current state**:

- **Static Layer** (`argo_float_metadata`): Deployment info, never changes
- **Hot Layer** (`argo_float_positions`): Current position, updated with each cycle (Copy stored in Redis too)
- **Cold Layer** (`argo_profiles`): Historical time-series data, append-only

**Why?** This pattern optimizes queries:

- Dashboard queries only need current position (hot layer)
- Historical analysis queries cold layer without metadata joins
- Static metadata cached indefinitely

### 2. **JSONB for Measurements**

Oceanographic profiles have **variable parameters** depending on float instrumentation:

- All floats: Temperature (TEMP), Salinity (PSAL)
- Some floats: Dissolved Oxygen (DOXY), Chlorophyll-a (CHLA), pH, Nitrate
- Future: Biogeochemical floats with 10+ parameters

**Traditional Approach (Rejected):**

```sql
CREATE TABLE measurements (
  profile_id INT,
  depth REAL,
  temperature REAL,
  salinity REAL,
  oxygen REAL,       -- NULL for most floats
  chlorophyll REAL,  -- NULL for most floats
  ...
);
-- Problems:
-- - Wide tables with mostly NULL values
-- - Schema migration for new parameters
-- - Inefficient storage (NULL overhead)
```

**Our JSONB Approach:**

```sql
measurements JSONB DEFAULT '{}'::jsonb
-- Example structure:
{
  "TEMP": [20.5, 19.8, 18.2, ...],
  "PSAL": [34.5, 34.6, 34.7, ...],
  "DOXY": [200, 190, 180, ...],  -- Only if float has sensor
  "CHLA": [0.8, 0.9, 1.0, ...],  -- Only if float has sensor
  "depths": [0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, ...]
}
```

**Benefits:**

- **Flexible**: Add new parameters without schema changes
- **Compact**: Only store measured parameters
- **Fast**: GIN indexes enable containment queries (`@>`, `?`, `?&`)
- **JSON-Native**: Direct export to APIs without transformation

**Trade-off:** Slightly slower than relational for complex aggregations, but materialized views solve this (see below).

### 3. **PostGIS for Spatial Data**

Ocean data is inherently **geographic**. Users query:

- "All floats within 500km of Sri Lanka"
- "Profiles in the Indian Ocean monsoon region"
- "Temperature gradient along 20°N latitude"

**Why PostGIS?**

PostGIS provides:

- **Geometry Types**: `POINT(lon, lat)` with SRID 4326 (WGS84)
- **Spatial Indexes**: GIST indexes for fast bounding box queries
- **Geographic Functions**: Distance, area, containment, buffering
- **Standards-Compliant**: OGC Simple Features, ISO SQL/MM

**Example Queries:**

```sql
-- Find floats within 500km of Sri Lanka
SELECT * FROM argo_profiles
WHERE ST_DWithin(
  surface_location::geography,
  ST_SetSRID(ST_MakePoint(80.7718, 7.8731), 4326)::geography,
  500000  -- 500km in meters
);

-- Find profiles in a bounding box (Indian Ocean)
SELECT * FROM argo_profiles
WHERE ST_Intersects(
  surface_location,
  ST_MakeEnvelope(60, -10, 100, 20, 4326)
);
```

**Performance:** GIST index on `surface_location` enables O(log N) spatial queries instead of O(N) sequential scans.

### 4. **Materialized Views for Analytics**

JSONB flexibility comes with a cost: array expansion for aggregations.

**Problem:**

```sql
-- This query is SLOW (requires JSONB array expansion for every row)
SELECT
  AVG((measurements->'TEMP'->>0)::REAL) AS avg_surface_temp
FROM argo_profiles
WHERE profile_time > NOW() - INTERVAL '30 days';
```

**Solution: Materialized View**

Pre-compute common metrics at **standard oceanographic depths** (0m, 100m, 500m, 1000m):

```sql
CREATE MATERIALIZED VIEW argo_measurements_summary AS
SELECT
  profile_id,
  float_id,
  cycle,
  profile_time,
  surface_lat,
  surface_lon,
  -- Extract surface measurements (0-10m)
  (SELECT (elem->>'temperature')::REAL
   FROM jsonb_array_elements(measurements) elem
   WHERE (elem->>'depth')::REAL BETWEEN 0 AND 10
   LIMIT 1) AS surface_temp,
  -- Extract 100m, 500m, 1000m depths...
FROM argo_profiles;
```

**Benefits:**

- **10-100x faster** queries (no runtime JSONB expansion)
- **Indexed** on time, location, depth layers
- **Dashboard-Ready** for common visualizations

**Refresh Strategy:**

- On-demand: `REFRESH MATERIALIZED VIEW argo_measurements_summary;`
- Scheduled: Daily cron job or database trigger
- Incremental (future): Use `CONCURRENTLY` for zero-downtime refreshes

---

## Database Schema

### Entity Relationship Diagram

![Db arch](../imgs/sql_db_arch_v1.6.png)

### Table Descriptions

#### 1. `argo_float_metadata` (Static Metadata)

**Purpose:** Store deployment information that never changes.

**Key Fields:**

- `float_id` (PK): Unique identifier for each float
- `wmo_number` (UK): World Meteorological Organization identifier (unique global ID)
- `float_type`: Model (e.g., "APEX", "NAVIS", "ARVOR")
- `deployment_date`, `deployment_lat/lon`, `deployment_country`: Deployment info
- `status`: `ACTIVE` or `INACTIVE` (dead battery, lost)

**Relationships:**

- Parent to `argo_profiles` (1:N) - CASCADE DELETE
- Parent to `argo_float_positions` (1:1) - CASCADE DELETE
- Parent to `processing_log` (1:N)
- Parent to `sync_manifest` (1:N)

**Indexes:**

- Primary key on `float_id`
- Unique index on `wmo_number`
- Index on `wmo_number` for fast lookups

---

#### 2. `argo_float_positions` (Hot Layer)

**Purpose:** Store current position updated with each cycle (replaces previous value).

**Key Fields:**

- `float_id` (PK/FK): References `argo_float_metadata`
- `current_lat/lon`: Latest position
- `cycle_number`: Latest cycle completed
- `last_temp/last_salinity`: Surface value cache (denormalized for performance)

**Why Separate Table?**

- Dashboard queries only need current position
- High update frequency (every 10 days per float)
- Optimized for reads (no historical data)

**Indexes:**

- Primary key on `float_id` (also FK to metadata)

---

#### 3. `argo_profiles` (Core Time-Series Data)

**Purpose:** Store historical oceanographic profiles (append-only).

**Key Fields:**

- `id` (PK): Auto-increment serial ID
- `float_id` (FK): References `argo_float_metadata`
- `cycle`: Profile cycle number (0, 1, 2, ...)
- `profile_time`: Timestamp of measurement
- `surface_location`: PostGIS POINT for spatial queries
- `measurements`: JSONB array of depth measurements
- `quality_flag`: `REAL_TIME` (automated QC) or `DELAYED_MODE` (expert QC)

**JSONB Measurements Structure:**

```json
{
  "TEMP": [20.5, 19.8, 18.2, 15.3, 12.1, 8.5, 5.2, 3.8, 2.5],
  "PSAL": [34.5, 34.6, 34.7, 34.8, 34.9, 35.0, 35.1, 35.1, 35.2],
  "DOXY": [200, 190, 180, 170, 160, 150, 140, 130, 120],
  "CHLA": [0.8, 0.9, 1.0, 0.7, 0.5, 0.2, 0.1, 0.05, 0.02],
  "depths": [0, 5, 10, 20, 50, 100, 200, 500, 1000]
}
```

**Indexes:**

- Primary key on `id`
- Composite index on `(float_id, profile_time)` for time-series queries
- Index on `profile_time` for temporal filtering
- Index on `quality_flag` for QC filtering
- **GIST spatial index** on `surface_location` for geographic queries
- **GIN index** on `measurements` for containment queries
- **Unique constraint** on `(float_id, cycle)` to prevent duplicates

**Storage Estimate:**

- ~255 profiles @ 47 MB total = ~184 KB per profile
- Breakdown: JSONB (~150 KB), metadata (~34 KB)

---

#### 4. `processing_log` (Monitoring)

**Purpose:** Track all operations with timing and error details.

**Key Fields:**

- `float_id`: Associated float
- `operation`: `FTP_DOWNLOAD`, `PARSE_NETCDF`, `INSERT_PROFILES`, `DATABASE_UPLOAD`
- `status`: `SUCCESS`, `ERROR`
- `message`: Human-readable summary (includes timing breakdown)
- `error_details`: JSONB with stack traces, error codes
- `processing_time_ms`: Total operation time in milliseconds

**Example Log Entry:**

```json
{
  "float_id": 2902228,
  "operation": "PROCESS_FLOAT",
  "status": "SUCCESS",
  "message": "Total: 130.58s (Download: 0.00s, Process: 4.87s, Upload: 125.70s)",
  "processing_time_ms": 130575,
  "created_at": "2025-11-22T10:30:45Z"
}
```

**Indexes:**

- Composite index on `(float_id, operation)` for debugging
- Index on `created_at` for time-range queries

---

#### 5. `sync_manifest` (File Tracking)

**Purpose:** Track FTP downloads and S3 uploads to avoid redundant processing.

**Key Fields:**

- `float_id`: Associated float
- `file_name`: NetCDF filename (e.g., `2902228_prof.nc`)
- `remote_modified_time`: FTP server timestamp
- `local_modified_time`: Local download timestamp
- `sync_status`: `SYNCED`, `PENDING`, `FAILED`
- `s3_path`: S3 upload location

**Workflow:**

1. Check manifest for `file_name` and `remote_modified_time`
2. If file unchanged, skip download
3. If file changed, download and update manifest
4. After processing, update `sync_status` to `SYNCED`

**Indexes:**

- Composite index on `(float_id, file_name)` for lookup
- Index on `sync_status` for retry logic

---

#### 6. `argo_measurements_summary` (Materialized View)

**Purpose:** Pre-computed measurements at standard oceanographic depths for fast analytics.

**Key Fields:**

- `profile_id`: References `argo_profiles.id`
- `surface_temp/salinity`: 0-10m layer
- `temp_100m/salinity_100m`: 90-110m layer (closest to 100m)
- `temp_500m/salinity_500m`: 450-550m layer (closest to 500m)
- `temp_1000m/salinity_1000m`: 950-1050m layer (closest to 1000m)
- `measurement_count`: Number of depth samples

**Refresh Strategy:**

- Manual: `REFRESH MATERIALIZED VIEW argo_measurements_summary;`
- Scheduled: Daily cron job
- Future: Incremental refresh with `CONCURRENTLY`

**Performance Impact:**

- Query speed: **10-100x faster** than live JSONB expansion
- Storage: ~20% overhead (indexes + denormalized data)

---

## PostgreSQL Extensions

### 1. **PostGIS** (Spatial Extension)

**Version:** 3.5+ (bundled with Neon PostgreSQL 17)

**Capabilities:**

- **Geometry Types**: `POINT`, `LINESTRING`, `POLYGON`, `MULTIPOINT`, etc.
- **Spatial Reference Systems**: SRID 4326 (WGS84 lat/lon), SRID 3857 (Web Mercator)
- **Spatial Indexes**: GIST (Generalized Search Tree) for fast bounding box queries
- **Operators**: `ST_DWithin`, `ST_Intersects`, `ST_Contains`, `ST_Distance`
- **Aggregations**: `ST_Union`, `ST_Collect`, `ST_Extent`

**Why PostGIS?**

- **Standard**: OGC-compliant, works with GIS tools (QGIS, ArcGIS, Mapbox)
- **Performance**: GIST indexes enable O(log N) spatial queries
- **Precision**: Geographic calculations account for Earth's curvature
- **Integration**: Native JSONB export (`ST_AsGeoJSON`)

**Example Usage:**

```sql
-- Find all profiles within 1000km of a point
SELECT * FROM argo_profiles
WHERE ST_DWithin(
  surface_location::geography,
  ST_SetSRID(ST_MakePoint(80.0, 8.0), 4326)::geography,
  1000000  -- 1000km in meters
);

-- Calculate distance between two floats
SELECT ST_Distance(
  a.surface_location::geography,
  b.surface_location::geography
) / 1000 AS distance_km
FROM argo_profiles a, argo_profiles b
WHERE a.float_id = 2902228 AND b.float_id = 2902229;
```

**Functions Available:** 1000+ spatial functions (see branch structure tree for complete list).

---

### 2. **pg_stat_statements** (Query Performance Monitoring)

**Purpose:** Track query execution statistics for optimization.

**Capabilities:**

- **Query Tracking**: Stores normalized SQL with execution counts
- **Performance Metrics**: Total time, mean time, min/max time, stddev
- **Resource Usage**: Rows returned, blocks read/hit
- **Top Queries**: Identify slow queries for optimization

**Configuration:**

```sql
-- Enable extension
CREATE EXTENSION pg_stat_statements;

-- View top 10 slowest queries by total time
SELECT
  query,
  calls,
  total_exec_time / 1000 AS total_time_sec,
  mean_exec_time AS avg_time_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

**Use Cases:**

- Identify N+1 query problems
- Find missing indexes
- Optimize JSONB queries
- Monitor materialized view refresh performance

**Views:**

- `pg_stat_statements`: Query statistics
- `pg_stat_statements_info`: Extension metadata

---

### 3. **UUID-OSSP** (UUID Generation)

**Purpose:** Generate universally unique identifiers.

**Functions:**

- `uuid_generate_v1()`: Time-based UUID
- `uuid_generate_v4()`: Random UUID
- `uuid_generate_v5()`: Namespace + name UUID

**Detected in Branch:** Available in `neondb` schema (see functions tree).

**Future Use:** Could replace `serial` IDs with UUIDs for distributed systems.

---

## Data Model Patterns

### 1. **Single Transaction Uploads**

**Problem:** Early design opened 6 database connections per float (metadata, profiles, position, commit, log × 2).

**Solution:** Single persistent connection for entire float upload:

```python
# Python worker pattern
db_uploader.db.start_transaction()
try:
    upload_metadata()      # Uses same connection
    upload_profiles()      # Uses same connection
    update_position()      # Uses same connection
    db_uploader.db.commit_transaction()
except Exception as e:
    db_uploader.db.rollback_transaction()
```

**Benefits:**

- 83% reduction in connections (6 → 1)
- Atomic operations (all-or-nothing)
- Reduced network overhead

---

### 2. **Foreign Key Cascades**

All child tables use `ON DELETE CASCADE` to ensure referential integrity:

```sql
-- If float metadata is deleted, all related data is removed
argo_profiles.float_id REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE
argo_float_positions.float_id REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE
processing_log.float_id REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE
sync_manifest.float_id REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE
```

**Use Case:** Delete test data or inactive floats without orphaned records.

---

### 3. **Unique Constraints**

Prevent duplicate profiles for same float+cycle:

```sql
CONSTRAINT profiles_float_cycle_unique UNIQUE (float_id, cycle)
```

**Behavior:** Insert fails if duplicate detected (idempotent uploads).

---

### 4. **Default Timestamps**

All tables have automatic timestamps:

```sql
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

**Future Enhancement:** Add triggers to auto-update `updated_at` on row changes.

---

## Index Strategy

### 1. **B-Tree Indexes** (Default)

Used for exact matches and range queries:

```sql
-- Primary keys (auto-indexed)
argo_float_metadata.float_id
argo_profiles.id

-- Unique constraints (auto-indexed)
argo_float_metadata.wmo_number

-- Composite indexes for joins + filters
(float_id, profile_time)  -- Time-series queries
(float_id, operation)     -- Processing log debugging
(float_id, file_name)     -- Manifest lookups
```

**Query Example:**

```sql
-- Uses composite index (float_id, profile_time)
SELECT * FROM argo_profiles
WHERE float_id = 2902228
  AND profile_time > '2025-01-01';
```

---

### 2. **GIST Indexes** (Spatial)

Used for PostGIS geometry queries:

```sql
CREATE INDEX profiles_spatial_idx ON argo_profiles USING GIST (surface_location);
```

**Supported Operators:**

- `&&` (overlaps bounding box)
- `@>` (contains)
- `<@` (contained by)
- `ST_DWithin` (distance within)
- `ST_Intersects` (geometric intersection)

**Query Example:**

```sql
-- Uses GIST index on surface_location
SELECT * FROM argo_profiles
WHERE ST_Intersects(
  surface_location,
  ST_MakeEnvelope(60, -10, 100, 20, 4326)
);
```

---

### 3. **GIN Indexes** (JSONB)

Used for containment and key existence queries:

```sql
CREATE INDEX profiles_measurements_gin_idx ON argo_profiles USING GIN (measurements);
```

**Supported Operators:**

- `@>` (contains JSON)
- `?` (key exists)
- `?&` (all keys exist)
- `?|` (any key exists)

**Query Examples:**

```sql
-- Find profiles with DOXY measurements
SELECT * FROM argo_profiles
WHERE measurements ? 'DOXY';

-- Find profiles with both TEMP and CHLA
SELECT * FROM argo_profiles
WHERE measurements ?& ARRAY['TEMP', 'CHLA'];

-- Find profiles where TEMP array contains value > 25
SELECT * FROM argo_profiles
WHERE measurements @> '{"TEMP": [25.5]}';
```

**Trade-off:** GIN indexes are larger (~2-3x) but enable fast JSONB queries.

---

## Benefits for AI Agents

### 1. **Structured + Flexible Data Model**

**Problem:** Traditional oceanographic databases force rigid schemas that limit AI comprehension.

**Our Solution:**

- **Structured Metadata**: Clear foreign keys, typed columns (AI can reason about relationships)
- **Flexible Measurements**: JSONB allows variable parameters (AI doesn't need to know schema upfront)

**Example AI Query:**

```
User: "Show me chlorophyll trends for float 2902228"

AI Agent Process:
1. Query metadata: SELECT * FROM argo_float_metadata WHERE wmo_number = '2902228'
2. Check capabilities: SELECT DISTINCT jsonb_object_keys(measurements) FROM argo_profiles WHERE float_id = 2902228
3. Extract data: SELECT profile_time, measurements->'CHLA' FROM argo_profiles WHERE float_id = 2902228 ORDER BY profile_time
```

**Benefits:**

- AI doesn't need pre-training on schema
- Self-describing data (JSONB keys = parameter names)
- Clear foreign key relationships for context

---

### 2. **Materialized Views = Pre-Aggregated Context**

**Problem:** AI agents waste tokens expanding JSONB arrays for common metrics.

**Our Solution:** Materialized view provides ready-to-use aggregations:

```sql
-- AI-friendly query (no JSONB expansion)
SELECT
  profile_time,
  surface_temp,
  temp_100m,
  temp_500m,
  temp_1000m
FROM argo_measurements_summary
WHERE float_id = 2902228
  AND profile_time > '2025-01-01';
```

**Benefits:**

- Fast responses (10-100x faster)
- Reduced token usage (no array expansion in prompts)
- Standard oceanographic depths (0m, 100m, 500m, 1000m)

---

### 3. **Processing Logs = Debugging Context**

AI agents can diagnose issues by querying logs:

```sql
-- Check for recent errors
SELECT * FROM processing_log
WHERE status = 'ERROR'
  AND created_at > NOW() - INTERVAL '1 day';

-- Analyze performance bottlenecks
SELECT
  operation,
  AVG(processing_time_ms) AS avg_time_ms,
  COUNT(*) AS count
FROM processing_log
WHERE status = 'SUCCESS'
GROUP BY operation;
```

**Benefits:**

- Self-diagnosing system
- Clear error messages for AI interpretation
- Timing breakdown helps identify bottlenecks

---

### 4. **JSON-Native Export**

All data exports directly to JSON without transformation:

```sql
-- Export profile as JSON
SELECT jsonb_build_object(
  'float_id', float_id,
  'cycle', cycle,
  'time', profile_time,
  'location', ST_AsGeoJSON(surface_location)::jsonb,
  'measurements', measurements
) FROM argo_profiles WHERE id = 1;
```

**Benefits:**

- No ORM impedance mismatch
- Direct API integration
- LLM-friendly format (native JSON parsing)

---

## Benefits for Frontend

### 1. **Fast Dashboard Queries**

**Problem:** Real-time JSONB expansion is too slow for interactive dashboards.

**Solution:** Materialized view provides instant responses:

```typescript
// Frontend query (TypeScript/tRPC)
const recentProfiles = await db
  .select()
  .from(argo_measurements_summary)
  .where(
    and(
      eq(argo_measurements_summary.float_id, floatId),
      gte(argo_measurements_summary.profile_time, startDate)
    )
  )
  .orderBy(desc(argo_measurements_summary.profile_time));

// Returns in <10ms vs. 500-1000ms for JSONB expansion
```

**Performance Comparison:**
| Query Type | Live JSONB Expansion | Materialized View |
|------------|---------------------|-------------------|
| Single profile | 50-100ms | <5ms |
| 30-day window | 500-1000ms | <10ms |
| All floats | 5-10s | <50ms |

---

### 2. **Spatial Queries for Maps**

**Problem:** Geographic filtering on lat/lon columns requires full table scans.

**Solution:** PostGIS GIST index enables O(log N) spatial queries:

```typescript
// Find floats in viewport
const floatsInView = await db
  .select()
  .from(argo_profiles)
  .where(
    sql`ST_Intersects(
      surface_location,
      ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)
    )`
  );

// Returns in <20ms for any viewport size
```

**Map Integration:**

- GeoJSON export: `ST_AsGeoJSON(surface_location)`
- Bounding box queries: `ST_MakeEnvelope()`
- Distance queries: `ST_DWithin()`

---

### 3. **Flexible Chart Data**

**Problem:** Fixed schema limits chart types (scatter, line, heatmap, contour).

**Solution:** JSONB allows dynamic parameter selection:

```typescript
// User selects "Temperature vs. Salinity" scatter plot
const scatterData = await db
  .select({
    temp: sql`measurements->'TEMP'`,
    sal: sql`measurements->'PSAL'`,
    depths: sql`measurements->'depths'`,
  })
  .from(argo_profiles)
  .where(eq(argo_profiles.float_id, floatId));

// User switches to "Oxygen vs. Depth" - no schema change
const oxygenProfile = await db
  .select({
    oxygen: sql`measurements->'DOXY'`,
    depths: sql`measurements->'depths'`,
  })
  .from(argo_profiles)
  .where(eq(argo_profiles.float_id, floatId));
```

**Benefits:**

- Dynamic chart types without backend changes
- User-selected parameters (dropdowns)
- Future-proof for new sensors

---

### 4. **Real-Time Updates**

**Pattern:** Hot layer (`argo_float_positions`) optimized for live updates:

```typescript
// Dashboard polls current positions every 30 seconds
const liveFloats = await db
  .select()
  .from(argo_float_positions)
  .where(eq(argo_float_positions.float_id, floatId));

// Returns in <5ms (single-row lookup, no joins)
```

**Future Enhancement:** WebSocket subscriptions for live updates using Neon's logical replication.

---

## Performance Optimizations

### 1. **Bulk Inserts with execute_values**

Python worker uses `psycopg2.extras.execute_values` for batch inserts:

```python
# Insert 255 profiles in single query (vs. 255 separate INSERTs)
execute_values(
    cursor,
    """
    INSERT INTO argo_profiles
    (float_id, cycle, profile_time, measurements, surface_location)
    VALUES %s
    """,
    profiles,
    template="(%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))"
)
```

**Performance:** 255 profiles inserted in **125s** (vs. ~500s for individual INSERTs).

---

### 2. **Connection Pooling**

Neon's built-in connection pooling reduces overhead:

- Pooler: `pgbouncer` mode (transaction pooling)
- Max connections: 1000 (auto-scaled)
- Idle timeout: 10 minutes

**Worker Pattern:** Single transaction per float (reuses connection).

---

### 3. **Partial Indexes** (Future)

For quality-filtered queries, create partial indexes:

```sql
-- Only index DELAYED_MODE profiles (smaller index)
CREATE INDEX profiles_delayed_mode_idx ON argo_profiles (profile_time)
WHERE quality_flag = 'DELAYED_MODE';
```

---

### 4. **Partitioning** (Future)

For large datasets (>10M rows), partition by time:

```sql
CREATE TABLE argo_profiles_2025_q1 PARTITION OF argo_profiles
FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE argo_profiles_2025_q2 PARTITION OF argo_profiles
FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
```

**Benefits:**

- Faster queries (query planner skips irrelevant partitions)
- Easier archival (drop old partitions)
- Parallel vacuum/analyze

---

## Future Enhancements

### 1. **TimescaleDB Extension**

**Purpose:** Convert `argo_profiles` to hypertable for time-series optimization.

```sql
CREATE EXTENSION timescaledb;

SELECT create_hypertable('argo_profiles', 'profile_time');
```

**Benefits:**

- Automatic time-based partitioning
- Continuous aggregates (faster than materialized views)
- Compression (80% storage reduction)
- Time-bucket queries (`time_bucket('1 day', profile_time)`)

**Trade-off:** Neon doesn't support TimescaleDB yet (requires self-hosted PostgreSQL).

---

### 2. **Full-Text Search**

**Purpose:** Search float metadata by country, type, or notes.

```sql
-- Add tsvector column
ALTER TABLE argo_float_metadata
ADD COLUMN search_vector tsvector;

-- Populate with trigram matching
UPDATE argo_float_metadata
SET search_vector = to_tsvector('english',
  coalesce(deployment_country, '') || ' ' ||
  coalesce(float_type, '')
);

-- Create GIN index
CREATE INDEX metadata_search_idx ON argo_float_metadata USING GIN (search_vector);

-- Search query
SELECT * FROM argo_float_metadata
WHERE search_vector @@ to_tsquery('english', 'India & APEX');
```

---

### 3. **Incremental Materialized View Refresh**

**Problem:** Full refresh blocks queries for minutes.

**Solution:** Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`:

```sql
-- Requires unique index on view
CREATE UNIQUE INDEX ON argo_measurements_summary (profile_id);

-- Refresh without blocking reads
REFRESH MATERIALIZED VIEW CONCURRENTLY argo_measurements_summary;
```

**Future:** Trigger-based incremental updates (only refresh new profiles).

---

### 4. **Read Replicas**

**Purpose:** Offload analytics queries to read-only replicas.

**Neon Feature:** Branch-based development = instant read replicas.

```sql
-- Create analytics branch
neon branches create --name analytics --parent production

-- Connect analytics queries to replica
DATABASE_URL_ANALYTICS="postgres://...@analytics.neon.tech/neondb"
```

---

### 5. **Change Data Capture (CDC)**

**Purpose:** Stream profile inserts to event bus (Kafka, RabbitMQ).

**Implementation:**

1. Enable logical replication: `wal_level = logical`
2. Create publication: `CREATE PUBLICATION argo_updates FOR TABLE argo_profiles;`
3. Subscribe with Debezium or Neon CDC

**Use Cases:**

- Real-time dashboards (WebSocket updates)
- Event-driven workflows (alert on anomalies)
- Data lake synchronization (S3, BigQuery)

---

## Appendix:

### Extension Versions

| Extension          | Version | Purpose                          |
| ------------------ | ------- | -------------------------------- |
| PostGIS            | 3.5+    | Spatial data types and functions |
| pg_stat_statements | 1.10+   | Query performance monitoring     |
| uuid-ossp          | 1.1+    | UUID generation                  |
