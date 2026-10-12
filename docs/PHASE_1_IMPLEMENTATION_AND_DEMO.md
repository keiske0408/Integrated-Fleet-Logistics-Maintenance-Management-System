# Security, Reporting Implementation and Local Demo

Status updated 2026-10-12. This document covers the security/API foundation, submission and audit reporting, and a local-only walkthrough. It does not claim full TSRF paper-form parity, tamper-evident audit storage, compliance certification, or production readiness.

## Implemented

- Role catalog reads remain available. Server-side role/permission writes are admin-gated, then return `409` because database role mappings are not the authoritative authorization source. Fixed CASL policies remain authoritative; the Roles page is read-only and explains this limitation.
- Non-reviewer submission reports, detail, events, and data edits are scoped to the submission creator. Existing reviewer/admin permissions retain cross-owner access. Detail responses omit fields explicitly marked `hidden` for the viewer's role/current stage and omit raw JSON storage columns.
- Published field keys cannot be renamed or removed when publishing a later version. The builder disables key editing for published fields while labels remain editable.
- Legacy reference-data mutations require the admin LOV permission.
- Arcjet protects all non-auth API writes, with stricter limits on form and procurement mutations and bot detection on TSRF intake. In production, a missing Arcjet key or policy error returns `503`; denials return `429` or `403`. `NODE_ENV=test` bypasses external Arcjet calls; authentication still has an in-process fallback limiter.
- OpenAPI contracts include role reads, LOV endpoints, and the form lifecycle. `openapi.json` and `src/api/generated-types.ts` are generated from `src/api/openapi.ts`.

## Local Prerequisites

- Node.js and npm installed; PostgreSQL running locally.
- A local PostgreSQL account able to create the `FleetDB` database, or create the database yourself before starting the backend.
- Install dependencies in each project if needed: `npm install`.
- Use only a disposable local database. Never use development header authentication or the demo passwords in a shared or production environment.

## Start the App (Windows PowerShell)

1. Configure the backend in `D:\Fleet\fleet-backend\.env`. Keep this file local and do not commit credentials:

```dotenv
NODE_ENV=development
PORT=5001
DATABASE_URL=postgresql://<local-user>:<local-password>@localhost:5432/FleetDB
ALLOW_DEV_AUTH_HEADERS=true
FRONTEND_ORIGIN=http://localhost:5173
```

`ARCJET_KEY` is optional for local development. When configured, Arcjet runs in dry-run mode. The backend initializes its schema and seed data at startup; you can also run `npm run db:push` from `D:\Fleet\fleet-backend` before `npm run dev`.

2. Configure the frontend in `D:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System\.env.local`:

```dotenv
VITE_ENABLE_DEV_AUTH_HEADERS=true
VITE_API_PROXY_TARGET=http://localhost:5001
```

3. Start the backend in one PowerShell terminal:

```powershell
cd D:\Fleet\fleet-backend
$env:NODE_ENV = 'development'
$env:PORT = '5001'
$env:ALLOW_DEV_AUTH_HEADERS = 'true'
npm run dev
```

4. Start the frontend in another PowerShell terminal:

```powershell
cd D:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System
npm run dev
```

5. Open the Vite URL printed in the terminal (normally `http://localhost:5173`; it may select another port if occupied). Confirm the demo API is up at `http://localhost:5001/api/health`.

## Demo Accounts

These in-memory accounts are available only when Vite is in development mode and `VITE_ENABLE_DEV_AUTH_HEADERS=true`:

| Email                   | Password     | Role                 |
| ----------------------- | ------------ | -------------------- |
| `admin@hulma.com`       | `admin123`   | System Administrator |
| `marco.reyes@hulma.com` | `fleet123`   | Fleet Manager        |
| `sandra.cruz@hulma.com` | `finance123` | Finance Manager      |
| `jose.lim@hulma.com`    | `procure123` | Procurement Officer  |
| `ana.santos@hulma.com`  | `request123` | Department Requester |

The browser sends the selected development role as a request header. This is not a real user session and must never be enabled in production.

## Prepare TSRF Department Approval

A clean database seeds the admin user but does not link that user as a department approver. A department LOV item must have an active Approver/Admin linked before a form submission can be accepted. Run this once after the backend starts; it links the seeded `superadmin@hulma.com` user to the `IT` department, creating that department item if it is missing. The role header is for local development only.

The seeded `OPS` department is active but currently has no `approvalUserId`. Selecting `OPS` will pass form-schema validation but fail the department-approver check until an eligible user is linked to that item. Use `IT` for the walkthrough below or assign an active Approver/Admin to `OPS` in Reference Data first.

