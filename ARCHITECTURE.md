# Frontend Architecture & Developer Guide

## 🏗️ Architecture Overview

The frontend is architected using **Feature-Driven / Domain-Driven Design (DDD)** combined with atomic component separation. This pattern provides high cohesion within domain features, low coupling across modules, and immediate clarity for new developers onboarding to the codebase.

```
src/
├── app/                  # Application root & orchestration
│   ├── App.tsx           # Main application router and state coordinator
│   └── ...
│
├── components/           # Cross-cutting, domain-agnostic UI primitives
│   ├── layout/           # Global shell & layout components
│   │   ├── SidebarLayout.tsx   # Responsive collapsable sidebar & navbar
│   │   └── index.ts
│   └── ui/               # Reusable atomic UI primitives (Shadcn-style)
│       ├── button.tsx, badge.tsx, card.tsx, dialog.tsx
│       ├── input.tsx, label.tsx, select.tsx, separator.tsx, table.tsx, avatar.tsx
│       └── index.ts
│
├── features/             # Self-contained business domain modules
│   ├── activity/         # Global Audit / Maintenance History Log
│   │   ├── ActivityLogContext.tsx  # Centralized activity store & logging hook
│   │   ├── ActivityLogPage.tsx     # Timeline, date grouping, CSV export, filters
│   │   └── index.ts
│   │
│   ├── auth/             # Authentication & User Management
│   │   ├── AuthContext.tsx         # User session, login/logout, dynamic permissions
│   │   ├── LoginPage.tsx           # Entra/local sign-in, verified signup, and dev-only demos
│   │   ├── UserManagementPage.tsx  # User CRUD, role assignment, status toggles
│   │   └── index.ts
│   │
│   ├── dashboard/        # Executive Fleet Hub Overview
│   │   ├── DashboardOverview.tsx   # Fleet KPI cards, active trips, PMS health
│   │   ├── FleetHubDashboard.tsx   # Multi-module tabbed dashboard
│   │   └── index.ts
│   │
│   ├── fleet/            # Vehicle Registry & 5,000 KM PMS Enforcement (Module B)
│   │   ├── VehicleRegistryTable.tsx # Live odometer logging, status badges, PMS alert
│   │   ├── IncidentReportModal.tsx  # Mandatory gating modal for skipped PMS
│   │   └── index.ts
│   │
│   ├── logistics/        # Transportation Service Request - TSRF (Module A)
│   │   ├── TSRFForm.tsx            # Multi-stop routes, manifests, cargo, cutoff check
│   │   ├── TSRFFormExample.tsx     # Hook-form & Zod schema validation
│   │   └── index.ts
│   │
│   ├── maintenance/      # Maintenance Reference Data & Tweak UI
│   │   ├── ReferenceDataContext.tsx # Dropdown store (Depts, Vehicle Types, Categories, Vendors)
│   │   ├── ReferenceDataPage.tsx    # Tweak UI panel, sorting, CSV export, column toggles
│   │   └── index.ts
│   │
│   ├── procurement/      # PR Gating Dashboard & Work Orders (Module C)
│   │   ├── PRGatingDashboard.tsx    # Finance approval locks, release to service
│   │   └── index.ts
│   │
│   ├── roles/            # Dynamic RBAC & Matrix Permissions
│   │   ├── RolesContext.tsx         # Dynamic custom role definitions & permissions
│   │   ├── RolesManagementPage.tsx  # Role CRUD, color badges, interactive matrix
│   │   └── index.ts
│   │
│   └── theme/            # Theme Engine & Customizer
│       ├── ThemeContext.tsx         # Dark/Light mode toggle, persistent custom CSS vars
│       ├── ThemeEditorPage.tsx      # HSL color sliders, 8 presets, Google Fonts, radius
│       └── index.ts
│
├── lib/                  # Shared utility libraries
│   ├── utils.ts          # clsx + tailwind-merge (cn helper)
│   └── logger.ts         # Structured client-side logger
│
├── styles/ or index.css  # Tailwind CSS base and theme variable definitions
└── main.tsx              # React DOM bootstrap entry point
```

Authentication is server-backed: Microsoft Entra identities and Fleet-local credentials resolve to the same internal Fleet user and backend authorization policy. Local signup requires verified email and administrator role approval before account activation. Development demo identities require explicit frontend and backend flags; they are not production or database credentials. See [`docs/HYBRID_AUTH.md`](docs/HYBRID_AUTH.md) for setup, signup, approval, and provisioning details.

