# Multi-Agent Architecture

This document outlines the multi-agent architecture used in the Atlas API Gateway to handle complex oceanographic queries. The system uses a router-orchestrator pattern to delegate tasks to specialized agents and synthesize their results into a comprehensive scientific response.

> **Last Updated**: January 2026  
> **Status**: Active and in production

## Overview

The architecture is designed to handle three distinct types of data/knowledge:

1.  **Structured Metadata**: Float locations, status, and technical details (PostgreSQL).
2.  **High-Volume Time-Series**: Temperature, salinity, and pressure profiles (DuckDB/Parquet).
3.  **Unstructured Knowledge**: Scientific literature and research papers (RAG).

Instead of a single monolithic agent, we use a **Router** to classify queries and an **Orchestrator** to manage parallel execution and response synthesis.

## Architecture Diagram

![agent_arch](../imgs/agent.png)

## Quick Start

**Endpoint**: `POST /api/v1/agent/query`

```bash
curl -X POST http://localhost:3000/api/v1/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Where is float 2902226?"}'
```

**Request Schema**:

```typescript
{
  query: string; // Natural language query
}
```

## Core Components

### 1. Router Agent (`agents/router-agent.ts`)

The entry point for all queries. It uses an LLM to analyze the user's intent and returns a structured JSON decision on which agents to activate.

- **Input**: User query string.
- **Output**: `RoutingDecision` object with boolean flags for each agent.
- **Logic**:
  - **SQL Agent**: For location, status, battery, and metadata queries about specific floats.
  - **DuckDB Agent**: For historical data, profiles, trends, and time-series analysis.
  - **RAG Agent**: For research papers, methodology, and scientific context.
  - **General Agent**: For greetings, casual chat, and system explanations.

**RoutingDecision Interface**:

```typescript
{
  sqlAgent: boolean;
  duckdbAgent: boolean;
  ragAgent: boolean;
  generalAgent: boolean;
}
```

### 2. Orchestrator (`middleware/orchestrator.ts` → `responseOrchestrator`)

The central coordinator responsible for:

1. Receiving routing decision from Router Agent
2. Executing selected agents **in parallel**
3. Aggregating results into a unified `AgentResults` object
4. Passing results to the Response Orchestrator for final synthesis

**Flow**:

```
Query → Router → Execute Agents (parallel) → Orchestrator → LLM Synthesis → Response
```

**Key Features**:

- **Parallel Execution**: All selected agents run concurrently via `Promise.all()`
- **Error Handling**: Gracefully handles individual agent failures
- **Metrics Collection**: Tracks execution time and token usage per agent

### 3. Response Orchestrator

A specialized LLM call that synthesizes raw data from all agents. It is responsible for:

- Synthesizing findings from different sources (SQL metadata + DuckDB time-series + RAG papers)
- Adding citations and references (e.g., "[Smith et al., 2023]")
- Calculating data quality metrics
- Formatting output for human readability

**Output Structure**:

```typescript
{
  success: boolean;
  query: string;
  routing: RoutingDecision;
  response: string;
  citations: Citation[] | null;
  agentMetrics: MetricsObject;
  timestamp: Date;
}
```

## Specialized Agents

### SQL Agent (`agents/sql-agent.ts`)

- **Role**: Expert on Argo float **metadata** and **current status**.
- **Data Source**: PostgreSQL + PostGIS (`argo_float_metadata`, `argo_float_status`).
- **Capabilities**:
  - Float lookup by WMO number or float ID
  - Spatial queries (e.g., "floats in the Indian Ocean")
  - Status checks (Active/Inactive/Dead, battery level, last reported position)
  - Recent surface readings and technical details
- **Constraints**: Does NOT query full profile history (handled by DuckDB Agent)

**Example**:

```
Q: "Is float 2902226 active?"
→ SQL Agent queries argo_float_status table
→ Returns current position, battery %, status
```

### DuckDB Agent (`agents/duckdb-agent.ts`)

- **Role**: Expert on **high-volume profile data** and time-series analysis.
- **Data Source**: Parquet files in S3 (`s3://atlas/profiles/<float_id>/data.parquet`), queried via DuckDB.
- **Schema**: Denormalized "long" format (one row = one measurement at one depth)
- **Capabilities**:
  - Vertical profiles (Temperature/Salinity vs Depth)
  - Time-series trends (surface temperature over cycles)
  - Aggregations and statistical analysis
  - BGC data (oxygen, chlorophyll, nitrate)
  - Quality flag analysis
