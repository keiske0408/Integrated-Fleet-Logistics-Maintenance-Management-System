# Form Builder Context

Phase 1 introduces the generic LOV foundation used by future schema-driven forms.

## LOV Binding

The four legacy reference-data collections are represented by the system LOV codes `DEPARTMENTS`, `VEHICLE_TYPES`, `MAINTENANCE_CATEGORIES`, and `VENDORS`. `LovProvider` loads and mutates these collections through `/api/lov` when the backend is available; bundled seed state remains as an offline fallback. `ReferenceDataContext` adapts LOV items to legacy consumer types. The backend tables and routes are additive and preserve legacy tables and routes.

LOV items store a stable code, display label, optional parent id, active/inactive status, and JSON attributes. Attributes are defined per list and can be used by lookup labels and rules. Item delete routes soft-deactivate; attribute definitions currently support CRUD. Backend LOV reads require authenticated access and mutations require the admin-level `manage LovList` ability. The current auth middleware is simulated via role headers; do not treat client-supplied headers as production authentication.

## Adding Future Field Types

The form-builder field registry should keep each type's default configuration, validation, runtime renderer, serializer, and print renderer together. The builder core should consume the registry rather than branch on individual field types. Field keys become immutable after first publish; labels remain editable.

The current registry includes scalar inputs, LOV lookups, notices, and repeaters. `FormRenderer` supports repeaters with child fields, row limits, and declarative rules. `FormBuilderPage` provides a local design canvas with palette insertion, drag reorder, property editing, preview, and JSON export. Backend definitions are persisted through `/api/forms`, with draft and publish version lifecycle endpoints.

The builder loads the latest draft or published version from `/api/forms/:key`. Saving an unpersisted definition creates v1; saving edits creates or updates a draft version. Publishing requires an existing draft and passes client and server validation for duplicate keys, invalid rule/LOV references, required metadata, and the 256 KB schema limit. Runtime submission validation enforces required fields and repeater min/max constraints before invoking the submit callback.

Live TSRF pages use `PublishedTsrfForm`, which selects the newest published version returned by `/api/forms/published/tsrf`; drafts are never shown to requestors. If the API is unavailable or no published version exists, the page falls back to the bundled TSRF v1 definition and submits via the legacy TSRF endpoint.

## Rules and Workflow

Rules must be declarative data evaluated by a shared client/server evaluator. Do not use `eval` or `new Function`. Workflow stages control field visibility and editability, and server-side validation must enforce those permissions for submissions.

The client evaluator supports equality, inequality, membership, existence, visibility, requiredness, and enabled-state actions. The field Properties panel authors these conditional rules. The Workflow & Cut-off panel edits stages, fixed system status categories, role allowlists, transition-required fields/reasons, per-role field access, and the cutoff time/timezone/late policy.

Server submission validation rejects unknown/hidden fields, missing required values, invalid or inactive LOV selections, and invalid repeater rows; it stores code-to-label snapshots and pins submissions to the published version. Workflow transitions use the version's `workflowJson`, enforce allowed roles/reasons/required fields/status categories, and create an actor/comment event. Submission data PATCHes are restricted by current stage field-access maps. Cutoff evaluation uses configured `Intl` timezone conversion; late requests are flagged and routed to the exception stage when that policy is selected. `GET /api/forms/:key/submissions/report` returns reportable data only, recursively excluding fields marked PII, with a bounded result limit.

Still pending: field access filtering in read responses, requestor returned-edit/resubmit UI, finance/approval stamp fields, end-to-end Activity History linkage for builder/workflow edits, entity lookup fields, print output, and the remaining paper-form fields.

## Validation

Run `npm run build` and `npm test -- --run` in both project directories. Backend integration tests require the configured PostgreSQL connection. Run `npm run api:spec` whenever the public API contract is promoted to the generated OpenAPI types.
