# Form Builder Context

Phase 1 introduces the generic LOV foundation used by future schema-driven forms.

## LOV Binding

The four legacy reference-data collections are represented by the system LOV codes `DEPARTMENTS`, `VEHICLE_TYPES`, `MAINTENANCE_CATEGORIES`, and `VENDORS`. `LovProvider` loads and mutates these collections through `/api/lov` when the backend is available; bundled seed state remains as an offline fallback. `ReferenceDataContext` adapts LOV items to legacy consumer types. The backend tables and routes are additive and preserve legacy tables and routes.

LOV items store a stable code, display label, optional parent id, active/inactive status, and JSON attributes. Attributes are defined per list and can be used by lookup labels and rules. Item delete routes soft-deactivate; attribute definitions currently support CRUD. Backend LOV reads require authenticated access and mutations require the admin-level `manage LovList` ability. Authentication supports Entra tokens and local sessions; development role headers are gated to test or explicitly enabled non-production environments and must not be enabled in production.

## Adding Future Field Types

The form-builder field registry should keep each type's default configuration, validation, runtime renderer, serializer, and print renderer together. The builder core should consume the registry rather than branch on individual field types. Field keys become immutable after first publish; labels remain editable.

The current registry includes scalar inputs, LOV lookups, active Fleet Vehicle entity lookups, notices, and repeaters. `FormRenderer` supports repeaters with child fields, row limits, and declarative rules. `FormBuilderPage` provides a local design canvas with palette insertion, drag reorder, property editing, preview, and JSON export. For fields in a published version, the builder locks the field key while allowing label edits; the publish API rejects drafts that remove or change keys from the latest published schema. Backend definitions are persisted through `/api/forms`, with draft and publish version lifecycle endpoints.

The builder loads the latest draft or published version from `/api/forms/:key`. Saving an unpersisted definition creates v1; saving edits creates or updates a draft version. Publishing requires an existing draft and passes client and server validation for duplicate keys, invalid rule/LOV references, required metadata, and the 256 KB schema limit. Runtime submission validation enforces required fields and repeater min/max constraints before invoking the submit callback.

Live TSRF pages use `PublishedTsrfForm`, which selects the newest published version returned by `/api/forms/published/tsrf`; drafts are never shown to requestors. Dynamic submissions are projected to the selected version's declared non-notice fields, including nested repeater row fields, so newer bundled defaults do not send unknown fields to an older published schema. If the API is unavailable or no published version exists, the page falls back to the bundled TSRF v1 definition and submits via the legacy TSRF endpoint using the legacy serializer. The default TSRF view is an owner-scoped request register; requestors use New Request to open the guide/intake, then return to the register with their new request selected. The register shows status and responsibility: the linked department head at submission, the creator for returned requests, or configured outgoing workflow roles for other active stages. View loads event history and visible form values. Historical printing uses the pinned, role/stage-filtered schema/data and shows status, responsibility, cut-off state, and readable choice labels.

## Rules and Workflow

Rules must be declarative data evaluated by a shared client/server evaluator. Do not use `eval` or `new Function`. Workflow stages control field visibility and editability, and server-side validation must enforce those permissions for submissions.

The client evaluator supports equality, inequality, membership, existence, visibility, requiredness, and enabled-state actions. The field Properties panel authors these conditional rules. The Workflow & Cut-off panel edits stages, fixed system status categories, role allowlists, transition-required fields/reasons, per-role field access, and the cutoff time/timezone/late policy.

Server submission validation rejects unknown/hidden fields, missing required values, invalid or inactive LOV selections, and invalid repeater rows; it stores code-to-label snapshots and pins submissions to the published version. Workflow transitions use the version's `workflowJson`, enforce allowed roles/reasons/required fields/status categories, and create an actor/comment event. Submission data PATCHes are restricted by current stage field-access maps. Non-reviewer report/detail/event/edit access is scoped to the submission creator; detail responses omit fields explicitly marked hidden for the viewer's role at the current stage and do not return raw JSON storage columns. Cutoff evaluation uses configured `Intl` timezone conversion; late requests are flagged and routed to the exception stage when that policy is selected. `GET /api/forms/:key/submissions/report` returns reportable data only, recursively excluding fields marked PII, with a bounded result limit.

The seeded request includes Fleet Asset versus 3rd Party Trucker selection: Fleet Asset conditionally exposes an active-vehicle lookup; third-party selection exposes a trucker name. Vehicle IDs are validated server-side and plate labels are snapshot for history. `FormPrintView` prints the same versioned schema, including repeater tables and saved LOV/entity label snapshots. Driver entity lookup is not available because the backend has no driver entity/table yet.

Role catalog writes are intentionally disabled: the backend continues to authorize through fixed CASL policies, and the Roles page displays the local catalog read-only until a server-backed policy source is implemented. Production writes require configured Arcjet protection; development/test behavior differs and is covered in `docs/PHASE_1_IMPLEMENTATION_AND_DEMO.md`.

Still pending: requestor returned-edit/resubmit UI, finance/approval stamp fields, end-to-end Activity History linkage for builder/workflow edits, driver entity lookup, and the remaining paper-form fields. Response projection currently omits explicitly hidden fields on submission details; extend tests if field-access semantics expand to other read surfaces.

## Validation

Run `npm run build` and `npm test -- --run` in both project directories. Backend integration tests require the configured PostgreSQL connection. Run `npm run api:spec` whenever the public API contract is promoted to the generated OpenAPI types.
