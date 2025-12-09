import { publicProcedure, router } from "@atlas/api";
import {
  agentQueryInputSchema,
  classifyInputSchema,
  testSQLInputSchema,
} from "@atlas/api/schemas/agent";
import { DuckDBAgent, type DuckDBAgentResult } from "../../agents/duckdb-agent";
import { executeGeneralAgent } from "../../agents/general-agent";
import { RAGAgent, type RAGAgentResult } from "../../agents/rag-agent";
import { routeQuery } from "../../agents/router-agent";
import { SQLAgent, type SQLAgentResult } from "../../agents/sql-agent";
import { responseOrchestrator } from "../../middleware/orchestrator";

/**
 * Execute SQL agent with error handling (metadata queries only)
 */
async function executeSQLAgent(params: {
  query: string;
  floatId?: number;
  timeRange?: { start?: string; end?: string };
  dryRun?: boolean;
}): Promise<SQLAgentResult> {
  try {
    return await SQLAgent(params);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "SQL agent execution failed",
    };
  }
}

/**
 * Execute DuckDB agent with error handling (profile data queries)
 */
async function executeDuckDBAgent(params: {
  query: string;
  floatId?: number;
  timeRange?: { start?: string; end?: string };
  dryRun?: boolean;
}): Promise<DuckDBAgentResult> {
  try {
    return await DuckDBAgent(params);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "DuckDB agent execution failed",
    };
  }
}

/**
 * Execute RAG agent with error handling
 */
async function executeRAGAgent(
  query: string,
  yearRange?: { start?: number; end?: number }
): Promise<RAGAgentResult> {
  try {
    return await RAGAgent({
      query,
      yearRange,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "RAG agent execution failed",
    };
  }
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
      const { query, floatId, includeRag, includeSql, timeRange, yearRange } =
        input;

      try {
        // Step 1: Route query to appropriate agents
        const routing = await routeQuery(query);

        // Handle general queries without wasting resources
        if (
          routing.generalAgent &&
          !routing.sqlAgent &&
          !routing.duckdbAgent &&
          !routing.ragAgent
        ) {
          const generalResponse = await executeGeneralAgent(query);

          return {
            success: true,
            query,
            routing,
            sqlResults: null,
            duckdbResults: null,
            ragResults: null,
            response: generalResponse.response,
            citations: null,
            dataQuality: null,
            timestamp: new Date(),
            tokensUsed: 0,
            processingTimeMs: 0,
          };
        }

        // Step 2: Execute agents in parallel based on routing decision
        const [sqlResults, duckdbResults, ragResults] = await Promise.all([
          routing.sqlAgent && includeSql
            ? executeSQLAgent({ query, floatId, timeRange })
            : Promise.resolve(undefined),
          routing.duckdbAgent && includeSql
            ? executeDuckDBAgent({ query, floatId, timeRange })
            : Promise.resolve(undefined),
          routing.ragAgent && includeRag
            ? executeRAGAgent(query, yearRange)
            : Promise.resolve(undefined),
        ]);

        // Step 3: Orchestrate the final response
        const finalResponse = await responseOrchestrator({
          originalQuery: query,
          sqlResults,
          duckdbResults,
          ragResults,
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
          tokensUsed: finalResponse.tokensUsed,
          processingTimeMs: finalResponse.processingTimeMs,
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
      const result = await executeSQLAgent({
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
