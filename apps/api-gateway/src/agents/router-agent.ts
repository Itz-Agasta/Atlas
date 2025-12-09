import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { config } from "../config/config";
import logger from "../config/logger";

const openrouter = createOpenAI({
  apiKey: config.openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// Regex for parsing JSON from text responses
const JSON_REGEX = /\{[\s\S]*\}/;

export type RoutingDecision = {
  sqlAgent: boolean;
  duckdbAgent: boolean;
  ragAgent: boolean;
  generalAgent: boolean;
  reasoning: string;
  confidence: number;
};

const ROUTER_SYSTEM_PROMPT = `You are a strict routing agent that decides which specialized agents should handle a user's query.

AVAILABLE AGENTS:

1. **SQL Agent** (PostgreSQL) - Float metadata & current status:
   - Float identity, location, deployment info
   - Current status: "ACTIVE" | "INACTIVE" | "DEAD" | "UNKNOWN"
   - Latest readings: last_temp, last_salinity, last_depth, battery_percent
   - Spatial queries (near X location, in region Y)
   
2. **DuckDB Agent** - Historical oceanographic data:
   - All temperature/salinity/pressure profiles across cycles
   - Time-series analysis, depth profiles, trends
   - Multi-cycle comparisons, quality-filtered data
   
3. **RAG Agent** - Research literature & methodology:
   - Scientific papers about Argo floats, oceanography
   - Methodology, calibration procedures, QC standards
   
4. **General Agent** - Casual conversation:
   - Greetings, introductions, capability questions
   - Off-topic or chitchat

STRICT ROUTING RULES (Follow exactly):

IF query is ONLY a SIMPLE GREETING or INTRODUCTION (no substantive question) → General Agent ONLY
  Examples: "hi", "hello", "hey", "what can you do?", "who are you?", "I'm agasta" , "what you can do"
  Action: generalAgent=true, ALL others=false
  NOTE: If greeting is followed by a data question, ignore the greeting and route based on the data question.

IF query asks about FLOAT LOCATION or CURRENT STATUS → SQL Agent (+ DuckDB if asking for trends)
  Examples: "Where is float 2902226?", "Is float X dead?", "Show active floats", "Float status"
  Examples with greetings: "hey, tell me about float 2902226" → sqlAgent=true, generalAgent=false
  Action: sqlAgent=true, duckdbAgent=false unless also asking for historical data

IF query asks for HISTORICAL DATA, PROFILES, or TRENDS → DuckDB Agent (+ SQL if asking for metadata)
  Examples: "Show temp profiles", "Last 5 cycles", "Temperature trends over time"
  Action: duckdbAgent=true, sqlAgent=false unless also asking for float metadata

IF query mentions RESEARCH PAPERS or LITERATURE → RAG Agent (+ data agents if asking for data comparison)
  Examples: "Find papers about...", "How is salinity calibrated?", "Reference studies"
  Action: ragAgent=true

IF query combines multiple types → Activate all relevant agents
  Examples: "Where is float X and show its trends?" → sqlAgent=true, duckdbAgent=true
            "Compare float data with papers" → sqlAgent=true, duckdbAgent=true, ragAgent=true

IMPORTANT: Greetings are MODIFIERS, not primary routing criteria. Focus on the substantive question in the query.

CONFIDENCE SCORING:
- High (0.9+): Clear match with routing rules
- Medium (0.6-0.8): Somewhat ambiguous, multiple agents might help
- Low (0.3-0.5): Very unclear, may need fallback

CRITICAL: At least ONE agent must be true. Never return all false.`;

/**
 * Router Agent - Decides which specialized agents should handle the query
 */
export async function routeQuery(query: string): Promise<RoutingDecision> {
  try {
    const { text } = await generateText({
      model: openrouter(config.models.router),
      system: ROUTER_SYSTEM_PROMPT,
      prompt: `Route this query to appropriate agents: "${query}"

Respond in this exact JSON format:
{
  "sqlAgent": boolean,
  "duckdbAgent": boolean,
  "ragAgent": boolean,
  "generalAgent": boolean,
  "reasoning": "brief explanation",
  "confidence": 0.0 to 1.0
}`,
      maxTokens: 200,
    });

    // Parse the JSON response. models aren't guaranteed to output pure JSON
    const jsonMatch = text.match(JSON_REGEX);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate that at least one agent is selected
    const anyAgentSelected =
      parsed.sqlAgent ||
      parsed.duckdbAgent ||
      parsed.ragAgent ||
      parsed.generalAgent;

    if (!anyAgentSelected) {
      logger.warn("Router selected no agents, defaulting to general agent", {
        query,
        routing: parsed,
      });
      return {
        ...parsed,
        generalAgent: true,
        reasoning: "No agents selected by router, defaulting to general agent",
        confidence: 0.3,
      };
    }

    return parsed;
  } catch (error) {
    logger.error("Router agent failed", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback: activate general agent for unknown queries
    return {
      sqlAgent: false,
      duckdbAgent: false,
      ragAgent: false,
      generalAgent: true,
      reasoning: `Routing failed due to: ${error instanceof Error ? error.message : "Unknown error"}. Defaulting to general agent.`,
      confidence: 0.1,
    };
  }
}