```powershell
$api = 'http://localhost:5001/api'
$headers = @{ 'x-user-role' = 'admin'; 'x-user-id' = 'local-demo-admin'; 'x-user-name' = 'Local Demo Admin' }
$users = Invoke-RestMethod -Uri "$api/users" -Headers $headers
$approver = $users | Where-Object { $_.email -eq 'superadmin@hulma.com' } | Select-Object -First 1
if (-not $approver) { throw 'Seeded superadmin user was not found.' }

$departments = Invoke-RestMethod -Uri "$api/lov/lists/DEPARTMENTS/items" -Headers $headers
$department = $departments | Where-Object { $_.code -eq 'IT' } | Select-Object -First 1
if ($department) {
  $body = @{ approvalUserId = $approver.id } | ConvertTo-Json
  Invoke-RestMethod -Method Put -Uri "$api/lov/items/$($department.id)" -Headers $headers -ContentType 'application/json' -Body $body
} else {
  $body = @{ code = 'IT'; label = 'Information Technology'; approvalUserId = $approver.id } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$api/lov/lists/DEPARTMENTS/items" -Headers $headers -ContentType 'application/json' -Body $body
}

$vehicleTypes = Invoke-RestMethod -Uri "$api/lov/lists/VEHICLE_TYPES/items" -Headers $headers
if (-not ($vehicleTypes | Where-Object { $_.code -eq 'VAN' })) {
  $body = @{ code = 'VAN'; label = 'Commuter Van'; attrs = @{ category = 'passenger' } } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri "$api/lov/lists/VEHICLE_TYPES/items" -Headers $headers -ContentType 'application/json' -Body $body
}
```

## Walkthrough

1. Sign in as `admin@hulma.com` and open Form Builder.
2. Save the seeded TSRF definition as a draft and publish it. The dynamic intake uses the newest published version; drafts are not exposed to requestors.
3. Sign out, then sign in as `ana.santos@hulma.com` with `request123`. TSRF opens on the request register.
4. Select **New Request** to open the guide and form. Choose the `IT` department and `VAN` vehicle type, complete the trip details, stops, passengers, and cargo, then submit.
5. The app returns to the register, refreshes it, and selects the new request. Review its status, stage, current responsibility, and event history. The linked department approver is shown by name while endorsement is pending; later stages show the responsible role queue.
6. Select **Prepare print request**, then **Print Request**. The print layout uses the submission's pinned schema, saved labels, status, current responsibility, and fields visible to your role/stage.
7. Sign in as the admin again and open Roles Management. Confirm the role matrix is visible but edit/create/delete controls are disabled. This is intentional until dynamic role policies are implemented.
8. Return a request as an authorized reviewer, then sign in as its owner to edit allowed fields and resubmit. The owner-scoped returned edit/resubmit UI is implemented. Backend tests verify cross-owner denial and field-level permissions.

## Reporting And Audit Walkthrough

1. Open **Reports** as an administrator. Select the form, Manila date range, status, stage, cutoff flag, or exact submission reference. Counts cover every authorized matching record, not just the displayed page.
2. Review the pinned version, historical lookup labels, responsibility, and reportable fields. Select the eye icon to inspect chronological workflow evidence. Report evidence deliberately excludes comments and raw form payloads.
3. Select **Export CSV**. It exports all matching authorized rows up to 10,000; larger results return an error requiring narrower filters. The export records generation time, scope, filters, total and an export audit event. CSV cells are quoted and spreadsheet-formula prefixes are neutralized.
4. Open **Audit History** in Reports and filter persisted events by Manila dates, module, action, actor ID/role, or severity. UI-only local demo actions are excluded. Older events without a record identifier retain their event ID; no historical linkage is invented.
5. As administrator, create/update a Fleet user with the `auditor` role, then provision a local credential or link an Entra identity using the existing authenticated administrator endpoints. Verify using that real account: reports/audit reads succeed; approvals, form editing, user management and raw submission details are denied. There is no seeded auditor password or public auditor signup option.
6. Sign in as a requestor or driver. Reports shows only their own persisted versioned submissions. Organization audit history is denied by the API and hidden in navigation. Approvers, finance, and fleet retain existing cross-owner submission reporting, but cannot read organization audit history without an explicitly assigned auditor identity.

### Reporting Permission Matrix

| Role                       | Submission Reporting            | Organization Audit | Workflow Mutations Through Reports  |
| -------------------------- | ------------------------------- | ------------------ | ----------------------------------- |
| Administrator              | Organization                    | Allowed            | None; Reports is read-only          |
| Auditor                    | Organization, privacy-projected | Allowed            | Denied                              |
| Approver / Finance / Fleet | Existing organization scope     | Denied             | None; use authorized workflow pages |
| Requestor / Driver         | Own submissions                 | Denied             | None                                |
| Procurement                | Denied                          | Denied             | None                                |

### Report Definitions And Limits

