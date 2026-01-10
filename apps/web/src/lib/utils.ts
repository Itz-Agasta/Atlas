import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AgentQueryInput } from "@atlas/schema/agent";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function queryAgent(input: AgentQueryInput) {
  const response = await fetch("http://localhost:3000/api/v1/agent/query", {
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
