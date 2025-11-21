import { createGroq } from "@ai-sdk/groq";
import type { ResearchPaperChunk } from "@atlas/api";
import { generateText } from "ai";
import { config } from "../config/config";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

// Constants
const DEFAULT_TOP_K = 5;

export type RAGAgentResult = {
  success: boolean;
  papers?: ResearchPaperChunk[];
  papersFound?: number;
  query?: string;
  error?: string;
  searchTimeMs?: number;
};

export type RAGAgentParams = {
  query: string;
  topK?: number;
  yearRange?: {
    start?: number;
    end?: number;
  };
};

/**
 * RAG Agent for Research Paper Retrieval
 * Currently uses mock data - integrate with Qdrant for production
 */
export async function RAGAgent(
  params: RAGAgentParams
): Promise<RAGAgentResult> {
  const { query, topK = DEFAULT_TOP_K, yearRange } = params;
  const startTime = Date.now();

  try {
    // TODO: Integrate with Qdrant vector database
    // For now, use LLM to generate mock research context
    const { text: summary } = await generateText({
      model: groq(config.models.ragAgent),
      system: `You are a research librarian specializing in oceanography and Argo float research.

Generate a list of relevant research papers for the given query. Format each paper as JSON:

{
  "paperId": "unique-id",
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "doi": "10.1234/example",
  "year": 2023,
  "url": "https://doi.org/10.1234/example",
  "journal": "Journal Name",
  "chunk": "A relevant excerpt from the paper discussing the topic...",
  "chunkIndex": 0,
  "score": 0.95,
  "keywords": ["keyword1", "keyword2"],
  "abstract": "Brief abstract of the paper..."
}

Provide ${topK} relevant papers ${yearRange ? `published between ${yearRange.start || "any year"} and ${yearRange.end || "present"}` : ""}.
Return ONLY a valid JSON array of papers without any markdown formatting.`,
      prompt: `Find research papers about: ${query}`,
      maxOutputTokens: 2000,
    });

    // Parse the LLM response
    let papers: ResearchPaperChunk[];
    try {
      const cleanedText = summary
        .trim()
        .replace(/^```json\n?|```$/g, "")
        .trim();
      papers = JSON.parse(cleanedText);

      // Validate it's an array
      if (!Array.isArray(papers)) {
        throw new Error("Response is not an array");
      }

      // Limit to topK results
      papers = papers.slice(0, topK);
    } catch {
      return {
        success: false,
        error:
          "Failed to retrieve research papers. Server busy, please try again later.",
        searchTimeMs: Date.now() - startTime,
      };
    }

    const searchTimeMs = Date.now() - startTime;

    return {
      success: true,
      papers,
      papersFound: papers.length,
      query,
      searchTimeMs,
    };
  } catch (error) {
    const searchTimeMs = Date.now() - startTime;
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown RAG search error",
      searchTimeMs,
    };
  }
}
