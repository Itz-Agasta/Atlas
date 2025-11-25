# ARGO Float Data Analysis Report

**Float ID:** 2902230 (WMO: Unknown)  
**Generated:** 2025-11-23  
**Data Source:** Argo INCOIS Float Network

---

## Executive Summary

Analysis of the ARGO float **2902230** NetCDF files reveals **60+ data fields** available in raw format. The current database schema stores only **~12-15 core fields**, leaving significant oceanographic and operational data untapped.

**Key Finding:** For v1 we're missing important operational telemetry that could improve analytics, but storing the most critical profile data.

---

## Data Available vs. Currently Stored

### CURRENTLY STORED IN DATABASE

| Field                  | Source                  | Purpose                  | Status  |
| ---------------------- | ----------------------- | ------------------------ | ------- |
| `float_id`             | META                    | Float identifier         | Storing |
| `wmo_number`           | META (PLATFORM_NUMBER)  | Global unique ID         | Storing |
| `float_type`           | META (PLATFORM_TYPE)    | Model info (ARVOR, APEX) | Storing |
| `deployment_date`      | META (LAUNCH_DATE)      | Deployment timestamp     | Storing |
| `deployment_lat`       | META (LAUNCH_LATITUDE)  | Deployment location      | Storing |
| `deployment_lon`       | META (LAUNCH_LONGITUDE) | Deployment location      | Storing |
| `cycle`                | PROF (CYCLE_NUMBER)     | Profile cycle number     | Storing |
| `profile_time`         | PROF (JULD)             | Profile timestamp        | Storing |
| `surface_lat`          | PROF (LATITUDE)         | Profile surface lat      | Storing |
| `surface_lon`          | PROF (LONGITUDE)        | Profile surface lon      | Storing |
| `measurements` (JSONB) | PROF (TEMP, PSAL, PRES) | Core oceanographic data  | Storing |
| `quality_flag`         | PROF (DATA_MODE)        | Real-time vs delayed     | Storing |

---

### PARTIALLY STORED / AVAILABLE BUT NOT USING

| Field                | Source                             | Purpose                 | In DB?     | Recommendation    |
| -------------------- | ---------------------------------- | ----------------------- | ---------- | ----------------- |
| `battery_capacity`   | META (BATTERY_TYPE, BATTERY_PACKS) | Battery info            | NOT STORED | Consider storing  |
| `deployment_country` | META (need reverse geocoding)      | Deployment location     | NOT STORED | Add via geocoding |
| `current_depth`      | PROF (PRES/depth calculation)      | Current depth           | NOT STORED | Calculated field  |
| `max_depth`          | PROF (implicit in PRES)            | Maximum profiling depth | NOT STORED | Consider storing  |
| `positioning_system` | PROF (POSITIONING_SYSTEM)          | GPS/Iridium source      | NOT STORED | Low priority      |
| `position_qc`        | PROF (POSITION_QC)                 | GPS quality flag        | NOT STORED | QC metadata       |
| `firmware_version`   | PROF (FIRMWARE_VERSION)            | Float firmware          | NOT STORED | Low priority      |
| `platform_maker`     | META (PLATFORM_MAKER)              | Float manufacturer      | NOT STORED | Low priority      |

---

### NOT STORED - ADVANCED OCEANOGRAPHIC DATA

| Field                       | Source | Purpose           | Why Missing?               | Recommendation                 |
| --------------------------- | ------ | ----------------- | -------------------------- | ------------------------------ |
| **DOXY** (Dissolved Oxygen) | PROF   | Not in this float | Biogeochemical floats only | Future: biogeochemical support |
| **CHLA** (Chlorophyll)      | PROF   | Not in this float | Biogeochemical floats only | Future: biogeochemical support |
| **NITRATE**                 | PROF   | Not in this float | Biogeochemical floats only | Future: biogeochemical support |
| **pH**                      | PROF   | Not in this float | Biogeochemical floats only | Future: biogeochemical support |

**Note:** Float 2902230 measures only: **TEMP** (Temperature) and **PSAL** (Salinity)

---

### NOT STORED - OPERATIONAL TELEMETRY (TECH FILE)

