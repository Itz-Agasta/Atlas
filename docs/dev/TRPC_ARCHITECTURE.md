# tRPC Architecture Guide for Atlas

**Complete guide to understanding, maintaining, and deploying Atlas's tRPC-based API architecture.**

---

## Table of Contents

1. [Why tRPC?](#why-trpc)
2. [Atlas Architecture Overview](#atlas-architecture-overview)
3. [Schema Organization Best Practices](#schema-organization-best-practices)
4. [Monorepo Structure & Imports](#monorepo-structure--imports)
5. [Database Dependencies & Deployment](#database-dependencies--deployment)

---

## Why tRPC?

### The Problem We're Solving

Traditional REST APIs require:

- Writing API endpoint definitions
- Writing TypeScript types for requests/responses
- Keeping both in sync manually
- Writing API client code
- Handling serialization/deserialization

**This leads to:**

- Type mismatches between client and server
- Broken APIs after refactoring
- Duplicate code
- Runtime errors that could be caught at compile time

### How tRPC Solves This

tRPC provides **end-to-end type safety** from server to client:

```typescript
// Server: apps/api-gateway/src/routes/v1/agent.ts
export const agentRouter = router({
  query: publicProcedure
    .input(agentQueryInputSchema)
    .query(async ({ input }) => {
      return { answer: "Hello", citations: [] };
    }),
});

// Client: apps/web/src/app/page.tsx
const result = await trpc.agent.query({ query: "test" });
//    ^? { answer: string, citations: Citation[] }
//       ↑ Fully typed! No manual type definitions needed
```

**Benefits:**

- **Zero boilerplate** - No need to write API client code
- **Type safety** - Catch errors at compile time, not runtime
- **Auto-completion** - Full IDE support for API calls
- **Refactor with confidence** - Rename a field and all usages update
- **Better DX** - No context switching between server and client code

## Atlas Architecture Overview

### Package Responsibilities

| Package            | Purpose                  | Key Files                        | Dependencies                      |
| ------------------ | ------------------------ | -------------------------------- | --------------------------------- |
| `packages/api`     | Shared schemas & types   | `schemas/`, `types.ts`           | `zod`, `@trpc/server`             |
| `packages/db`      | Database schema & client | `schema.ts`, `index.ts`          | `drizzle-orm`, `postgres`         |
| `apps/api-gateway` | Server implementation    | `agents/`, `routes/`, `index.ts` | `@atlas/api`, `@atlas/db`, `hono` |
| `apps/web`         | Next.js client           | `app/`, `components/`            | `@atlas/api`, `@trpc/client`      |

---

## Schema Organization Best Practices

### The Three Types of Code

Atlas separates concerns into three layers following T3/tRPC monorepo best practices:

#### 1. **TypeScript Types** (`packages/api/src/types.ts`)

**Purpose:** Domain types shared between client and server

```typescript
// Pure TypeScript types (compile-time only)
export type Citation = {
  paperId: string;
  title: string;
  authors: string[];
  doi?: string;
  year: number;
};

export type QueryType = "DATA_ANALYSIS" | "LITERATURE_REVIEW" | "HYBRID";
```

**Rules:**

- NO Zod imports (`import { z } from "zod"`)
- NO runtime validation code
- ONLY TypeScript type definitions
- Can be imported by both client and server

#### 2. **tRPC Schemas** (`packages/api/src/schemas/agent.ts`)

**Purpose:** Runtime validation schemas shared between client and server

```typescript
// Dedicated schemas file for shared validation
import { z } from "zod";

// Schema definitions
export const agentQueryInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  floatId: z.number().optional(),
  includeRag: z.boolean().default(true),
  includeSql: z.boolean().default(true),
  timeRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

// Export inferred types for TypeScript
export type AgentQueryInput = z.infer<typeof agentQueryInputSchema>;
export type TestSQLInput = z.infer<typeof testSQLInputSchema>;
export type ClassifyInput = z.infer<typeof classifyInputSchema>;
```

**Rules:**

- Define schemas in dedicated `schemas/` directory
- Export both schemas and inferred types
- Use `.describe()` for API documentation
- Import schemas in router implementations
- NO router implementations in shared package

#### 3. **Router Implementations** (`apps/api-gateway/src/routes/v1/agent.ts`)

**Purpose:** Actual tRPC router implementations with business logic

```typescript
// Import schemas from shared package, implement routers in server app
import { publicProcedure, router } from "@atlas/api";
import {
  agentQueryInputSchema,
  testSQLInputSchema,
  classifyInputSchema,
} from "@atlas/api/schemas/agent";

export const agentRouter = router({
  query: publicProcedure
    .input(agentQueryInputSchema)
    .mutation(async ({ input }) => {
      // Actual implementation with business logic
      const result = await processQuery(input);
      return result;
    }),

  testSQL: publicProcedure
    .input(testSQLInputSchema)
    .query(async ({ input }) => {
      // Implementation here
    }),

  classify: publicProcedure
    .input(classifyInputSchema)
    .query(async ({ input }) => {
      // Implementation here
    }),
});

export type AgentRouter = typeof agentRouter;
```

**Rules:**

- Keep in `apps/api-gateway` (server-only)
- Import schemas from `@atlas/api/schemas/*`
- Contain actual business logic and implementations
- Export router type for client inference

#### 4. **Server-Only Schemas** (`apps/api-gateway/src/agents/*.ts`)

**Purpose:** Internal validation not exposed via tRPC

```typescript
// Internal schema for business logic
import { z } from "zod";

const queryTypeSchema = z.enum([
  "DATA_ANALYSIS",
  "LITERATURE_REVIEW",
  "HYBRID",
]);

export async function classifyQuery(query: string) {
  // Use schema for internal validation
  const type = await getClassification(query);
  return queryTypeSchema.parse(type);
}
```

**Rules:**

- Keep in `apps/api-gateway` (server-only)
- Don't export to `packages/api`
- Use for internal validation only

### File Structure Example

```
packages/api/src/
├── types.ts                    ← Pure TypeScript types
├── schemas/
│   └── agent.ts               ← Zod schemas + inferred types
└── index.ts                   ← tRPC setup exports

apps/api-gateway/src/
├── agents/
│   ├── classifier.ts          ← Internal Zod schemas (if needed)
│   ├── sql-agent.ts
│   └── rag-agent.ts
├── routes/
│   └── v1/
│       └── agent.ts           ← Router implementations using shared schemas
└── index.ts                   ← Hono server
```

### Import Patterns

```typescript
// Correct imports (new pattern)
import type { Citation, QueryType } from "@atlas/api"; // Types
import {
  agentQueryInputSchema,
  type AgentQueryInput,
} from "@atlas/api/schemas/agent"; // Schemas + types
import { db } from "@atlas/db"; // Database client
import { router, publicProcedure } from "@atlas/api"; // tRPC setup

// Wrong imports (old pattern)
import { agentQueryInputSchema } from "@atlas/api/routers/agent"; // NO! Moved to schemas/
import { Citation } from "@atlas/api/routers/agent"; // NO! Use types.ts
```

---

## Monorepo Structure & Imports

### Package Dependencies

```
apps/web          → @atlas/api (types + schemas + tRPC client)
apps/api-gateway  → @atlas/api (schemas + types + tRPC setup)
                  → @atlas/db (database access)
packages/api      → (no internal dependencies - pure types/schemas)
packages/db       → (no internal dependencies)
```

### How Imports Work in Turborepo

When you import from `@atlas/api`, TypeScript resolves it based on `package.json`:

```json
// packages/api/package.json
{
  "name": "@atlas/api",
  "exports": {
    ".": "./src/index.ts",
    "./schemas/*": "./src/schemas/*.ts",
    "./types": "./src/types.ts"
  }
}
```

This allows clean imports:

```typescript
import { router, publicProcedure } from "@atlas/api";
import {
  agentQueryInputSchema,
  type AgentQueryInput,
} from "@atlas/api/schemas/agent";
import type { Citation } from "@atlas/api";
```

### Building for Production

When deploying, packages are built into JavaScript:

```bash
bun run build
# Outputs:
# packages/api/dist/       ← Compiled JS
# packages/db/dist/        ← Compiled JS
# apps/api-gateway/dist/   ← Compiled JS + bundled
```

---

## Database Dependencies & Deployment

### The `import { db } from "@atlas/db"` Problem

**Question:** If `apps/api-gateway` imports the database, how do we deploy it?

**Answer:** The database connection is established at **runtime**, not build time.

### How It Works

```typescript
// packages/db/src/index.ts
import { drizzle } from "drizzle-orm/node-postgres";

// Database URL from environment variable
const connectionString = process.env.DATABASE_URL;
export const db = drizzle(connectionString);
```

**Key Points:**

1. `@atlas/db` exports a database **client**, not the database itself
2. Connection string comes from **environment variables**
3. Works in Docker, Cloudflare Workers, or any Node.js environment
