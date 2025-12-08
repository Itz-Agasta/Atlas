/**
 * Shared TypeScript types for the Atlas API
 * These are domain types used across client and server
 *
 * Note: This file contains ONLY TypeScript types, not Zod schemas.
 * Zod schemas are co-located with their routers/modules following tRPC best practices.
 */

// Citation types
export type Citation = {
  paperId: string;
  title: string;
  authors: string[];
  doi?: string;
  year: number;
  url?: string;
  journal?: string;
  relevanceScore?: number;
};

export type ResearchPaperChunk = {
  paperId: string;
  title: string;
  authors: string[];
  doi?: string;
  year: number;
  url?: string;
  journal?: string;
  chunk: string;
  chunkIndex: number;
  score: number;
  keywords?: string[];
  abstract?: string;
};

// Query classification types
export type QueryType =
  | "METADATA_QUERY"
  | "PROFILE_ANALYSIS"
  | "LITERATURE_REVIEW"
  | "HYBRID"
  | "METHODOLOGICAL"
  | "FORECASTING"
  | "GENERAL";

export type QueryClassification = {
  queryType: QueryType;
  confidence: number;
  reasoning?: string;
};

// Scientific response types
export type DataQuality = {
  floatsAnalyzed: number;
  papersReferenced: number;
  sqlQueriesExecuted: number;
  ragSearchesPerformed: number;
  averageCitationRelevance?: number;
};

export type ScientificResponse = {
  response: string;
  citations: Citation[];
  dataQuality: DataQuality;
  queryType: string;
  timestamp: Date;
  tokensUsed?: number;
  processingTimeMs?: number;
  limitations?: string;
  futureResearch?: string;
};