---

## 🔑 Key Conventions & Best Practices

### 1. Import Path Aliases (`@/*`)

Always use the clean `@/` path alias instead of deep relative paths (`../../`):

```tsx
// Clean, maintainable imports:
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { useRoles } from '@/features/roles';
import { useTheme } from '@/features/theme';
import { VehicleRegistryTable } from '@/features/fleet';
```

### 2. Feature Slicing

When adding a new capability (e.g. `reports` or `gps-tracking`):

1. Create `src/features/<feature-name>/`.
2. Keep the feature's components, context, and types together.
3. Export public components via an `index.ts` barrel file.
4. Mount the navigation item in `src/components/layout/SidebarLayout.tsx` with its required permission.

### 3. Server-Authoritative Permissions

- Frontend page permissions (e.g., `view:reports`, `view:audit`, `create:vehicle`) are navigation controls, not authorization grants. Fixed backend CASL policies are authoritative; the role catalog is read-only until dynamic server policy enforcement is separately implemented.
- Administrators assign the fixed `auditor` role. It has read-only reporting/audit access, no workflow mutations or raw submission detail access. Finance/approver `read all` grants explicitly exclude global audit history.
- Check access in components with `hasPermission(perm)` from `useAuth()`:

```tsx
const { hasPermission } = useAuth();
{
  hasPermission('create:vehicle') && <Button onClick={handleCreate}>Add Vehicle</Button>;
}
```

### 4. Live Activity Logging

`addLog` below creates a local UI event, not persisted audit evidence. Successful backend mutations use audit middleware/dedicated helpers; versioned workflows retain per-submission events. Reports reads persisted data directly and never merges local events. Form Builder operations already have semantic backend audit records.

When any domain action occurs (vehicle registration, mileage update, role edit, PR approval):

```tsx
const { addLog } = useActivityLog();
addLog({
  action: 'PMS Scheduled',
  module: 'maintenance',
  description: 'Scheduled 5,000 KM PMS for ABC-1234',
  severity: 'info',
  metadata: { vehicleId: 'v-1' },
});
```

### 5. Theme Customization & Mode Switching

- Switching between Light Mode and Dark Mode is managed reactively via `ThemeContext`.
- Switching mode in the Theme Editor (`handleModeChange`) switches the active mode in `ThemeContext` and updates `document.documentElement.classList`, giving instant real-time preview across the app.
- Custom HSL variables and selected fonts are persisted in `localStorage` and automatically injected on application startup.

### 6. Reporting Ownership

- `src/features/reports/ReportsPage.tsx` owns the report workspace; `src/App.tsx` lazy-loads it. The submission register and organization audit tab use generated API types and the shared authenticated `apiFetch` client.
- Backend `src/routes/reports.routes.ts` owns query filters, owner/organization scope, snapshot-consistent counts, bounded pagination, safe workflow evidence and audited CSV exports. Existing form visibility/responsibility functions are reused; pinned reportable/non-PII projection applies before rendering or exporting.
- Reporting response shapes are defined in backend `src/domain/reporting.ts`. OpenAPI generation builds those schemas using the frontend Zod instance, then generates client types. Both project directories are required for `npm run api:spec`; response DTOs are not duplicated manually.
- See [report definitions and audit boundaries](docs/PHASE_1_IMPLEMENTATION_AND_DEMO.md) for scope, permissions, timestamp semantics, KPIs, limitations and operational acceptance.

### 7. Admin Account And Navigation Controls

- User Management has an administrator-only existing-local-password action. The backend auth route validates/hashes changes, revokes sessions/reset links and audits actor/target identifiers. Password fields are transient, confirmation is client-side, and credential hashes never enter user-list responses.
- Role landing-page policy lives in backend `src/domain/role-navigation.ts`; persistence/resolution uses `role_login_redirects` and `src/services/role-navigation.service.ts`. Roles Management edits only this navigation setting, not authorization policies. Only allowlisted role-permitted app paths can be saved.
- Both sign-in providers resolve an effective landing page server-side. AuthContext retains it; LoginPage navigates to `/` after success and App's root route selects the saved destination. Existing authenticated deep links are preserved. Development demo sign-in uses the authenticated current-role resolver rather than hardcoded frontend redirect settings.
- New request/response contracts use backend schema factories and generated client types. See [hybrid authentication guidance](docs/HYBRID_AUTH.md) for endpoints, defaults, password boundaries and migration details.
