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

## 5. Feature Context

- Form-builder and LOV architecture notes: `src/features/form-builder/AI_CONTEXT.md`.
- Form-builder rules support client-side visibility, requiredness, and editability with publish validation; server validates version-pinned submissions and configured workflow transitions.
- Workflow configuration is stored per form version; the builder edits stages/transitions/field access/cutoff, and the API enforces role transitions and stage-based data edits. Reports expose only configured reportable fields and exclude PII. Response masking, returned-edit/resubmit UI, approval stamps, and complete Activity History integration remain pending.
- TSRF Fleet Asset allocation can resolve an active vehicle by ID with a label snapshot; third-party allocation is conditional. Driver entity lookup remains unavailable until a backend driver entity is modeled.
