import { agentQueryInputSchema, testSQLInputSchema } from "@atlas/schema/agent";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { DuckDBAgent } from "../../agents/duckdb-agent";
import { executeGeneralAgent } from "../../agents/general-agent";
import { RAGAgent } from "../../agents/rag-agent";
import type { RoutingDecision } from "../../agents/router-agent";
import { routeQuery } from "../../agents/router-agent";
import { SQLAgent } from "../../agents/sql-agent";
import { responseOrchestrator } from "../../middleware/orchestrator";
import { buildAgentMetrics } from "../../utils/helper";

const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * Execute agents in parallel based on routing decision
 */
async function executeAgents(params: {
  routing: RoutingDecision;
  includeSql: boolean;
  includeRag: boolean;
  query: string;
  floatId?: number;
  timeRange?: { start?: string; end?: string };
  yearRange?: { start?: number; end?: number };
}) {
  const {
    routing,
    includeSql,
    includeRag,
    query,
    floatId,
    timeRange,
    yearRange,
  } = params;

  const [sqlResults, duckdbResults, ragResults] = await Promise.all([
    routing.sqlAgent && includeSql
      ? SQLAgent({ query, floatId, timeRange })
      : Promise.resolve(undefined),
    routing.duckdbAgent && includeSql
      ? DuckDBAgent({ query, floatId, timeRange })
      : Promise.resolve(undefined),
    routing.ragAgent && includeRag
      ? RAGAgent({ query, yearRange })
      : Promise.resolve(undefined),
  ]);

  return { sqlResults, duckdbResults, ragResults };
}

export const agentRouter = new Hono();

/**
 * Main query endpoint for the multi-agent system that intelligently routes queries
 * through classifier, SQL agent, RAG agent, and response orchestrator.
 *
 * @URL `POST /api/v1/agent/query`
 */
agentRouter.post(
  "/query",
  zValidator("json", agentQueryInputSchema),
  async (c) => {
    const startTime = Date.now();
    const input = c.req.valid("json");
    const { query, floatId, includeRag, includeSql, timeRange, yearRange } =
      input;

    try {
      // Step 1: Route query to appropriate agents
      const routingStart = Date.now();
      const routing = await routeQuery(query);
      const routingTime = Date.now() - routingStart; // router agent doest return any total time..

      // Step 2: Handle general queries (greetings, casual chat)
      if (
        routing.generalAgent &&
        !routing.sqlAgent &&
        !routing.duckdbAgent &&
        !routing.ragAgent
      ) {
        const generalResponse = await executeGeneralAgent(query); // orchestrator agent unused
        const totalTime = Date.now() - startTime;

        return c.json({
          success: true,
          query,
          routing,
          response: generalResponse.response,
          citations: null,
          dataQuality: null,
          timestamp: new Date(),
          processingTimeMs: totalTime,
          agentMetrics: buildAgentMetrics({
            routing: { decision: routing, timeMs: routingTime },
            generalResult: generalResponse,
            totalTime,
          }),
        });
      }

      // Step 3: Execute specialized agents in parallel
      const { sqlResults, duckdbResults, ragResults } = await executeAgents({
        routing,
        includeSql,
        includeRag,
        query,
        floatId,
        timeRange,
        yearRange,
      });

      // Step 4: Orchestrate final response
      const orchestrationStart = Date.now();
      const finalResponse = await responseOrchestrator({
        originalQuery: query,
        sqlResults,
        duckdbResults,
        ragResults,
      });
      const orchestrationTime = Date.now() - orchestrationStart;
      const totalTime = Date.now() - startTime;

      // Step 5: Collect metrics from all agents (they already tracked their own time/tokens)
      const agentMetrics = buildAgentMetrics({
        routing: { decision: routing, timeMs: routingTime },
        sqlResults,
        duckdbResults,
        ragResults,
        orchestration: { result: finalResponse, timeMs: orchestrationTime },
        totalTime,
      });

      return c.json({
        success: true,
        query,
        routing,
        sqlResults: sqlResults || null,
        duckdbResults: duckdbResults || null,
        ragResults: ragResults || null,
        response: finalResponse.response,
        citations: finalResponse.citations,
        dataQuality: finalResponse.dataQuality,
        timestamp: finalResponse.timestamp,
        processingTimeMs: totalTime,
        agentMetrics,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          query,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          timestamp: new Date(),
        },
        HTTP_STATUS_INTERNAL_ERROR
      );
    }
  }
);

/**
 * Test SQL agent with dry run (generates SQL without executing)
 * NOTE: This endpoint always uses dryRun: true, so no database queries are executed
 *
 * @URL `GET /api/v1/agent/test-sql`
 */
agentRouter.get(
  "/test-sql",
  zValidator("query", testSQLInputSchema),
  async (c) => {
    const input = c.req.valid("query");
    const result =
      input.agent === "pg"
        ? await SQLAgent({ query: input.query, dryRun: true })
        : await DuckDBAgent({ query: input.query, dryRun: true });

    return c.json({
      success: result.success,
      sql: result.sql,
      error: result.error,
    });
  }
);