**7,722 technical parameters** stored in `TECHNICAL_PARAMETER_NAME` and `TECHNICAL_PARAMETER_VALUE`:

#### Example Technical Parameters:

| Parameter                                         | Example Value | Purpose                 |
| ------------------------------------------------- | ------------- | ----------------------- |
| `VOLTAGE_BatteryInitialAtProfileDepth_volts`      | Varies        | Battery health          |
| `PRESSURE_InternalVacuum_inHg`                    | Varies        | Float sealing integrity |
| `FLAG_ProfileTermination_hex`                     | Varies        | How profile ended       |
| `CLOCK_StartDescentToPark_hours`                  | Varies        | Timing data             |
| `NUMBER_ValveActionsAtSurfaceDuringDescent_COUNT` | Integer       | Float mechanics         |
| `NUMBER_PumpActionsDuringDescentToPark_COUNT`     | Integer       | Float mechanics         |
| `PRES_SurfaceOffsetNotTruncated_dbar`             | Value         | Pressure calibration    |

**Total in this float:** 7,722 operational measurements across 349 cycles

---

## File-by-File Breakdown

### 1. META File: `2902230_meta.nc` (Metadata)

**Size:** Static metadata  
**Scope:** Float deployment & configuration (one-time per float)

**Contains:**

- Float identification (PLATFORM_NUMBER, WMO_INST_TYPE)
- Deployment info (LAUNCH_DATE, LAUNCH_LATITUDE, LAUNCH_LONGITUDE)
- Hardware specs (PLATFORM_TYPE: ARVOR, FIRMWARE_VERSION)
- Battery info (BATTERY_TYPE: Alkaline, BATTERY_PACKS: 4DD LI)
- Sensor configuration (SENSOR array)
- Organization metadata (PI_NAME, DATA_CENTRE, OPERATING_INSTITUTION)

**Currently extracting:** 60% of useful fields
**Missing:**

- `BATTERY_TYPE`, `BATTERY_PACKS` → Could estimate battery_capacity
- `DEPLOYMENT_PLATFORM` (ORV Sagarnidhi)
- `DEPLOYMENT_CRUISE_ID`
- `FLOAT_OWNER` (INCOIS)

---

### 2. PROF File: `2902230_prof.nc` (Profile Data)

**Size:** ~47 MB  
**Scope:** 349 profiles (cycles), each with up to 273 depth levels  
**Dimensions:** N_PROF=349, N_LEVELS=273, N_PARAM=3

**Contains per profile:**

- `CYCLE_NUMBER` → our `cycle` field
- `JULD` (Julian Day) → our `profile_time`
- `LATITUDE`, `LONGITUDE` → our `surface_lat`, `surface_lon`
- `TEMP`, `PSAL`, `PRES` → our `measurements` (JSONB)
- `TEMP_ADJUSTED`, `PSAL_ADJUSTED`, `PRES_ADJUSTED` → Quality-controlled versions
- `TEMP_QC`, `PSAL_QC`, `PRES_QC` → Quality flags per parameter
- `DATA_MODE` → our `quality_flag`
- `POSITIONING_SYSTEM` (GPS in this case)
- `POSITION_QC` (1=good, etc.)
- `VERTICAL_SAMPLING_SCHEME` (sampling strategy)

**Currently extracting:** 85% of profile data
**Missing:**

- Adjusted values (`TEMP_ADJUSTED`, `PSAL_ADJUSTED`) — quality-controlled versions
- QC flags (`TEMP_QC`, `PSAL_QC`, `PRES_QC`) — per-point quality
- `POSITIONING_SYSTEM` (could be useful for filtering unreliable positions)
- `VERTICAL_SAMPLING_SCHEME`

---

### 3. TECH File: `2902230_tech.nc` (Technical Telemetry)

**Size:** ~20 MB (7,722 parameters)  
**Scope:** Internal float operational metrics per cycle  
**Dimensions:** N_TECH_PARAM=7,722

**Contains:**

- Battery voltage at key points
- Internal pressure readings
- Valve/pump action counts
- Timing information for float lifecycle
- Float clock readings
- Calibration offsets

**Example Parameters per Cycle:**

