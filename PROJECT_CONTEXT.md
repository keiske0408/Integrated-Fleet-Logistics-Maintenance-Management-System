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
- **Spend Protection**: Procurement writes use `rateLimitProcurementWrite`; TSRF, dynamic form writes, and all other API writes also have Arcjet coverage. Production writes fail closed if required Arcjet configuration/checks are unavailable.
- **Intake Defense**: External and public intake forms (such as TSRF requests) must enforce bot detection via `protectTsrfIntake`.

## 5. Feature Context

- Form-builder and LOV architecture notes: `src/features/form-builder/AI_CONTEXT.md`.
- Phase 1 implementation status and local demo/test instructions: `docs/PHASE_1_IMPLEMENTATION_AND_DEMO.md`.
- Form-builder rules support client-side visibility, requiredness, and editability with publish validation; server validates version-pinned submissions and configured workflow transitions.
- Workflow configuration is stored per form version; the builder edits stages/transitions/field access/cutoff, and the API enforces role transitions and stage-based data edits. Reports expose only configured reportable fields and exclude PII. Returned-TSRF owner edit/resubmit and strict owner detail projection are implemented; requester edits require a returned stage and explicit field access, while reviewer detail continues to omit explicitly hidden fields. Finance/approval print stamps are projected from workflow events. Form Builder definition/draft/workflow/publish changes are persisted in Activity History with form/version metadata and without storing form payloads. Local UI demo actions remain local and are labeled accordingly.
- TSRF Fleet Asset allocation can resolve an active vehicle by ID with a label snapshot; third-party allocation is conditional. Driver entity lookup remains unavailable until a backend driver entity is modeled.
- Form print output is generated from the versioned schema and saved label snapshots; Finance Verification and Approval stamp blocks use persisted workflow events. Remaining paper-form parity is pending.

## 6. Current Product Phase: Form Builder Activity History

- **Status:** The owner-scoped returned-TSRF inbox, edit/resubmit flow, nested field-level edit enforcement, owner response masking, finance/approval print stamps, and semantic audit linkage for form definition and workflow edits are implemented. Audit metadata identifies the form and version but excludes schema/workflow payloads. Entra and Fleet-local auth paths are also implemented; production readiness remains pending deployment configuration, a secure first-admin bootstrap, and real Entra/SMTP verification.
- Both providers resolve to the same active Fleet user and internal backend role. Entra linking is explicit; local passwords use Argon2id, and local sessions/reset tokens are hashed, expiring, and revocable. Production rejects simulated identity headers. Non-Microsoft signup uses active Department LOV and backend roles with CASL mappings; the requested role is only a preference, and admin approval assigns the final role. Frontend-only custom roles are not authorization grants.
- Signup fields are not currently admin-customizable: identity fields stay fixed while department and requested role come from backend catalogs. A future configurable form should use typed, validated, allowlisted fields and must not let custom fields grant roles or permissions.
- First-admin setup is provided by the one-time backend `npm run auth:bootstrap-admin` command. It uses environment-supplied credentials, adopts the matching seed admin when available, and refuses repeat bootstrap after an admin identity exists. No password is seeded in migrations.
- Migration-seeded Fleet users do not have local credentials or linked identities. The frontend demo accounts are in-memory development demos only, not database-seeded login credentials.
- Department LOV items now link to active Approver/Admin users; each TSRF snapshots the selected department's linked head, and the API enforces that identity on the initial approval. Persistent activity audit records successful authenticated backend mutations; UI-only mock actions are labeled as local rather than treated as committed transactions.
- **Verification snapshot (2026-10-05):** backend build and 33 tests pass; frontend typecheck, 28 tests, targeted lint, and production build pass. Signup options use active Department LOV items and supported backend Role catalog entries; Department LOV items link to approver users for TSRF routing. Persistent activity history records successful backend mutations; local demo actions remain marked local.
- **Next product work:** driver entity lookup, dynamic server-backed role policies, and remaining paper-form parity.
- See [`docs/HYBRID_AUTH.md`](docs/HYBRID_AUTH.md) for configuration, signup/approval, bootstrap, account provisioning/linking, current blockers, and rollout guidance.
