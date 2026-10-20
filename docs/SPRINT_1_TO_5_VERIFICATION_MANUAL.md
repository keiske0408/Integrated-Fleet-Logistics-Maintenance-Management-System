# Fleet & Logistics Management System — Sprints 1 to 5 Verification Manual

This document provides a step-by-step user guide and manual testing runbook to verify that all features delivered in **Sprints 1 through 5** are fully implemented, operational, and persistent in the system.

---

## 1. Quick Startup & Environment Setup

### 1.1 Start Backend Server

Open a terminal in `fleet-backend`:

```powershell
cd d:\Fleet\fleet-backend
npm run dev
```

- **Backend Port:** `http://localhost:5000`
- **Database:** Connects to PostgreSQL (`FleetDB`) and runs migrations automatically on boot.

### 1.2 Start Frontend Application

Open a second terminal in `Integrated-Fleet-Logistics-Maintenance-Management-System`:

```powershell
cd d:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System
npm run dev
```

- **Frontend URL:** `http://localhost:5173`
- **Proxy:** Automatically proxies `/api/*` to `http://localhost:5000`.

### 1.3 Available User Accounts & Passwords

Open your browser to `http://localhost:5173/login`. You can click on any demo account button at the bottom of the login card for 1-click credential auto-fill:

| Role                     | Email                   | Password               | Allowed Landing Area                               |
| :----------------------- | :---------------------- | :--------------------- | :------------------------------------------------- |
| **System Admin**         | `admin@hulma.com`       | `admin123`             | Full System Access, Form Builder, User Management  |
| **Fleet Manager**        | `marco.reyes@hulma.com` | `fleet123`             | Vehicle Registry, Odometer Logging, PMS Tracking   |
| **Finance Manager**      | `sandra.cruz@hulma.com` | `finance123`           | Purchase Requisitions (PR) Approval & Spend Gating |
| **Procurement Officer**  | `jose.lim@hulma.com`    | `procure123`           | Work Orders, Vendor Coordination, PR Linking       |
| **Department Requester** | `ana.santos@hulma.com`  | `request123`           | TSRF Trip Requests, Form Submissions               |
| **Fleet Driver**         | Direct `/driver` URL    | Any authenticated user | In-Cab Quick-Log, Odometer Keypad, Trip Completion |

---

## 2. Sprint-by-Sprint Verification Walkthrough

---

### Sprint 1: Core Backend Persistence & Gating

#### Test Case 1.1: Vehicle Registry Live Persistence & Odometer Logging (`TICKET-101`)

_Objective:_ Verify that vehicle mileage updates save to PostgreSQL and update PMS status across reloads.

1. Log in as **Fleet Manager** (`marco.reyes@hulma.com`).
2. Navigate to **Vehicles** (`/fleet`) on the sidebar.
3. **Search & Filter Controls:**
   - Type in the **Search Bar** to instantly find vehicles by plate, model, or driver.
   - Filter by **Status** (`Active Units`, `PMS Overdue`, `Approaching PMS`, `In Maintenance`).
   - Filter by **Vehicle Type** or sort by Plate, Highest Odometer, or PMS Urgency.
   - Test **Pagination:** change rows per page (`5, 10, 25, 50`) and navigate pages.
4. Locate any active vehicle in the table or card view (e.g., `TEST-7533` or `ABC-1234`).
5. Note the **Current KM** and **PMS Status** (e.g., `Active`).
6. Click the **"Log KM"** / **"KM"** button on the row/card to open the inline odometer editor.
7. Enter an ending mileage value that exceeds the current mileage by 500 KM.
8. Click **"Save Reading"** / **"Save"**:
   - Verify a green success toast appears: _"Mileage updated successfully"_.
   - Verify the row immediately updates with the new KM and PMS interval bar recalculates.
   - If the new KM crossed the 5,000 KM PMS interval, verify the status badge changes to a red **"PMS Due"** / **"Overdue"** badge.
9. **Persistence Check:** Press `F5` / reload the browser.
   - Verify the new mileage and PMS status remain permanently stored.

#### Test Case 1.2: PR Gating & Work Order Unlocking (`TICKET-102`)

