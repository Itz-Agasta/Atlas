# Atlas SQL Database Architecture (v2.0)

## Overview

Atlas stores ARGO float data with **static metadata**, **hot status updates**. Uses PostgreSQL + PostGIS for spatial queries.

**Current Tables:** `argo_float_metadata`, `argo_float_status`, `processing_log`.

**Key Goals:**

- Filterable metadata (status, project, type)
- Real-time spatial positions (GIST-indexed)
- Observability logs

## Current Schema

### 1. `argo_float_metadata` (Static)

**Fields:**

- `float_id` bigint PK
- `wmo_number` text unique not null (e.g., "2902235")
- `status` text: "ACTIVE"|"INACTIVE"|"UNKNOWN"|"DEAD" (default "UNKNOWN")
- `float_type` text: "core"|"oxygen"|"biogeochemical"|"deep"|"unknown"
- `data_centre` text not null (e.g., "IN")
- `project_name` text (e.g., "Argo India")
- `operating_institution` text (e.g., "INCOIS")
- `pi_name`, `platform_type` (e.g., "ARVOR"),
- `platform_maker` (e.g., "NKE"),
- `float_serial_no`,
- `launch_date` timestamp,
- `launch_lat/lon` real
- `start_mission_date`,
- `end_mission_date` timestamp (end nullable)
- `created_at/updated_at` timestamp default NOW()

**Indexes:** PK `float_id`, unique `wmo_number`.

**Filters:** status, project_name, float_type, platform_type, operating_institution.

![ERD](../imgs/sql_db_v2.png)

### 2. `argo_float_status` (Hot Layer)

**Fields:**

- `float_id` bigint PK references metadata (cascade delete)
- `location` geometry(POINT, xy, srid=4326)
- `cycle_number` int,
- `battery_percent` int (0-100)
- `last_update` timestamp,
- `last_depth/temp/salinity` real
- `updated_at` timestamp default NOW()

**Indexes:** PK `float_id`, GIST on `location`.

**Queries:**

```sql
-- Within 500km Sri Lanka
SELECT * FROM argo_float_status
WHERE ST_DWithin(location::geography, ST_GeogFromText('POINT(80.77 7.87)'), 500000);

-- Bounding box (Indian Ocean)
SELECT * WHERE ST_Intersects(location, ST_MakeEnvelope(60,-10,100,20,4326));
```

### 3. `processing_log`

**Fields:**

- `id` serial PK
- `float_id` bigint
- `operation` text (e.g., "FULL SYNC")
- `status` text ("SUCCESS"|"ERROR")
- `error_details` jsonb
- `processing_time_ms` int
- `created_at` timestamp default NOW()

**Indexes:** `(float_id, operation)`, `created_at`.

> NOTE: Floats profiles are stored in duckdb.

## Extensions

- **PostGIS** (3.5+): geometry POINT(4326), GIST spatial.
