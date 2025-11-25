CREATE MATERIALIZED VIEW "public"."argo_measurements_summary" AS (select "id", "float_id", "cycle", "profile_time", "surface_lat", "surface_lon", "max_depth", (
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 0 AND 10 
        ORDER BY (elem->>'depth')::REAL ASC 
        LIMIT 1
      ) as "surface_temp", (
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 0 AND 10 
        ORDER BY (elem->>'depth')::REAL ASC 
        LIMIT 1
      ) as "surface_salinity", (
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 90 AND 110 
        ORDER BY ABS((elem->>'depth')::REAL - 100) ASC 
        LIMIT 1
      ) as "temp_100m", (
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 90 AND 110 
        ORDER BY ABS((elem->>'depth')::REAL - 100) ASC 
        LIMIT 1
      ) as "salinity_100m", (
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 450 AND 550 
        ORDER BY ABS((elem->>'depth')::REAL - 500) ASC 
        LIMIT 1
      ) as "temp_500m", (
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 450 AND 550 
        ORDER BY ABS((elem->>'depth')::REAL - 500) ASC 
        LIMIT 1
      ) as "salinity_500m", (
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 950 AND 1050 
        ORDER BY ABS((elem->>'depth')::REAL - 1000) ASC 
        LIMIT 1
      ) as "temp_1000m", (
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements("measurements") elem 
        WHERE (elem->>'depth')::REAL BETWEEN 950 AND 1050 
        ORDER BY ABS((elem->>'depth')::REAL - 1000) ASC 
        LIMIT 1
      ) as "salinity_1000m", jsonb_array_length("measurements") as "measurement_count", "quality_flag" from "argo_profiles");