_Objective:_ Verify Domain Rule 4 — maintenance repair work orders remain locked until the linked Purchase Requisition is approved by Finance.

1. Navigate to **Procurement & PRs** (`/procurement`).
2. **Search, Filter & Pagination in Section 1 (Purchase Requisitions):**
   - Search by PR number, purpose, department, or approver.
   - Filter by PR State (`Pending Finance`, `Approved`, `Draft`, `Rejected`) or Department.
   - Paginate through requisitions using page navigation buttons (`5, 10, 20` per page).
3. **Search, Filter & Pagination in Section 2 (Maintenance Work Orders):**
   - Search by work order #, vehicle plate, or repair description.
   - Filter by Gatekeeper State (`Locked`, `Unlocked`, `In Maintenance`, `Completed`).
   - Paginate through work orders using page navigation buttons.
4. Find a work order linked to a `pending` PR:
   - Notice the work order action is gated with an amber warning: _"PR Approval Required"_.
5. Switch to or log in as **Finance Manager** (`sandra.cruz@hulma.com`).
6. Click **"Approve Spend"** on that specific PR.
   - Verify the PR status changes from `pending` to `approved`.
7. Look at the linked Work Order in the lower table:
   - Notice the gate is released: the button now shows **"Assert PR Gate"** or **"Send to Shop"**.
8. Click **"Send to Shop"**:
   - Verify the work order transitions to `in_progress`.
9. Reload the browser page to verify the approved spend and unlocked state persist in PostgreSQL.

#### Test Case 1.3: Clean TypeScript Compilation (`TICKET-103`)

_Objective:_ Confirm the dead duplicate `components/` directory is purged and TypeScript compiler reports 0 errors.

1. In the frontend terminal, run:
   ```powershell
   npx tsc --noEmit
   ```
2. Verify command completes with exit status code 0 and zero error messages.

---

### Sprint 2: Performance, Live Analytics & DevOps

#### Test Case 2.1: Real-Time Dashboard KPI Counters (`TICKET-106`)

_Objective:_ Verify dashboard stats aggregate directly from live backend records.

1. Navigate to **Dashboard** (`/`) from the sidebar.
2. Verify the 4 top KPI cards display real counts:
   - **Active Fleet Units** (count of operational vehicles)
   - **PMS Overdue Alerts** (vehicles that have crossed their 5,000 KM threshold)
   - **Pending PR Approvals** (unapproved purchase requisitions awaiting Finance)
   - **Active Trip Assignments** (open TSRF requests)
3. Scroll down to **"Recent System Activity"**:
   - Verify that your actions from Sprint 1 (mileage logged, PR approved) appear in the audit activity log.

#### Test Case 2.2: Database Indexes & Migration Integrity (`TICKET-105`)

_Objective:_ Verify foreign key B-Tree indexes and constraints.

1. Run the backend test suite:
   ```powershell
   cd d:\Fleet\fleet-backend
   npm test
   ```
2. Verify all database integration tests pass (61 passed).

#### Test Case 2.3: CI/CD & Production Dockerfiles (`TICKET-104`)

_Objective:_ Verify container configurations and GitHub Actions CI workflow.

1. Inspect `.github/workflows/ci.yml` — validates `lint`, `tsc`, and `vitest` on every PR.
2. Inspect `Dockerfile` (frontend multi-stage Nginx) and `Dockerfile` (backend Node Alpine).
3. Verify `docker-compose.yml` runs both containers with environment links.

---

### Sprint 3: Mobile Usability & Cutoff Policies

#### Test Case 3.1: Mobile Card Layout for Vehicle Registry (`TICKET-107`)

_Objective:_ Verify responsive touch cards on smartphone screens.

1. Navigate to `/fleet` on desktop.
2. Open Chrome DevTools (`F12`), press `Ctrl+Shift+M` (Device Toolbar), and select **iPhone 14** or set viewport width to `390px` (or any width `< 768px`).
3. Verify the wide horizontal table disappears and is replaced by a vertical touch-friendly card stack.
4. Verify each card shows:
   - Plate number & model header.
   - Assigned driver.
   - Current KM with visual 5,000 KM progress bar.
   - Large touch action buttons: **"Log KM"**, **"PMS"**, **"Repair"**.