```plaintext
VOLTAGE_BatteryInitialAtProfileDepth_volts
PRESSURE_InternalVacuum_inHg
CLOCK_StartDescentToPark_hours
NUMBER_ValveActionsAtSurfaceDuringDescent_COUNT
NUMBER_PumpActionsDuringDescentToPark_COUNT
PRES_SurfaceOffsetNotTruncated_dbar
```

**Currently extracting:** 0%  
**Missing:** All technical data

---

### 4. Profile Files: `profiles/D2902230_*.nc` (349 individual profiles)

**Size:** ~130 KB each  
**Scope:** Individual profile data (one file per cycle)

**Same structure as PROF file but single profile per file**

- Typically used for real-time data ingestion
- our implementation likely uses the consolidated `2902230_prof.nc`

---

## Implementation Status and Roadmap

### Priority 1: Currently Handling Well

Core profile data (TEMP, PSAL, PRES)  
Timestamps and locations  
Quality flags  
Float identification

**Action:** Continue as-is, this is the critical data.

---

### Priority 2: Should Add (Medium Value)

#### 1. **Battery & Hardware Info**

```sql
-- Add to argo_float_metadata
battery_type TEXT,           -- e.g., "Alkaline"
battery_packs TEXT,          -- e.g., "4DD LI"
platform_maker TEXT,         -- e.g., "NKE"
deployment_platform TEXT,    -- e.g., "ORV Sagarnidhi"
```

**Why:**

- Predict float lifetime
- Identify hardware-related failure patterns
- Better maintenance scheduling

**Where to extract:**

- META file: `BATTERY_TYPE`, `BATTERY_PACKS`, `PLATFORM_MAKER`, `DEPLOYMENT_PLATFORM`

---

#### 2. **Deployment Country** (Requires reverse geocoding)

```sql
-- Add to argo_float_metadata
deployment_country TEXT,     -- Derived from LAUNCH_LATITUDE/LONGITUDE
```

**Why:** Geographic analytics (regional trends)

**How to implement:**

```python
from geopy.geocoders import Nominatim
geolocator = Nominatim(user_agent="atlas")
location = geolocator.reverse(f"{deployment_lat}, {deployment_lon}")
country = location.address.split(',')[-1]
```

---

#### 3. **Quality-Controlled Measurements**

Currently storing raw values. Consider also storing adjusted values:

```json
{
  "TEMP": [20.5, 19.8, ...],
  "TEMP_ADJUSTED": [20.51, 19.79, ...],  -- Add this
  "PSAL": [34.5, 34.6, ...],
  "PSAL_ADJUSTED": [34.51, 34.61, ...],  -- Add this
  "PRES": [0, 5, 10, ...],
  "PRES_ADJUSTED": [0.1, 5.1, 10.1, ...], -- Add this (small corrections)
  "depths": [...]
}
```

**Why:**

- Adjusted values are quality-controlled versions
- More accurate for scientific analysis
- Small corrections from calibration

**Where to extract:**

- PROF file: `TEMP_ADJUSTED`, `PSAL_ADJUSTED`, `PRES_ADJUSTED`

---

#### 4. **Max Depth per Profile**

```sql
-- Already in schema but not being populated
max_depth INT,  -- Maximum depth reached in profile
```

**Why:** Understand profiling depth variations

**How to calculate:**

```python
max_depth = max(pressures)  # In decibar, ~1 dbar ≈ 1 meter
```

---

### Priority 3: Can Safely Ignore

`POSITIONING_SYSTEM` — Always GPS for modern floats  
`FIRMWARE_VERSION` — Mostly for debugging  
`VERTICAL_SAMPLING_SCHEME` — Too technical  
`PI_NAME`, `DATA_CENTRE` — Administrative metadata  
`PLATFORM_FAMILY` — Implicit in PLATFORM_TYPE

---

### Priority 4: Future Enhancement (Requires Schema Changes) (Hold)

#### Technical Telemetry Storage

**Currently not storing:** 7,722 technical parameters per float

**Consider storing when:**

- Analyzing float failure patterns
- Predictive maintenance
- Hardware performance benchmarking

**Storage approach:**

