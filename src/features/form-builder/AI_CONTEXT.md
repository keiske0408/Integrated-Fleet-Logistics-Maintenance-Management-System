# Form Builder Context

Phase 1 introduces the generic LOV foundation used by future schema-driven forms.

## LOV Binding

The four legacy reference-data collections are represented by the system LOV codes `DEPARTMENTS`, `VEHICLE_TYPES`, `MAINTENANCE_CATEGORIES`, and `VENDORS`. The frontend `LovProvider` currently owns client-side seed state, while `ReferenceDataContext` adapts those items to the legacy page and consumer types. The backend tables and `/api/lov` routes are additive and preserve the legacy tables and routes.

LOV items store a stable code, display label, optional parent id, active/inactive status, and JSON attributes. Attributes are defined per list and can be used later by lookup labels and rules. Deactivation is preferred to deletion so historical submissions can retain their label snapshot.

## Adding Future Field Types

The form-builder field registry should keep each type's default configuration, validation, runtime renderer, serializer, and print renderer together. The builder core should consume the registry rather than branch on individual field types. Field keys become immutable after first publish; labels remain editable.

The current registry includes scalar inputs, LOV lookups, notices, and repeaters. `FormRenderer` supports repeaters with child fields, row limits, and declarative rules. `FormBuilderPage` provides a local design canvas with palette insertion, drag reorder, property editing, preview, and JSON export. Backend definitions are persisted through `/api/forms`, with draft and publish version lifecycle endpoints.

The builder loads the latest draft or published version from `/api/forms/:key`. Saving an unpersisted definition creates v1; saving edits creates or updates a draft version. Publishing requires an existing draft and passes client validation for duplicate scoped keys, invalid LOV references, required metadata, and the 256 KB schema limit. Runtime submission validation enforces required fields and repeater min/max constraints before invoking the submit callback.

## Rules and Workflow

Rules must be declarative data evaluated by a shared client/server evaluator. Do not use `eval` or `new Function`. Workflow stages control field visibility and editability, and server-side validation must enforce those permissions for submissions.

The client evaluator currently supports equality, inequality, membership, existence, visibility, requiredness, and enabled-state actions. Server-side parity and workflow-stage permissions remain the next hardening step.

## Validation

Run `npm run build` and `npm test -- --run` in both project directories. Backend integration tests require the configured PostgreSQL connection. Run `npm run api:spec` whenever the public API contract is promoted to the generated OpenAPI types.