5. Type `NONEXISTENT-PLATE` into the search bar:
   - Verify the rich illustrated empty state renders with guidance.

#### Test Case 3.2: Mobile Card Layout for PR Gating (`TICKET-108`)

_Objective:_ Verify responsive touch cards for procurement workflows.

1. While in mobile view (`< 768px`), navigate to `/procurement`.
2. Verify PRs and Work Orders display as action cards with clear spend amounts, purpose descriptions, and approval buttons.
3. Test filtering by an empty category to verify the dedicated empty state.

#### Test Case 3.3: TSRF Tracker Mobile Cards & 4:00 PM Cutoff Alert (`TICKET-109`)

_Objective:_ Verify mobile trip tracker and proactive late-request warnings.

1. In mobile view (`< 768px`), navigate to **Trip Requests** (`/tsrf`).
2. Verify requests render as touch cards with request number, department, purpose, dates, and SLA badges.
3. Click **"New Trip Request"** (or open `/forms/tsrf/submit`).
4. Look at the top of the form:
   - If current time is past **4:00 PM Asia/Manila**, an amber advisory banner appears:
     > _"Daily Cutoff Passed (4:00 PM) — Requests filed after 4:00 PM require Department Head justification before logistics endorsement."_

---

### Sprint 4: Architecture & Code Decomposition

#### Test Case 4.1: Form Builder Modular Subcomponents (`TICKET-111`)

_Objective:_ Verify the decomposed Form Builder operates seamlessly.

1. Log in as **System Admin** (`admin@hulma.com`).
2. Navigate to **Form Builder** (`/forms/builder`).
3. Verify the 3 extracted subcomponents are active and responsive:
   - **Left Sidebar Palette (`FieldPaletteSidebar.tsx`):** Drag/click form components, fuzzy search filter.
   - **Workflow Matrix (`WorkflowStageMatrix.tsx`):** Stage permission table and SVG transition diagram.
   - **Dialog Modals (`FormBuilderModals.tsx`):** Test opening template rename or version history dialog.
4. Verify zero TypeScript errors and fast rendering without stutter.

#### Test Case 4.2: Backend Modular Forms Sub-Routers (`TICKET-110`)

_Objective:_ Verify that partitioning `forms.routes.ts` into sub-routers preserved 100% API compatibility.

1. Run backend automated tests:
   ```powershell
   cd d:\Fleet\fleet-backend
   npm test
   ```
2. Verify all form-definition, form-access, and form-submission tests pass green.

---

### Sprint 5: Driver Mobile Quick-Log Application (PWA)

#### Test Case 5.1: In-Cab Touch Console (`/driver`)

_Objective:_ Verify tactile numeric keypad, steppers, and PMS cycle gauge.

1. Navigate to **Driver Quick-Log** (`/driver`) via the sidebar or URL bar.
2. Under **"Assigned Vehicle"**, select any active vehicle (e.g., `ABC-1234`).
3. Check the **5,000 KM PMS Progress Gauge**:
   - Displays current odometer and visual progress bar toward the next 5,000 KM service.
4. Test the **In-Cab Numeric Keypad**:
   - Click the numbers `0–9` to enter mileage.
   - Click the quick-stepper buttons: `+5`, `+10`, `+25`, `+50`, `+100 KM`.
   - Click **"Backspace"** to remove digits or **"Reset"** to clear back to current vehicle mileage.
5. Click **"Log Odometer"**:
   - Verify success toast and immediate gauge update.

#### Test Case 5.2: Offline Mutation Queueing & Automatic Sync

_Objective:_ Verify that odometer readings and trip completions taken in dead zones queue offline and auto-sync on reconnect.

1. Open Chrome DevTools (`F12`), switch to the **Network** tab, and change throttling from _"No throttling"_ to **"Offline"**.
2. Look at the top status badge on `/driver`:
   - Notice it changes from green `Online` to a pulsing amber **`Offline Mode`** badge with a `WifiOff` icon.
3. In the keypad, enter a new mileage (e.g., +20 KM) and click **"Log Odometer"**:
   - Verify amber toast: _"Offline — Odometer reading queued for background sync"_.
   - Notice the **"Queue (1)"** button indicator updates.
