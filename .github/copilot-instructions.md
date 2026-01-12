---
applyTo: "**/*.{ts,tsx,js,jsx}"
---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Zod Schema Organization

This project uses Zod for type-safe APIs. Follow these patterns strictly to avoid duplicate schemas and maintain clarity.

### Architecture Overview

```
packages/schema/          ← Shared schemas and types
├── src/
│   ├── api/
│   │   └── agent.ts      ← ✅ Zod schemas + inferred types


apps/server/              ← Server implementation
├── src/
│   ├── agents/           ← Business logic
│   ├── routes/           ← Route handlers using @atlas/api schemas
│   └── index.ts          ← Hono server
```

### Rule 1: Separate Zod Schemas from Router Implementations

**DO:** Define Zod schemas in dedicated `packages/scehma/api/agent/` directory for maintanbality. If drectory not avalible make one.

```typescript
// ✅ packages/scehma/src/agent.ts
import { z } from "zod";

// Schemas defined in dedicated file
export const agentQueryInputSchema = z.object({
  query: z.string().min(1),
  floatId: z.number().optional(),
});

// Export inferred types
export type AgentQueryInput = z.infer<typeof agentQueryInputSchema>; // Only infer types when that scehma is needed somewhere.
```

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.

---

## Python Code Standards

For Python files, this project uses **Ruff** for fast linting and formatting, and **ty** for type checking.

### Quick Reference (Python)

- **Format and lint code**: `uv run ruff check --fix`
- **Type check**: `uv run ty check`
- **Format code only**: `uv run ruff format`

### Python Best Practices

- Use type hints for all function parameters and return values
- Use `pathlib.Path` instead of string paths
- Prefer `Optional[T]` for nullable values; avoid `None` as default without type hints
- Use f-strings for string formatting
- Keep functions focused and under 50 lines when possible
- Use meaningful variable names; avoid single-letter variables except in loops
- Handle exceptions explicitly - don't use bare `except`
- Use logging instead of print statements for production code
- Follow PEP 8 conventions for naming and spacing

### Testing & Quality

- Write docstrings for all public functions and classes
- Use type hints to prevent runtime errors
- Keep test functions under 30 lines
- Use fixtures and parameterization in pytest
- Aim for >80% code coverage on critical paths

---

## Secret Management

This project uses **Infisical** for secure secret management and environment variable handling.

### Running Applications with Secrets

Always use Infisical to inject secrets into your application environment:

```bash
# General syntax
infisical run --env=<environment> --path=<project-path> -- [your command]

# Examples:
# Development environment
infisical run --env=dev -- bun run dev
infisical run --env=dev --path=/apps/workers -- uv run python -m src.atlas_workers.workers.netcdf_parser

# Production environment
infisical run --env=prod --path=/apps/backend -- flask run

```

### Environment Configuration

- Use `--env=dev` for development
- Use `--env=prod` for production
- Specify the correct `--path` to match your project's Infisical configuration
- Never commit secrets or `.env` files with sensitive data

---

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues for typescript are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance. and for python use `Ruff`.