- **Optimization**: Uses schema knowledge for efficient Parquet predicate pushdown

**Example**:

```
Q: "Show temperature trend for float 2902226"
→ DuckDB Agent reads parquet from S3
→ Extracts temperature by cycle
→ Returns trend data and statistics
```

### RAG Agent (`agents/rag-agent.ts`)

- **Role**: Research librarian with access to oceanographic literature.
- **Data Source**: Vector database (Qdrant) containing indexed research papers.
- **Capabilities**:
  - Semantic search for relevant paper chunks
  - Methodology and scientific consensus context
  - Citations and references for scientific findings
- **Status**: Integration prepared; vector store setup pending

**Example**:

```
Q: "What methodology do researchers use for Argo calibration?"
→ RAG Agent searches vector database
→ Returns relevant paper excerpts with citations
```

### General Agent (`agents/general-agent.ts`)

- **Role**: Conversational interface for non-technical queries.
- **Capabilities**:
  - Greeting responses ("Hi", "Hello")
  - System capability explanations
  - Polite redirection of off-topic queries
- **Routing**: Only called if Router decides query is purely conversational

## Data Flow Example

**Scenario**: "Where is float 2902226 and show its temperature trend?"

1. **User Query**:

   ```
   POST /api/v1/agent/query
   { "query": "Where is float 2902226 and show its temperature trend?" }
   ```

2. **Router Decision** (LLM analyzes intent):

   ```typescript
   {
     sqlAgent: true,      // need location info
     duckdbAgent: true,   // need historical temperature
     ragAgent: false,
     generalAgent: false
   }
   ```

3. **Parallel Agent Execution**:

   - **SQL Agent**: `SELECT location, battery_percent, status FROM argo_float_status WHERE float_id = 2902226`
     - Returns: `{ lat: -10.5, lon: 75.2, battery: 85%, status: 'ACTIVE' }`
   - **DuckDB Agent**: `SELECT cycle_number, temperature FROM read_parquet('s3://atlas/profiles/2902226/data.parquet') WHERE NOT temperature IS NULL ORDER BY cycle_number`
     - Returns: `[ { cycle: 1, temp: 28.5 }, { cycle: 2, temp: 28.4 }, ... ]`

4. **Response Orchestration** (LLM synthesizes):

   ```
   "Float 2902226 is currently at position (-10.5°S, 75.2°E)
    with 85% battery and ACTIVE status. The latest temperature
    trend shows a gradual cooling from 28.5°C (cycle 1) to
    26.2°C (cycle 10), typical of downwelling patterns..."
   ```

5. **Response**:
   ```json
   {
     "success": true,
     "query": "Where is float 2902226 and show its temperature trend?",
     "routing": { ... },
     "response": "Float 2902226 is currently...",
     "citations": null,
     "agentMetrics": {
       "routingTimeMs": 145,
       "sqlAgentTimeMs": 89,
       "duckdbAgentTimeMs": 234,
       "orchestrationTimeMs": 312,
       "totalTimeMs": 780
     }
   }
   ```
6. **Response Orchestrator**:
   - Receives both datasets.
   - Generates: "Float 2902226 is currently active in the Indian Ocean (-10.5, 75.2). Analysis of its temperature profile shows a slight cooling trend..."

## Extending the System

To add a new agent (e.g., a "Weather Agent"):

1.  **Create the Agent**: Add `src/agents/weather-agent.ts` with a specialized system prompt and tool execution logic.
2.  **Update Router**: Modify `ROUTER_SYSTEM_PROMPT` in `src/agents/router-agent.ts` to include rules for the new agent.
3.  **Update Types**: Add the new agent to `RoutingDecision` and `AgentResults` types.
4.  **Update Orchestrator**: Add logic in `src/middleware/orchestrator.ts` to call the new agent when the router selects it.
5.  **Update Context**: Update `formatAgentContext` in `src/utils/orchestrator-utils.ts` to include the new agent's output in the final prompt.

## Key Design Principles

- **Separation of Concerns**: SQL for metadata, DuckDB for big data, RAG for text.
- **Parallel Execution**: Agents run concurrently to minimize latency.
- **Strict Schemas**: Agents have hardcoded knowledge of their specific database schemas to ensure query accuracy.
- **Synthesized Output**: The user sees a single, coherent response, not a list of separate agent outputs.