4. Click the **"Queue (1)"** button to open the slide-out inspection drawer:
   - Verify the pending mutation shows the vehicle ID, new KM, and timestamp.
5. In the DevTools **Network** tab, switch back to **"No throttling"** (Online):
   - Notice the status badge immediately turns green **`Online`**.
   - The offline queue engine automatically fires, sending `POST /api/vehicles/:id/mileage`.
   - Verify a green success toast: _"Synced 1 offline actions to server"_.
   - The queue badge returns to `Queue (0)`.

#### Test Case 5.3: PWA Manifest & Service Worker Registration

_Objective:_ Confirm Progressive Web App assets are active in the browser.

1. In DevTools, open the **Application** tab.
2. In the left panel, click **Manifest**:
   - **Name:** `Hulma Fleet Driver Quick-Log`
   - **Display:** `standalone`
   - **Theme color:** `#0f172a`
   - **Icons:** Vector gauge SVG loaded.
3. In the left panel, click **Service Workers**:
   - Verify `sw.js` is registered with status **"Activated and is running"**.

---

## 3. Automated Test Verification Summary

To execute all automated verification checks across the full codebase:

### Frontend Test Suites (83 Tests)

```powershell
cd d:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System
npm test -- --run
```

Expected output:

```
 Test Files  9 passed (9)
      Tests  83 passed (83)
```

### Frontend TypeScript & Lint Checks

```powershell
npx tsc --noEmit
npm run lint
```

Expected output: Exits with 0 errors.

### Backend Test Suites (61 Tests)

```powershell
cd d:\Fleet\fleet-backend
npm test
```

Expected output:

```
 Test Files  5 passed (5)
      Tests  61 passed | 1 skipped (62)
```

---

## 4. Verification Sign-Off Checklist

|    Sprint    | Ticket       | Scope                                         | Verified? | Notes                                    |
| :----------: | :----------- | :-------------------------------------------- | :-------: | :--------------------------------------- |
| **Sprint 1** | `TICKET-101` | Vehicle Mileage Persistence & PMS Status      |    [ ]    | Survives browser page reload             |
| **Sprint 1** | `TICKET-102` | PR Approval Gating & Work Order Unlock        |    [ ]    | Work order blocks until PR approved      |
| **Sprint 1** | `TICKET-103` | Dead Components Purged & 0 `tsc` Errors       |    [ ]    | `npx tsc --noEmit` exits with 0 errors   |
| **Sprint 2** | `TICKET-106` | Live Dashboard KPI Counters & Recent Activity |    [ ]    | Aggregated from live PostgreSQL DB       |
| **Sprint 2** | `TICKET-105` | PostgreSQL B-Tree Indexes & JSONB Migration   |    [ ]    | Verified via backend test suite          |
| **Sprint 2** | `TICKET-104` | GitHub Actions CI & Docker Compose            |    [ ]    | Staging/Production containers ready      |
| **Sprint 3** | `TICKET-107` | Mobile Cards & Empty States for Fleet         |    [ ]    | Tested at viewport width `< 768px`       |
| **Sprint 3** | `TICKET-108` | Mobile Cards & Empty States for PR Gating     |    [ ]    | Dual-mode table/card presentation        |
| **Sprint 3** | `TICKET-109` | TSRF Mobile Cards & 4:00 PM Cutoff Alert      |    [ ]    | Advisory banner renders after 4 PM       |
| **Sprint 4** | `TICKET-110` | Backend Modular Forms Sub-Routers             |    [ ]    | 61 backend unit & integration tests pass |
| **Sprint 4** | `TICKET-111` | Frontend Modular Form Builder Components      |    [ ]    | Palette, Modals, Stage Matrix decoupled  |
| **Sprint 5** | `TICKET-112` | In-Cab Driver Console & Odometer Keypad       |    [ ]    | Available at `/driver`                   |
| **Sprint 5** | `TICKET-112` | Offline Queue & Auto-Sync Engine              |    [ ]    | Tested with DevTools Offline toggle      |
| **Sprint 5** | `TICKET-112` | PWA Manifest & Service Worker (`sw.js`)       |    [ ]    | Verified in Application DevTools panel   |
