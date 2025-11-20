import { publicProcedure, router } from "@atlas/api";
import {
  agentQueryInputSchema,
  classifyInputSchema,
  testSQLInputSchema,
} from "@atlas/api/routers/agent";
import { classifyQueryDirect } from "../../agents/classifier";
import { executeGeneralAgent } from "../../agents/general-agent";
import { RAGAgent, type RAGAgentResult } from "../../agents/rag-agent";
import { SQLAgent, type SQLAgentResult } from "../../agents/sql-agent";
import { responseOrchestrator } from "../../middleware/orchestrator";

/**
 * Execute SQL agent with error handling
 */
async function executeSQLAgent(
  query: string,
  floatId?: number,
  timeRange?: { start?: string; end?: string }
): Promise<SQLAgentResult> {
  try {
    return await SQLAgent({
      query,
      floatId,
      timeRange,
      dryRun: false,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "SQL agent execution failed",
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
        // Step 1: Classify the query
        const classification = await classifyQueryDirect(query);

        // Handle general queries without wasting resources
        if (classification.queryType === "GENERAL") {
          const generalResponse = await executeGeneralAgent(query);

          return {
            success: true,
            query,
            classification,
            sqlResults: null,
            ragResults: null,
            response: generalResponse.response,
            citations: null,
            dataQuality: null,
            timestamp: new Date(),
            tokensUsed: 0,
            processingTimeMs: 0,
          };
        }

        // Step 2: Determine which agents to execute
        const shouldExecuteSQL =
          includeSql &&
          ["DATA_ANALYSIS", "HYBRID", "FORECASTING"].includes(
            classification.queryType
          );

        const shouldExecuteRAG =
          includeRag &&
          ["LITERATURE_REVIEW", "HYBRID", "METHODOLOGICAL"].includes(
            classification.queryType
          );

        // Step 3: Execute agents in parallel
        const [sqlResults, ragResults] = await Promise.all([
          shouldExecuteSQL
            ? executeSQLAgent(query, floatId, timeRange)
            : Promise.resolve(undefined),
          shouldExecuteRAG
            ? executeRAGAgent(query, yearRange)
            : Promise.resolve(undefined),
        ]);

        // Step 4: Orchestrate the final response
        const finalResponse = await responseOrchestrator({
          queryType: classification.queryType,
          originalQuery: query,
          sqlResults,
          ragResults,
        });

        return {
          success: true,
          query,
          classification,
          sqlResults: sqlResults || null,
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
   * Classify query type without execution
   *
   * @URL `POST /trpc/agent.classify`
   */
  classify: publicProcedure
    .input(classifyInputSchema)
    .query(async ({ input }) => {
      const classification = await classifyQueryDirect(input.query);
      return classification;
    }),
});

export type AgentRouter = typeof agentRouter;
