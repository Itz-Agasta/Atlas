import type { AgentQueryInput } from "@atlas/schema/api/agent";
import type {
  FloatDetailResponse,
  FloatLocationsResponse,
} from "@atlas/schema/api/home-page";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const getApiBaseUrl = (): string => {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return `${process.env.NEXT_PUBLIC_SERVER_URL}/api/v1`;
  }
  // Fallback to window.location.origin in browser, or localhost for SSR
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }
  return "http://localhost:3000/api/v1";
};

const API_BASE_URL = getApiBaseUrl();

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
export async function fetchFloatDetail(
  floatId: number
): Promise<FloatDetailResponse> {
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
