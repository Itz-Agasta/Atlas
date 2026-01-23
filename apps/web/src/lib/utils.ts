import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AgentQueryInput } from "@atlas/schema/agent";
import type {
  FloatLocationsResponse,
  FloatDetailResponse,
} from "@atlas/schema/api/home-page";

const API_BASE_URL = "http://localhost:3000/api/v1";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function queryAgent(input: AgentQueryInput) {
  const response = await fetch(`${API_BASE_URL}/agent/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to query agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all float locations for map display
 * GET /api/v1/home/locations
 */
export async function fetchFloatLocations(): Promise<FloatLocationsResponse> {
  const response = await fetch(`${API_BASE_URL}/home/locations`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch float locations: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch detailed information for a specific float
 * GET /api/v1/home/float/:floatId
 */
export async function fetchFloatDetail(floatId: number): Promise<FloatDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/home/float/${floatId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch float details: ${response.statusText}`);
  }

  return response.json();
}
