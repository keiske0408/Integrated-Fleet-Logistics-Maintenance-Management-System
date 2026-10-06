# Phase 1 Implementation and Local Demo

Status checked 2026-10-06. This document covers the implemented security/API foundation and a local-only walkthrough. It does not claim full TSRF paper-form parity or production readiness.

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
PORT=5000
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
$api = 'http://localhost:5000/api'
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
8. To verify cross-owner denial and workflow permissions comprehensively, run the backend API tests below; the returned-edit/resubmit workflow UI is still pending.

## Tests and Builds

Backend, from `D:\Fleet\fleet-backend`:

```powershell
npm test
npm run build
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

## Production Boundary

Before production deployment, remove `ALLOW_DEV_AUTH_HEADERS` and `VITE_ENABLE_DEV_AUTH_HEADERS`, use real Entra/local-session authentication, configure a production `ARCJET_KEY`, and verify protected writes in staging. Development demo credentials are not production accounts. Dynamic database role policies are deliberately disabled; changing the local Role catalog does not grant or revoke server permissions.
