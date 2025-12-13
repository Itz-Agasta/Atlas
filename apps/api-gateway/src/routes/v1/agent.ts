import { publicProcedure, router } from "@atlas/api";
import {
  agentQueryInputSchema,
  classifyInputSchema,
  testSQLInputSchema,
} from "@atlas/api/schemas/agent";
import { DuckDBAgent } from "../../agents/duckdb-agent";
import { executeGeneralAgent } from "../../agents/general-agent";
import { RAGAgent } from "../../agents/rag-agent";
import type { RoutingDecision } from "../../agents/router-agent";
import { routeQuery } from "../../agents/router-agent";
import { SQLAgent } from "../../agents/sql-agent";
import { responseOrchestrator } from "../../middleware/orchestrator";
import { buildAgentMetrics } from "../../utils/helper";

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

/**
 * Agent Router for RAG + Text-to-SQL Multi-Agent System
 *
 * @Base_URL `http://localhost:{port}/trpc/agent.*`
 * @Content_Type `application/json` for all requests
 *
 * All endpoints use tRPC protocol over HTTP POST requests.
 */
export const agentRouter = router({
  /**
   * Main query endpoint for the multi-agent system that intelligently routes queries
   * through classifier, SQL agent, RAG agent, and response orchestrator.
   *
   * @URL `POST /trpc/agent.query`
   */
  query: publicProcedure
    .input(agentQueryInputSchema)
    .mutation(async ({ input }) => {
      const startTime = Date.now();
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

          return {
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
          };
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

        return {
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
        };
      } catch (error) {
        return {
          success: false,
          query,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          timestamp: new Date(),
        };
      }
    }),

  /**
   * Test SQL agent with dry run (generates SQL without executing)
   * NOTE: This endpoint always uses dryRun: true, so no database queries are executed
   *
   * @URL `POST /trpc/agent.testSQL`
   */
  testSQL: publicProcedure
    .input(testSQLInputSchema)
    .query(async ({ input }) => {
      const result = await SQLAgent({
        ...input,
        dryRun: true,
      });

      return {
        success: result.success,
        sql: result.sql,
        error: result.error,
      };
    }),

  /**
   * Route query to appropriate agents without execution
   *
   * @URL `POST /trpc/agent.classify`
   */
  classify: publicProcedure
    .input(classifyInputSchema)
    .query(async ({ input }) => {
      const routing = await routeQuery(input.query);
      return routing;
    }),
});

export type AgentRouter = typeof agentRouter;
