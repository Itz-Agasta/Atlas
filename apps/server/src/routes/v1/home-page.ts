import { db } from "@atlas/db";
import { argo_float_metadata, argo_float_status } from "@atlas/db/schema";
import type {
  FloatDetailResponse,
  FloatLocationsResponse,
} from "@atlas/schema/api/home-page";

import { eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import logger from "../../config/logger";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const RADIX_DECIMAL = 10;

export const homeRouter = new Hono();

/**
 * GET /api/v1/home/locations
 *
 * Returns float location data for map display & hover display
 */
homeRouter.get("/locations", async (c) => {
  try {
    const results = await db
      .select({
        floatId: argo_float_metadata.float_id,
        // Extract coordinates from PostGIS geometry
        latitude: sql`ST_Y(${argo_float_status.location})`.mapWith(
          (val: number) => val
        ),
        longitude: sql`ST_X(${argo_float_status.location})`.mapWith(
          (val: number) => val
        ),
        lastUpdate: argo_float_status.last_update,
        cycleNumber: argo_float_status.cycle_number,
      })
      .from(argo_float_metadata)
      .innerJoin(
        argo_float_status,
        eq(argo_float_metadata.float_id, argo_float_status.float_id)
      )
      .where(isNotNull(argo_float_status.location));

    // Transform to match schema
    const responseData = results.map((row) => ({
      floatId: row.floatId,
      latitude: row.latitude,
      longitude: row.longitude,
      lastUpdate: row.lastUpdate?.toISOString(),
      cycleNumber: row.cycleNumber || undefined,
    }));

    const response: FloatLocationsResponse = {
      success: true,
      data: responseData,
      count: responseData.length,
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error("Error fetching float locations:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch float locations",
      },
      HTTP_STATUS_INTERNAL_ERROR
    );
  }
});

/**
 * GET /api/v1/home/:floatId
 *
 * Get detailed information for a specific float
 */
homeRouter.get("/float/:floatId", async (c) => {
  try {
    const floatId = Number.parseInt(c.req.param("floatId"), RADIX_DECIMAL);

    if (Number.isNaN(floatId)) {
      return c.json(
        { success: false, error: "Invalid float ID" },
        HTTP_STATUS_BAD_REQUEST
      );
    }

    const result = await fetchFloatData(floatId);

    if (!result) {
      return c.json(
        { success: false, error: "Float not found" },
        HTTP_STATUS_NOT_FOUND
      );
    }

    const response: FloatDetailResponse = {
      success: true,
      data: {
        floatId: result.floatId,
        wmoNumber: result.wmoNumber,
        status: result.status || "UNKNOWN",
        floatType: result.floatType ?? undefined,
        platform_type: result.platform_type ?? undefined,
        operatingInstitution: result.operatingInstitution ?? undefined,
        piName: result.piName ?? undefined,
        latitude: result.latitude,
        longitude: result.longitude,
        cycleNumber: result.cycleNumber ?? undefined,
        batteryPercent: result.batteryPercent ?? undefined,
        lastUpdate: result.lastUpdate?.toISOString(),
        last_depth: result.last_depth ?? undefined,
        last_temp: result.last_temp ?? undefined,
        last_salinity: result.last_salinity ?? undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error("Error fetching float details:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch float details",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      HTTP_STATUS_INTERNAL_ERROR
    );
  }
});

async function fetchFloatData(floatId: number) {
  const result = await db
    .select({
      // Metadata
      floatId: argo_float_metadata.float_id,
      wmoNumber: argo_float_metadata.wmo_number,
      status: argo_float_metadata.status,
      floatType: argo_float_metadata.float_type,
      platform_type: argo_float_metadata.platform_type,
      operatingInstitution: argo_float_metadata.operating_institution,
      piName: argo_float_metadata.pi_name,
      // Current status
      latitude: sql`ST_Y(${argo_float_status.location})`.mapWith(
        (val: number) => val
      ),
      longitude: sql`ST_X(${argo_float_status.location})`.mapWith(
        (val: number) => val
      ),
      cycleNumber: argo_float_status.cycle_number,
      batteryPercent: argo_float_status.battery_percent,
      lastUpdate: argo_float_status.last_update,
      last_depth: argo_float_status.last_depth,
      last_temp: argo_float_status.last_temp,
      last_salinity: argo_float_status.last_salinity,
    })
    .from(argo_float_metadata)
    .innerJoin(
      argo_float_status,
      eq(argo_float_metadata.float_id, argo_float_status.float_id)
    )
    .where(eq(argo_float_metadata.float_id, floatId))
    .limit(1);

  return result[0];
}
