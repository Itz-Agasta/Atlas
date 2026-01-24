import { z } from "zod";

/**
 * Response schema for float locations endpoint
 * Used for map display & hover display
 */
export const floatLocationSchema = z.object({
  floatId: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.enum(["ACTIVE", "INACTIVE", "UNKNOWN", "DEAD"]), // No unknown in our db
  floatType: z.enum(["core", "oxygen", "biogeochemical", "deep", "unknown"]), // currently db has no deep & unknown floats
  lastUpdate: z.string().optional(), // ISO string
  cycleNumber: z.number().optional(),
});

/**
 * Response for the /home/locations endpoint
 */
export const floatLocationsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(floatLocationSchema),
  count: z.number(),
  timestamp: z.string(),
});

export type FloatLocationsResponse = z.infer<
  typeof floatLocationsResponseSchema
>;

/**
 * Schema for detailed float information
 * Used for individual float details popup display
 */
export const floatDetailSchema = z.object({
  floatId: z.number(),
  wmoNumber: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "UNKNOWN", "DEAD"]),

  floatType: z.enum(["core", "oxygen", "biogeochemical", "deep", "unknown"]),
  platform_type: z.string().optional(),

  operatingInstitution: z.string().optional(),
  piName: z.string().optional(),

  latitude: z.number(),
  longitude: z.number(),
  cycleNumber: z.number().optional(),
  batteryPercent: z.number().optional(),

  lastUpdate: z.string().optional(), // ISO string
  last_depth: z.number().optional(),
  last_temp: z.number().optional(),
  last_salinity: z.number().optional(),
});

/**
 * Response for the /home/float/:floatId endpoint
 */
export const floatDetailResponseSchema = z.object({
  success: z.boolean(),
  data: floatDetailSchema,
  timestamp: z.string(),
});

export type FloatDetailResponse = z.infer<typeof floatDetailResponseSchema>;
