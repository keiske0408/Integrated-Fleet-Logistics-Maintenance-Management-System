# Project Context & Engineering Standards

## 1. Anti-slop rules

- **Prefer editing existing files over creating new ones**: Avoid file fragmentation. Extend existing modules when sensible.
- **No abstraction unless used in 2+ places today**: Do not create speculative generics, helpers, or premature utility wrappers. Build for today's concrete requirement.
- **No comments that restate the code**: Code must be clear and self-documenting. Use comments only for non-obvious business logic, domain constraints, or architectural rationale.
- **Never leave commented-out code, delete it**: Rely on Git history for dead code. Clean workspaces prevent confusion.
- **shadcn components in `components/ui`**: All shadcn/ui components are copied directly into `components/ui`, not npm-installed. Before adding a new component via the shadcn CLI, always check `components/ui` for an existing primitive that already covers the requirement.

## 2. Caveman debugging discipline

- **Debugging rule**: Use `logger.debug('[module]', ...)`, never bare `console.log`.
- **Pre-release cleanup**: Remove all debug logging before marking a task done.
- **Enforcement**: Bare `console.log` is enforced as an ESLint error (`no-console: error`) and checked during pre-commit hooks on staged non-test files.

## 3. API Contract Sync & Type Single Source of Truth

- **Single Source of Truth**: DB tables (Drizzle) -> Auto-generated Zod Schemas (`drizzle-zod`) -> OpenAPI Spec (`@asteasolutions/zod-to-openapi`) -> Frontend Client Types (`openapi-typescript`).
- **No Hand-Written Duplicates**: API types must come from the generated file (`src/api/generated-types.ts`) — no hand-written duplicates of request/response shapes are permitted. Run `npm run api:spec` to sync contract changes.

## 4. Security & Abuse Prevention (Arcjet)

- **Rule**: Any new public or write-heavy endpoint needs an Arcjet rule before it ships, not after.
- **Spend Protection**: All financial and procurement approval endpoints (`/api/pr/*`, `/api/procurement/*`) must enforce rate limiting via `rateLimitPrApproval`.
- **Intake Defense**: External and public intake forms (such as TSRF requests) must enforce bot detection via `protectTsrfIntake`.
