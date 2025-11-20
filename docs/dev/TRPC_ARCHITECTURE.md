# tRPC Architecture Guide for Atlas

**Complete guide to understanding, maintaining, and deploying Atlas's tRPC-based API architecture.**

---

## Table of Contents

1. [Why tRPC?](#why-trpc)
2. [Atlas Architecture Overview](#atlas-architecture-overview)
3. [Schema Organization Best Practices](#schema-organization-best-practices)
4. [Monorepo Structure & Imports](#monorepo-structure--imports)
5. [Database Dependencies & Deployment](#database-dependencies--deployment)
6. [Docker Deployment Guide](#docker-deployment-guide)
7. [Cloudflare Deployment Guide](#cloudflare-deployment-guide)
8. [Troubleshooting Common Issues](#troubleshooting-common-issues)

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
// Server: packages/api/src/routers/agent.ts
export const agentRouter = router({
  query: publicProcedure
    .input(z.object({ query: z.string() }))
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

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Atlas Monorepo                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐ │
│  │   packages/  │      │    apps/     │      │  apps/   │ │
│  │     api      │─────▶│ api-gateway  │      │   web    │ │
│  │              │      │   (Server)   │◀────▶│ (Client) │ │
│  │  tRPC Defs   │      │  Hono + tRPC │      │ Next.js  │ │
│  └──────────────┘      └──────────────┘      └──────────┘ │
│         │                      │                           │
│         │                      │                           │
│  ┌──────┴──────┐      ┌────────┴────────┐                 │
│  │  packages/  │      │   PostgreSQL    │                 │
│  │     db      │      │   (Neon/Supabase)│                │
│  │             │      │                 │                 │
│  │ Drizzle ORM │      │  Argo Float Data│                 │
│  └─────────────┘      └─────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Package Responsibilities

| Package            | Purpose                  | Key Files                        | Dependencies                      |
| ------------------ | ------------------------ | -------------------------------- | --------------------------------- |
| `packages/api`     | Shared tRPC definitions  | `routers/`, `types.ts`           | `zod`, `@trpc/server`             |
| `packages/db`      | Database schema & client | `schema.ts`, `index.ts`          | `drizzle-orm`, `postgres`         |
| `apps/api-gateway` | Server implementation    | `agents/`, `routes/`, `index.ts` | `@atlas/api`, `@atlas/db`, `hono` |
| `apps/web`         | Next.js client           | `app/`, `components/`            | `@atlas/api`, `@trpc/client`      |

---

## Schema Organization Best Practices

### The Three Types of Code

Atlas separates concerns into three layers:

#### 1. **TypeScript Types** (`packages/api/src/types.ts`)

**Purpose:** Domain types shared between client and server

```typescript
// ✅ Pure TypeScript types (compile-time only)
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

- ✅ NO Zod imports (`import { z } from "zod"`)
- ✅ NO runtime validation code
- ✅ ONLY TypeScript type definitions
- ✅ Can be imported by both client and server

#### 2. **tRPC Schemas** (`packages/api/src/routers/*.ts`)

**Purpose:** Runtime validation for tRPC endpoints

```typescript
// ✅ Co-located with router definition
import { z } from "zod";
import { publicProcedure, router } from "../index";

// Schema definition
export const agentQueryInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  floatId: z.number().optional(),
});

// Router using the schema
export const agentRouter = router({
  query: publicProcedure
    .input(agentQueryInputSchema)
    .query(async ({ input }) => {
      // input is typed as { query: string; floatId?: number }
    }),
});

// Export TypeScript type for use elsewhere
export type AgentQueryInput = z.infer<typeof agentQueryInputSchema>;
```

**Rules:**

- ✅ Define schemas in the SAME file as the router
- ✅ Export both schemas and inferred types
- ✅ Use `.describe()` for API documentation
- ❌ NO separate `schemas/` directory
- ❌ NO barrel files (`index.ts` re-exporting schemas)

#### 3. **Server-Only Schemas** (`apps/api-gateway/src/agents/*.ts`)

**Purpose:** Internal validation not exposed via tRPC

```typescript
// ✅ Internal schema for business logic
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

- ✅ Keep in `apps/api-gateway` (server-only)
- ✅ Don't export to `packages/api`
- ✅ Use for internal validation only

### File Structure Example

```
packages/api/src/
├── types.ts                    ← Pure TypeScript types
├── routers/
│   ├── agent.ts               ← Zod schemas + tRPC router
│   └── index.ts               ← Router aggregation
└── index.ts                   ← tRPC exports

apps/api-gateway/src/
├── agents/
│   ├── classifier.ts          ← Internal Zod schemas (if needed)
│   ├── sql-agent.ts
│   └── rag-agent.ts
├── routes/
│   └── v1/
│       └── agent.ts           ← Route handlers using @atlas/api
└── index.ts                   ← Hono server
```

### Import Patterns

```typescript
// ✅ Correct imports
import type { Citation, QueryType } from "@atlas/api"; // Types
import { agentQueryInputSchema } from "@atlas/api/routers/agent"; // Schemas
import { db } from "@atlas/db"; // Database client

// ❌ Wrong imports
import { agentQueryInputSchema } from "@atlas/api/schemas/agent"; // NO! Doesn't exist
import { Citation } from "@atlas/api/routers/agent"; // NO! Use types.ts
```

---

## Monorepo Structure & Imports

### Package Dependencies

```
apps/web          → @atlas/api (types + tRPC client)
apps/api-gateway  → @atlas/api (routers + types)
                  → @atlas/db (database access)
packages/api      → (no internal dependencies)
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
    "./routers/*": "./src/routers/*.ts",
    "./types": "./src/types.ts"
  }
}
```

This allows clean imports:

```typescript
import { router, publicProcedure } from "@atlas/api";
import { agentQueryInputSchema } from "@atlas/api/routers/agent";
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

---

## Troubleshooting Common Issues

### 1. **"Cannot find module '@atlas/api'"**

**Cause:** Packages not built or TypeScript can't resolve paths.

**Solution:**

```bash
# Build packages first
bun run build --filter=@atlas/api
bun run build --filter=@atlas/db

# Verify package.json exports
cat packages/api/package.json | grep exports
```

### 2. **Duplicate Schema Definitions**

**Cause:** Schemas defined in both `routers/` and `schemas/` directories.

**Solution:**

```bash
# Remove schemas directory
rm -rf packages/api/src/schemas/

# Keep schemas only in routers/
```

### 3. **tRPC Type Errors After Refactor**

**Cause:** Client cache stale or types not regenerated.

**Solution:**

```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Rebuild packages
bun run build

# Restart dev server
bun run dev
```

---

## Best Practices Summary

### ✅ DO

- Co-locate Zod schemas with tRPC routers
- Keep `types.ts` for TypeScript types only
- Use environment variables for secrets
- Build packages before deploying
- Use HTTP-based database drivers for serverless
- Export both schemas and inferred types from routers

### ❌ DON'T

- Create separate `schemas/` directories
- Mix Zod schemas with TypeScript types
- Use barrel files (`index.ts` re-exporting everything)
- Hardcode secrets in code
- Deploy without building dependencies first
- Use native database drivers in Cloudflare Workers

---

## Additional Resources

- [tRPC Documentation](https://trpc.io)
- [Zod Documentation](https://zod.dev)
- [Turborepo Documentation](https://turbo.build/repo)
- [Drizzle ORM](https://orm.drizzle.team)
- [T3-stack](https://create.t3.gg/en/usage/trpc)
