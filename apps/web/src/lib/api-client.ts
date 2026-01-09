import type {
  AgentQueryInput,
  ClassifyInput,
  TestSQLInput,
} from "@atlas/schema/agent";

class APIClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    version: string;
  }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Main agent query endpoint
   */
  async query(input: AgentQueryInput) {
    const response = await fetch(`${this.baseUrl}/api/v1/agent/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test SQL generation (dry run)
   */
  async testSQL(input: TestSQLInput) {
    const queryParams = new URLSearchParams({
      query: input.query,
      ...(input.floatId && { floatId: input.floatId.toString() }),
      ...(input.timeRange?.start && {
        "timeRange.start": input.timeRange.start,
      }),
      ...(input.timeRange?.end && { "timeRange.end": input.timeRange.end }),
    });

    const response = await fetch(
      `${this.baseUrl}/api/v1/agent/test-sql?${queryParams.toString()}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`Test SQL failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Classify query to determine which agents to use
   */
  classify(input: ClassifyInput) {
    const queryParams = new URLSearchParams({
      query: input.query,
    });

    return fetch(
      `${this.baseUrl}/api/v1/agent/classify?${queryParams.toString()}`,
      {
        method: "GET",
      }
    ).then((response) => {
      if (!response.ok) {
        throw new Error(`Classify failed: ${response.statusText}`);
      }
      return response.json();
    });
  }
}

const API_BASE_URL_DEFAULT = "http://localhost:3000";
const apiBaseUrl = process.env.NEXT_PUBLIC_SERVER_URL || API_BASE_URL_DEFAULT;

export const apiClient = new APIClient(apiBaseUrl);