- **Source:** persisted `form_submissions`, pinned `form_versions`, workflow events and `activity_logs`. Legacy `tsrf_requests` are not silently merged; maintenance/procurement analytics are outside this delivery.
- **Pending:** statuses `draft`, `in_review`, `approved`, and `in_progress`. Completed/returned/rejected/cancelled are separate status counts. These categories partition matching rows; Late is an overlapping cutoff flag count, not an overdue-service metric or SLA breach.
- **Field policy:** only reportable, non-PII fields visible for the user's current stage/role. Nested repeater fields use the same rules. Saved labels do not reflect later LOV edits. Passenger/contact/signature values must remain correctly classified as PII in published schemas.
- **Time policy:** from/to calendar dates are inclusive Asia/Manila days, queried as UTC half-open intervals. UI timestamps are Manila; CSV timestamps are UTC ISO. Dates filter submission creation time or activity-event time, not completion time.
- **Consistency:** total, status counts and page rows share a repeatable-read database snapshot. Each page or export is a new snapshot, so concurrent workflow changes can change a later result. There is no historical as-of query or immutable export archive.
- **API:** `/api/reports/forms`, `/api/reports/submissions`, `/api/reports/submissions/:id/events`, `/api/reports/activity`, and protected POST exports under `/api/reports/{submissions|activity}/export`. Pages default to 25/max 100; exports are capped at 10,000 with explicit rejection, not truncation.
- **Evidence boundary:** workflow actor/action/time/stages and allowlisted audit references support review. Arbitrary audit metadata, free-text comments and form payloads are not included in report exports. Export context is repeated per data row; an empty CSV has headers only.
- **Operational decisions pending:** business-approved retention duration, periodic auditor access review, database backup/restore, restricted infrastructure access, and any required tamper-evident archival. No automated history deletion was added.

## Tests and Builds

Backend, from `D:\Fleet\fleet-backend`:

```powershell
npm test
npm run build
```

For serial database-backed regression checks (avoids shared-database migration/fixture contention):

```powershell
npx vitest run tests/api.test.ts tests/auth.test.ts tests/form-definition.test.ts --no-file-parallelism
```

Frontend, from `D:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System`:

```powershell
npm test
npm run api:spec
npm run build
```

Run `npm run api:spec` after editing the OpenAPI source; it rewrites `openapi.json` and `src/api/generated-types.ts`. The focused checks used for this slice were `tests/api.test.ts`, `tests/auth.test.ts`, and `tests/formBuilder.test.ts`.

Verification on 2026-10-06: backend 35 passed and 1 environment-conditional Arcjet test skipped; backend build passed. Frontend 28 passed, OpenAPI generation passed, and the Vite production build passed. A separate production-mode probe with `ARCJET_KEY` unset returned 503 as expected.

The current full frontend `npx tsc --noEmit` check reports 11 existing module-shape errors in `src/App.tsx` (`m.default`); the touched `FormBuilderPage.tsx` and `RolesManagementPage.tsx` have no diagnostics. The Vite production build succeeds despite existing chunk-size/dynamic-import warnings.

Reporting verification on 2026-10-12: backend build passes; serial API/auth/form-definition tests pass (49 passed, 1 environment-dependent Arcjet skip). Frontend existing tests pass (49), focused reporting tests pass (9), focused reporting lint and Vite build pass; OpenAPI/types generation passes. Tests exercise 501-record pagination, owner scope, nested PII/hidden projection, saved labels, workflow evidence, date validation/boundaries, formula escaping, auditor write denials and the 10,001-record export rejection. Full frontend TypeScript baseline currently has 16 diagnostics in App lazy imports, form-builder history/runtime, and reference-data typing; the report feature adds none. Run `npx tsc --noEmit` explicitly: Vite build is not a typecheck. The older verification paragraphs above are historical snapshots, not current guarantees.

Final verification on 2026-10-12: frontend full suite passed (58 tests). The full frontend typecheck reported 17 diagnostics outside reporting, compared with the earlier 16-error baseline, following concurrent working-tree changes; those sources were not repaired as part of reporting. New reporting files have no editor diagnostics. Backend serial regression results remain 49 passed/1 skipped and both production builds pass.

Browser checks on 2026-10-12 used a local API and explicitly enabled development headers, with simulated auditor/requestor principals. Verified persisted rows, auditor workflow evidence, requestor empty/export-disabled state, direct audit denial, invalid-date feedback, live CSV response, and 390px mobile layout. The evidence dialog is portaled outside animated containers and traps/restores keyboard focus. These checks do not replace real-auth staging UAT or business acceptance.

## Production Boundary

Before production deployment, remove `ALLOW_DEV_AUTH_HEADERS` and `VITE_ENABLE_DEV_AUTH_HEADERS`, use real Entra/local-session authentication, configure a production `ARCJET_KEY`, and verify protected writes in staging. Development demo credentials are not production accounts. Dynamic database role policies are deliberately disabled; changing the local Role catalog does not grant or revoke server permissions.