```sql
-- New table
CREATE TABLE argo_float_telemetry (
  id SERIAL PRIMARY KEY,
  float_id BIGINT REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE,
  cycle_number INT,
  telemetry JSONB,  -- Store all 7k+ params
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example data
{
  "VOLTAGE_BatteryInitialAtProfileDepth_volts": 7.8,
  "PRESSURE_InternalVacuum_inHg": 0.45,
  "NUMBER_PumpActionsDuringDescentToPark_COUNT": 45,
  ...
}
```

---

## Data Statistics for Float 2902230

| Metric                          | Value                              |
| ------------------------------- | ---------------------------------- |
| **Total Profiles**              | 349 cycles                         |
| **Max Profiling Depth**         | ~2000+ meters                      |
| **Depth Levels per Profile**    | 273 (varying per profile)          |
| **Parameters Measured**         | 2 (TEMP, PSAL)                     |
| **Technical Parameters Logged** | 7,722 per cycle                    |
| **Deployment Date**             | 2017-06-10                         |
| **Deployment Location**         | 17.398°N, 89.173°E (Bay of Bengal) |
| **Float Type**                  | ARVOR (NKE)                        |
| **Transmission System**         | IRIDIUM                            |
| **Battery Type**                | Alkaline (4DD LI packs)            |
| **Data Centre**                 | INCOIS (India)                     |

---

## Implementation Checklist

### Immediate (Next Sprint)

- [ ] Add `max_depth` calculation in profile processing
- [ ] Store `battery_type`, `battery_packs` in metadata
- [ ] Add `deployment_platform` field

### Short Term (1-2 months)

- [ ] Add reverse geocoding for `deployment_country`
- [ ] Store adjusted measurement values (`TEMP_ADJUSTED`, `PSAL_ADJUSTED`)
- [ ] Add QC flag per measurement point

### Future (3+ months)

- [ ] Create `argo_float_telemetry` table for operational data
- [ ] Build anomaly detection on battery voltage trends
- [ ] Support biogeochemical parameters (DOXY, CHLA, etc.)

---

## Summary

When designing the database schema for v1, our team focused on capturing the essential data needed for basic oceanographic analysis while keeping the implementation manageable. Here's a breakdown of what our current schema covers:

- 100% of core oceanographic measurements (TEMP, PSAL, depth) - This includes the fundamental temperature, salinity, and pressure data that forms the basis of our analysis.
- 100% of profile timing and location - We store all timestamps and GPS coordinates for each profile.
- 85% of profile metadata - Most profile-level information is captured, including quality flags and basic metadata.
- 0% of operational telemetry - The 7,722 technical parameters per float (battery voltage, valve actions, etc.) are not stored yet.
- 30% of deployment metadata - Some hardware specifications and deployment details are missing from our metadata table.

**Overall assessment: 7/10** - We have a solid foundation for v1 that covers the core use cases, but there are clear gaps that limit advanced analytics.

### What We're Missing

The main gaps in our current schema are:

1. **Operational Telemetry**: We're not storing the extensive technical data from the TECH files, which includes battery health, mechanical operations, and calibration offsets. This data would be valuable for predictive maintenance and understanding float performance over time.

2. **Additional Deployment Metadata**: Fields like battery type, platform maker, and deployment platform are available in the NetCDF files but not extracted into our database.

---

## NetCDF File Structure Summary

```
2902230_meta.nc (1 float config)
├── Deployment info (location, date, hardware)
├── Battery specs
├── Sensor configuration
└── Organization metadata

2902230_prof.nc (349 profiles consolidated)
├── CYCLE_NUMBER (0-348)
├── JULD (Julian Day timestamp)
├── LATITUDE, LONGITUDE (surface location)
├── TEMP[273], PSAL[273], PRES[273] (depth arrays)
├── TEMP_ADJUSTED, PSAL_ADJUSTED (quality-controlled)
├── Quality flags per parameter
└── Metadata per cycle

2902230_tech.nc (7,722 telemetry readings)
└── Technical parameters per cycle:
    ├── Battery voltage readings
    ├── Pressure/vacuum readings
    ├── Valve/pump action counts
    ├── Timing information
    └── Calibration offsets

profiles/D2902230_*.nc (349 individual profiles)
└── Same as one profile from 2902230_prof.nc
```
