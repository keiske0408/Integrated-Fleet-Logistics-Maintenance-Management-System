# Comprehensive Manual Test Script & Feature Verification Runbook

## Integrated Fleet, Logistics & Maintenance Management System

**Document Version:** 1.0  
**Target Audience:** QA Engineers, System Administrators, Fleet Operations, Finance Leads, and Stakeholders  
**Target Environment:** Local Staging / Development / UAT  
**Applicable Milestones:** Sprints 1 through 6 + Enterprise Core Systems

---

## 1. Document Overview & Test Execution Strategy

This comprehensive manual test script provides an end-to-end operational runbook to verify that **every feature, workflow, domain rule, and security constraint** in the Fleet & Logistics Management System functions as specified.

### Execution Tips:

- **Role Switching:** The system enforces strict Role-Based Access Control (RBAC). Use separate browser profiles, Incognito windows, or log out and log back in as instructed for each test case.
- **Data Persistence:** Where indicated, refresh the browser (`F5`) to verify that mutations persist in PostgreSQL and do not simply exist in React component state.
- **Mobile Viewport Testing:** For mobile layout tests, press `F12` in Google Chrome or Microsoft Edge, toggle the Device Toolbar (`Ctrl+Shift+M`), and select **iPhone 14 / 390px width**.

---

## 2. Environment Setup & Pre-Flight Checks

### 2.1 Start PostgreSQL Database

Ensure local PostgreSQL is running and the database `FleetDB` exists. If using Docker:

```powershell
docker-compose up -d
```

### 2.2 Start Backend API Service

Open a PowerShell terminal in `fleet-backend`:

```powershell
cd d:\Fleet\fleet-backend
npm run db:push     # Synchronizes database tables & indexes
npm run db:seed     # Seeds default roles, catalog items, and user accounts
npm run dev         # Launches server at http://localhost:5000 (or configured PORT)
```

- **Health Check Endpoint:** Open browser or run `curl http://localhost:5000/api/health` — should return `{"status":"ok"}`.

### 2.3 Start Frontend Application

Open a second PowerShell terminal in `Integrated-Fleet-Logistics-Maintenance-Management-System`:

```powershell
cd d:\Fleet\Integrated-Fleet-Logistics-Maintenance-Management-System
npm run dev
```

- **Frontend URL:** Navigate to `http://localhost:5173`.
- **API Proxy:** Automatically proxies `/api/*` requests to the backend server.

---

## 3. Master Test Accounts Directory

Use these credentials for testing the various roles throughout the system. On the login page (`/login`), you can click the quick-fill buttons at the bottom of the card during development mode:

| Role Identifier          | Role Label           | Email                       | Password       | Allowed Landing Area              |
| :----------------------- | :------------------- | :-------------------------- | :------------- | :-------------------------------- |
| **system_admin**         | System Administrator | `admin@hulma.com`           | `admin123`     | `/dashboard` (Full System Access) |
| **superadmin**           | Super Administrator  | `superadmin@hulma.com`      | `admin123`     | `/dashboard` (Unrestricted)       |
| **fleet_manager**        | Fleet Manager        | `marco.reyes@hulma.com`     | `fleet123`     | `/fleet` (Vehicles & PMS)         |
| **logistics_officer**    | Logistics Officer    | `roberto.santos@hulma.com`  | `logistics123` | `/tsrf` (Dispatches & TSRF)       |
| **finance_manager**      | Finance Manager      | `sandra.cruz@hulma.com`     | `finance123`   | `/procurement` (PR Approval)      |
| **procurement_officer**  | Procurement Officer  | `jose.lim@hulma.com`        | `procure123`   | `/procurement` (Work Orders)      |
| **department_requester** | Department Requester | `ana.santos@hulma.com`      | `request123`   | `/tsrf` (Intake & Submissions)    |
| **approver**             | Department Approver  | `carlos.approver@hulma.com` | `approve123`   | `/tsrf` (Stage Approvals)         |
| **driver**               | Fleet Driver         | `driver1@hulma.com`         | `driver123`    | `/driver` (In-Cab Quick-Log)      |
| **auditor**              | Organization Auditor | `auditor@hulma.com`         | `audit123`     | `/reports` (Read-Only Audit)      |

---

## Module 1: Authentication, Hybrid Identity & RBAC

### Test Case 1.1: Local Credential Login & Remember Me

- **Objective:** Verify standard authentication with valid local credentials.
- **Preconditions:** Logged out; browser open to `http://localhost:5173/login`.
- **Steps:**
  1. Enter `admin@hulma.com` in Email.
  2. Enter `admin123` in Password.
  3. Check the **"Remember me"** checkbox.
  4. Click **"Sign In"**.
- **Expected Results:**
  - [ ] Successful authentication without errors.
  - [ ] User is redirected to `/dashboard`.
  - [ ] Top bar displays "Admin User" with initials avatar `AU` and "System Administrator" badge.
  - [ ] Local storage contains session token; reloading browser maintains active session.

### Test Case 1.2: Invalid Password & Rate Limiting Defense

- **Objective:** Verify security denial for wrong password and brute-force protection.
- **Preconditions:** Logged out at `/login`.
- **Steps:**
  1. Enter `admin@hulma.com`.
  2. Enter `wrongPassword999`.
  3. Click **"Sign In"**.
- **Expected Results:**
  - [ ] Rejection toast / banner appears: _"Invalid credentials"_ or _"Unauthorized"_.
  - [ ] User remains on `/login` and no session cookie is set.

### Test Case 1.3: Multi-Tab Logout Synchronization

- **Objective:** Verify that signing out from one browser tab immediately terminates the session across all open tabs.
- **Preconditions:** Logged in as `admin@hulma.com` in Tab 1.
- **Steps:**
  1. Open a second tab (Tab 2) to `http://localhost:5173/fleet`. Verify it displays the vehicle table.
  2. In Tab 1, click the **User Menu** (top-right or bottom sidebar) and click **"Sign Out"**.
  3. Switch to Tab 2.
- **Expected Results:**
  - [ ] Tab 1 immediately redirects to `/login`.
  - [ ] Tab 2 receives the session logout broadcast event and automatically redirects to `/login`.
  - [ ] Attempting to navigate directly to `/fleet` without authenticating redirects to `/login`.

### Test Case 1.4: Self-Service Contractor / Driver Signup

- **Objective:** Verify external user registration with department & requested role.
- **Preconditions:** Open `/login`.
- **Steps:**
  1. Click **"Don't have an account? Sign up"**.
  2. Fill in:
     - **Full Name:** `Carlos Contractor`
     - **Email:** `carlos.contractor@partner.hulma.com`
     - **Department:** Select `Fleet Operations` from dropdown.
     - **Requested Role:** Select `Fleet Driver` from dropdown.
     - **Password:** `Contractor2026!`
     - **Confirm Password:** `Contractor2026!`
  3. Click **"Submit Registration"**.
- **Expected Results:**
  - [ ] Success notification: _"Registration request submitted for administrator review"_.
  - [ ] Applicant is NOT automatically logged in (preventing unapproved access).
  - [ ] Request enters the administrative review queue in database.

### Test Case 1.5: Administrator Review Queue & Account Activation

- **Objective:** Verify admin approval of pending signup requests and official role assignment.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`).
- **Steps:**
  1. Navigate to **User Management** (`/users`) on the sidebar.
  2. Click the **"Requests"** or **"Signup Queue"** tab.
  3. Locate `carlos.contractor@partner.hulma.com`.
  4. Select official assigned role: `Fleet Driver`.
  5. Click **"Approve Account"**.
- **Expected Results:**
  - [ ] Success toast: _"User account approved and activated"_.
  - [ ] Row disappears from the Pending Queue and moves to the Approved history.
  - [ ] In the **"Users"** tab, `Carlos Contractor` is now listed as an active user with role `driver`.

### Test Case 1.6: Role-Based Landing Page Redirection

- **Objective:** Verify that each role is automatically routed to its designated home screen.
- **Steps:**
  1. Log in as `driver1@hulma.com` (Driver) -> Verify immediate landing at `/driver`.
  2. Log out. Log in as `sandra.cruz@hulma.com` (Finance) -> Verify immediate landing at `/procurement`.
  3. Log out. Log in as `marco.reyes@hulma.com` (Fleet) -> Verify immediate landing at `/fleet`.
  4. Log out. Log in as `auditor@hulma.com` (Auditor) -> Verify immediate landing at `/reports`.
- **Expected Results:**
  - [ ] Every user lands directly at their assigned operational module.

---

## Module 2: Dashboard Overview & Real-Time Analytics

### Test Case 2.1: Live KPI Counters Aggregation

- **Objective:** Verify the 4 dashboard KPI cards pull live totals from the database.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`) or Fleet Manager (`marco.reyes@hulma.com`). Navigate to `/dashboard`.
- **Steps:**
  1. Check the top summary cards:
     - **Active Fleet Units:** Total operational vehicles currently in service.
     - **PMS Overdue Alerts:** Total vehicles exceeding their 5,000 KM threshold.
     - **Pending PR Approvals:** Total requisitions awaiting Finance action.
     - **Active Trip Assignments:** Total open or dispatched TSRF requests.
- **Expected Results:**
  - [ ] Counters match actual database records (no static mock counts).
  - [ ] Hovering over cards highlights them with interactive micro-animations.

### Test Case 2.2: Quick Action Navigation

- **Objective:** Verify that quick-action shortcut buttons navigate directly to respective workflows.
- **Steps:**
  1. Click **"New Trip Request"** -> Opens `/tsrf` intake form.
  2. Return to Dashboard. Click **"Log Mileage"** -> Opens `/fleet` with odometer focus.
  3. Return to Dashboard. Click **"Review PRs"** -> Opens `/procurement`.
  4. Return to Dashboard. Click **"View Reports"** -> Opens `/reports`.
- **Expected Results:**
  - [ ] All 4 quick action buttons route to the exact designated interfaces.

### Test Case 2.3: Live System Activity Stream

- **Objective:** Verify real-time audit event display with severity badges.
- **Steps:**
  1. Scroll down to the **"Recent System Activity"** section on the Dashboard.
  2. Inspect the latest events.
- **Expected Results:**
  - [ ] Shows recent actions (e.g., mileage logged, PR approved, user created).
  - [ ] Severity badges (Info = Blue, Warning = Amber, Success = Green, Error = Red) render accurately.
  - [ ] Displays relative timestamp (e.g., _"2 minutes ago"_).

---

## Module 3: Fleet & Kilometers Monitoring (Vehicle Registry & PMS)

### Test Case 3.1: Search, Filter, Sort & Pagination

- **Objective:** Verify table management controls across the vehicle inventory.
- **Preconditions:** Log in as Fleet Manager (`marco.reyes@hulma.com`). Navigate to `/fleet`.
- **Steps:**
  1. **Search:** In the search input, type `ABC` or `HiAce`.
     - Verify table immediately filters to matching vehicles.
  2. **Status Filter:** Select `PMS Due` from the status dropdown.
     - Verify only units with computed PMS due appear.
  3. **Vehicle Type Filter:** Select `Truck (6W)` or `Commuter Van`.
     - Verify filter applies correctly.
  4. **Sorting:** Click the **"Current KM"** header to sort descending, then ascending.
  5. **Pagination:** Change page size from `10` to `5`, click **Next Page** (`>`).
- **Expected Results:**
  - [ ] All filter and search operations respond without lag or page reloads.

### Test Case 3.2: Mobile Responsive Card Stack (< 768px Viewport)

- **Objective:** Verify responsive touch-friendly cards on smartphone screens.
- **Steps:**
  1. Open Chrome DevTools (`F12`), toggle Device Toolbar (`Ctrl+Shift+M`), set width to `390px`.
  2. Inspect `/fleet`.
- **Expected Results:**
  - [ ] Horizontal table transforms into an elegant vertical card stack.
  - [ ] Each card presents plate number, model, assigned driver, visual PMS progress bar, and large touch buttons: **"Log KM"**, **"PMS"**, and **"Repair"**.
  - [ ] Enter a nonsense search string like `NONEXISTENT-PLATE-999` -> Verify a rich illustrated empty state renders.

### Test Case 3.3: Inline Odometer Logging & PostgreSQL Persistence

- **Objective:** Verify odometer updates persist to PostgreSQL and trigger recalculation of PMS status.
- **Steps:**
  1. In the vehicle table, find active vehicle `ABC-1234` (Current KM: `4,200`).
  2. Click the **"Log KM"** button on that row.
  3. Enter `4,600` KM (+400 KM).
  4. Click **"Save Reading"**.
  5. Check visual indicator: 4,600 KM is within 500 KM of the 5,000 KM threshold -> Status badge changes from green `Active` to amber **`PMS Approaching`**.
  6. **Hard Refresh Check:** Press `F5` / reload browser.
- **Expected Results:**
  - [ ] Green toast: _"Odometer updated to 4,600 KM"_.
  - [ ] Table row permanently displays `4,600 KM` and `PMS Approaching` after browser reload.

### Test Case 3.4: Backward Mileage Rejection (Domain Validation)

- **Objective:** Verify system prevents entering a lower odometer reading than the current odometer.
- **Steps:**
  1. On vehicle `ABC-1234` (now at `4,600 KM`), click **"Log KM"**.
  2. Enter `3,500` KM.
  3. Click **"Save Reading"**.
- **Expected Results:**
  - [ ] Error message appears: _"New odometer reading cannot be less than current reading (4,600 KM)"_.
  - [ ] Update is blocked and mileage remains `4,600 KM`.

### Test Case 3.5: 5,000 KM PMS Threshold Crossing

- **Objective:** Verify crossing 5,000 KM automatically transitions vehicle to PMS Due.
- **Steps:**
  1. Click **"Log KM"** on `ABC-1234`.
  2. Enter `5,150` KM.
  3. Click **"Save Reading"**.
- **Expected Results:**
  - [ ] Status badge immediately switches to red **`PMS Due`** / **`Overdue`**.
  - [ ] Visual progress bar fills to 100% with red alert styling.

### Test Case 3.6: Scheduled PMS Service Order Dispatch

- **Objective:** Verify scheduling standard 5,000 KM preventative maintenance.
- **Steps:**
  1. Click the **"PMS"** action button on `ABC-1234`.
  2. In the modal, review the suggested 5,000 KM service checklist (engine oil, oil filter, brake check).
  3. Click **"Dispatch Service Order"**.
- **Expected Results:**
  - [ ] Success toast: _"PMS Service Order drafted for ABC-1234"_.
  - [ ] An entry is logged to the PMS service order queue.

### Test Case 3.7: Overdue PMS Repair Gating & Incident Report Requirement

- **Objective:** Verify Domain Rule 3 — requesting a repair on an overdue PMS vehicle is gated behind a mandatory Incident Report.
- **Steps:**
  1. On vehicle `XYZ-9876` (which has status `PMS Due` or overdue mileage), click **"Repair"**.
  2. Observe the system behavior.
- **Expected Results:**
  - [ ] System blocks direct work order creation and automatically opens the **Incident Report Modal**.
  - [ ] Warning text displays: _"Vehicle has overdue PMS. An incident report is required before repair authorization can proceed."_
  - [ ] Form requires: **Reported By** (`Roberto Santos`), **Incident / Failure Reason** (`Brake caliper locked up due to deferred pad renewal`).
  - [ ] Click **"Submit Incident Report & Authorize Repair"**.
  - [ ] Success toast: _"Incident Report filed. Repair Work Order WO-2026-XXXX created."_

---

## Module 4: In-Cab Driver Quick-Log PWA (`/driver`)

### Test Case 4.1: In-Cab Touch Console Layout & PMS Progress Gauge

- **Objective:** Verify tactile smartphone UI designed for fleet drivers in vehicle cabs.
- **Preconditions:** Open `http://localhost:5173/driver`. (Can test on desktop or mobile viewport).
- **Steps:**
  1. In the **"Assigned Vehicle"** dropdown, select `ABC-1234`.
  2. Observe the circular/linear **5,000 KM PMS Progress Gauge**:
     - Shows current vehicle mileage and distance remaining until next service.
  3. Check the **Touch Keypad**:
     - Large oversized buttons for numbers `0` through `9`.
     - Quick stepper increment buttons: `+5`, `+10`, `+25`, `+50`, `+100 KM`.
     - Action buttons: `Backspace` (⌫), `Reset`, `Log Odometer`.
- **Expected Results:**
  - [ ] Keypad numbers type directly into the odometer input display.
  - [ ] Stepper buttons instantly add their increment to the current odometer.
  - [ ] Reset restores the value to the vehicle's last recorded odometer reading.

### Test Case 4.2: Network Offline Mutation Queueing

- **Objective:** Verify driver can record odometer readings in underground parking or remote dead zones without internet connectivity.
- **Steps:**
  1. Open Chrome DevTools (`F12`), navigate to the **Network** tab.
  2. In the Throttling dropdown, change from _"No throttling"_ to **"Offline"**.
  3. Look at the top status indicator on `/driver`:
     - Notice it switches from green `Online` to a pulsing amber **`Offline Mode`** badge with a `WifiOff` icon.
  4. On the keypad, click `+25` KM.
  5. Click **"Log Odometer"**.
- **Expected Results:**
  - [ ] Amber notification toast: _"Offline — Odometer reading queued for background sync"_.
  - [ ] App does NOT crash, error out, or freeze.
  - [ ] Top action bar displays **"Queue (1)"** button.
  - [ ] Click **"Queue (1)"** to open the slide-out inspection drawer:
    - Lists the pending mutation: Vehicle `ABC-1234`, Target KM, and offline timestamp.

### Test Case 4.3: Background Auto-Drain & Sync on Network Restoration

- **Objective:** Verify queued mutations automatically submit when connectivity returns.
- **Steps:**
  1. In Chrome DevTools **Network** tab, switch throttling back to **"No throttling"** (Online).
  2. Observe the app without clicking any buttons.
- **Expected Results:**
  - [ ] Status badge immediately turns green **`Online`**.
  - [ ] Offline sync engine fires automatically in the background.
  - [ ] Green success toast: _"Synced 1 offline actions to server"_.
  - [ ] Queue badge returns to `Queue (0)`.
  - [ ] Gauge updates with the synchronized odometer reading.

### Test Case 4.4: Progressive Web App (PWA) Manifest & Service Worker

- **Objective:** Verify PWA readiness for installation on driver mobile devices.
- **Steps:**
  1. In DevTools, open the **Application** tab.
  2. Click **Manifest** in the left sidebar:
     - Verify App Name: `Hulma Fleet Driver Quick-Log`.
     - Verify Display Mode: `standalone`.
     - Verify Theme Color: `#0f172a`.
  3. Click **Service Workers**:
     - Verify `sw.js` is active with status _"Activated and is running"_.
- **Expected Results:**
  - [ ] PWA manifests and Service Worker are verified active.

---

## Module 5: Fleet TCO & Cost-per-Kilometer (CPK) Analytics (`/analytics`)

### Test Case 5.1: Financial KPI Cards & Category Benchmarks

- **Objective:** Verify aggregate maintenance cost, distance, and unit efficiency metrics.
- **Preconditions:** Log in as Fleet Manager (`marco.reyes@hulma.com`) or Finance Manager (`sandra.cruz@hulma.com`). Navigate to `/analytics`.
- **Steps:**
  1. Inspect the 4 top KPI cards:
     - **Fleet Avg. Cost / KM:** Aggregated rate (e.g., `₱4.82/km`).
     - **Total Fleet Spend:** Cumulative approved PRs and completed PMS packages (e.g., `₱184,500`).
     - **Total Tracked Distance:** Sum of all recorded vehicle kilometers.
     - **High Cost Outliers:** Count of units exceeding 135% of the benchmark.
  2. Review visual charts:
     - **CPK by Category:** Horizontal comparison bars (Vans vs 4W vs 6W vs 10W trucks).
     - **Monthly Spend Trend:** Historical 6-month bar chart.
     - **Spend by Department:** Logistics vs Warehouse vs Field Operations breakdown.
- **Expected Results:**
  - [ ] All charts render cleanly with formatted currency (`₱`) and distance (`km`).

### Test Case 5.2: Outlier Watchlist & Vehicle Drilldown Modal

- **Objective:** Verify outlier detection and drilldown into individual repair expenditures.
- **Steps:**
  1. Check the **"High-Cost Vehicle Watchlist"** banner for highlighted units.
  2. Find any vehicle row in the TCO register (e.g., `XYZ-9876`).
  3. Click the **"Inspect"** / **"Inspect Repair History"** button.
- **Expected Results:**
  - [ ] Drilldown modal opens with vehicle summary: Plate, Category, Lifetime Spend, Cost/KM.
  - [ ] Itemized table lists all associated Repair Work Orders with linked PR numbers, spend amounts, and completion dates.
  - [ ] Itemized table lists all completed and scheduled PMS milestones.

### Test Case 5.3: Multi-Criteria Filter & Audit-Ready CSV Export

- **Objective:** Verify table filtering and spreadsheet export with formula injection prevention.
- **Steps:**
  1. In the TCO register search box, type `Elf` or `Toyota`.
  2. Filter by Efficiency Rating: select `Critical Outlier` or `Optimal`.
  3. Sort by: `Highest Cost / KM First`.
  4. In the top action bar, click **"Export CSV"**.
  5. Open the downloaded file `fleet_tco_report_YYYY-MM-DD.csv` in Excel or a text editor.
- **Expected Results:**
  - [ ] 14-column spreadsheet exports containing Plate, Category, Current KM, Spend, CPK, Status, and Drivers.
  - [ ] **Formula Injection Defense:** Any cells beginning with `=`, `+`, `-`, or `@` are safely quoted/escaped to prevent CSV formula execution vulnerabilities.

---

## Module 6: Trip Service Request Form (TSRF) Logistics & Workflow

### Test Case 6.1: Electronic TSRF Intake & Multi-Stop Waypoints

- **Objective:** Verify electronic trip request creation with multi-stop itinerary planner.
- **Preconditions:** Log in as Department Requester (`ana.santos@hulma.com`). Navigate to `/tsrf`.
- **Steps:**
  1. Click **"New Trip Request"**.
  2. Enter Request Details:
     - **Project / Purpose:** `Bataan Branch Equipment Retrieval`
     - **Department:** Select `Human Resources` (or `IT Support`).
     - **Origin:** `MMG Complex Main Gate`
     - **Destination:** `Balanga Distribution Center`
     - **Departure Date:** Select tomorrow's date.
     - **Call Time:** `07:30 AM`
     - **Vehicle Type Required:** `Commuter Van`
  3. **Multi-Stop Route Planner:**
     - Stop 1: `MMG Complex` (Loading, 15 min waiting).
     - Click **"+ Add Stop"**.
     - Stop 2: `Pampanga Service Plaza` (Rest / Fuel, 20 min waiting).
     - Click **"+ Add Stop"**.
     - Stop 3: `Balanga Distribution Center` (Unloading, 45 min waiting).
  4. Add Passenger: Name `Ana Santos`, Dept `HR`.
  5. Add Cargo: Description `2x Sealed Server Towers`, Qty `2`, check **"Fragile"**.
  6. Click **"Submit Trip Request"**.
- **Expected Results:**
  - [ ] Success toast: _"TSRF created for Bataan Branch Equipment Retrieval with 3 stops"_.
  - [ ] Request enters `submitted` status and displays on the TSRF register.

### Test Case 6.2: 4:00 PM Daily Cutoff Advisory Warning

- **Objective:** Verify Domain Rule 5 — requests filed after 4:00 PM Asia/Manila display a proactive late-filing advisory banner.
- **Steps:**
  1. On the TSRF Intake form, check the top advisory alert.
  2. If the current system time in Manila is after **16:00 (4:00 PM)**:
- **Expected Results:**
  - [ ] Amber alert banner renders:
    > _"Daily Cutoff Passed (4:00 PM) — Requests filed after 4:00 PM require Department Head justification before logistics endorsement."_
  - [ ] The submission is persisted with `is_flagged_after_cutoff: true` in the database.

### Test Case 6.3: Department Approver Routing & Stage Endorsement

- **Objective:** Verify request endorsement by the linked Department Approver.
- **Preconditions:** Log out. Log in as Department Approver (`carlos.approver@hulma.com` or `superadmin@hulma.com`).
- **Steps:**
  1. Navigate to `/tsrf`.
  2. Select the submitted trip request.
  3. Review trip itinerary, stops, passengers, and cargo.
  4. Click **"Endorse Request"** / **"Approve"**.
- **Expected Results:**
  - [ ] Status advances from `submitted` to `approved` (Department Endorsed).
  - [ ] Immutable workflow event is appended with approver's name and timestamp.

### Test Case 6.4: Fleet Asset Allocation (Vehicle & Driver Lookup)

- **Objective:** Verify logistics dispatcher assigns an active vehicle and driver from live catalogs.
- **Preconditions:** Log in as Logistics Officer (`roberto.santos@hulma.com`). Navigate to `/tsrf`.
- **Steps:**
  1. Open the approved trip request.
  2. Under **"Fleet Allocation"**, select **"Fleet Asset"**:
     - **Vehicle Lookup:** Select `ABC-1234 (Toyota HiAce Commuter Van)`.
     - **Driver Lookup:** Select `Juan Dela Cruz` (active driver user).
  3. (Alternative: Switch to **"Third-Party Trucker"** -> Enter `Transportify`, Waybill `#TR-88192`).
  4. Click **"Dispatch Trip"**.
- **Expected Results:**
  - [ ] Status advances to `in_progress` / `dispatched`.
  - [ ] Vehicle and driver names are snapshotted onto the request record.

### Test Case 6.5: Returned TSRF Owner Revision & Resubmission

- **Objective:** Verify owner-scoped return and resubmission workflow.
- **Steps:**
  1. While viewing a request as Logistics Officer, click **"Return for Revision"**.
  2. Enter reason: _"Please add estimated weight for server towers"_. Click **"Confirm Return"**.
  3. Log out. Log in as the request owner (`ana.santos@hulma.com`).
  4. Open `/tsrf` -> Request shows badge **`Returned for Revision`**.
  5. Click **"Edit Request"**:
     - Modify cargo weight: Enter `45 kg`.
     - Notice non-editable administrative fields remain locked.
  6. Click **"Resubmit Request"**.
- **Expected Results:**
  - [ ] Success toast: _"Trip request resubmitted"_.
  - [ ] Request returns to the review queue with revision history preserved.

### Test Case 6.6: Digital Stamp Projection & Print Layout

- **Objective:** Verify Finance Verification and Department Approval signature stamps render on print output.
- **Steps:**
  1. On the approved trip request detail view, click **"Prepare print request"** -> Click **"Print Request"**.
  2. Review the printable document layout.
- **Expected Results:**
  - [ ] Form displays versioned schema, itinerary table, and passenger manifest.
  - [ ] Bottom stamp blocks display:
    - **Department Approval Stamp:** Signed by Department Approver with exact date/time stamp.
    - **Finance Verification Stamp:** Projected directly from immutable workflow events.

---

## Module 7: PR Gatekeeper & Procurement Spend Control (`/procurement`)

### Test Case 7.1: Purchase Requisition Creation

- **Objective:** Verify submitting a new Purchase Requisition for fleet parts/repairs.
- **Preconditions:** Log in as Procurement Officer (`jose.lim@hulma.com`) or Fleet Manager (`marco.reyes@hulma.com`). Navigate to `/procurement`.
- **Steps:**
  1. In the upper section (Purchase Requisitions), click **"+ New Requisition"**.
  2. Fill in:
     - **Department:** `Fleet Operations`
     - **Purpose:** `Replacement of hydraulic clutch master cylinder for XYZ-9876`
     - **Estimated Amount (PHP):** `14500`
  3. Click **"Submit Requisition"**.
- **Expected Results:**
  - [ ] Success toast: _"PR PR-2026-XXXX created"_.
  - [ ] New PR appears in the table with status `pending` (amber badge).

### Test Case 7.2: Domain Rule 4 — Maintenance Work Order Gating Verification

- **Objective:** Verify that repair work orders remain locked until the linked Purchase Requisition is approved by Finance.
- **Steps:**
  1. Scroll down to Section 2: **Maintenance Repair Work Orders**.
  2. Find work order `WO-2026-0041` linked to pending requisition `PR-2026-1042`.
  3. Inspect the action button on that work order row.
- **Expected Results:**
  - [ ] Action button is locked with amber warning: **`PR Approval Required`** (or Gate Locked).
  - [ ] Clicking the locked button displays: _"Blocked: Repair work order cannot proceed until linked PR is approved by Finance."_
  - [ ] Neither dispatch nor parts fulfillment can proceed.

### Test Case 7.3: Finance Manager Approval Action ("Approve Spend")

- **Objective:** Verify Finance approval releases the spend gate.
- **Preconditions:** Log out. Log in as Finance Manager (`sandra.cruz@hulma.com`).
- **Steps:**
  1. Navigate to `/procurement`.
  2. Locate the pending PR in the upper table.
  3. Click **"Approve Spend"**.
  4. Confirm approval in the prompt.
- **Expected Results:**
  - [ ] Green toast: _"PR approved!"_.
  - [ ] Requisition status changes from `pending` to green `approved`.
  - [ ] Approved By column displays: `Sandra Cruz (Finance)`.

### Test Case 7.4: Gate Release & Maintenance Fulfillment Lifecycle

- **Objective:** Verify unlocking work order, sending to shop, and restoring vehicle operational status.
- **Preconditions:** Logged in as Procurement Officer (`jose.lim@hulma.com`) or Fleet Manager (`marco.reyes@hulma.com`).
- **Steps:**
  1. Look at the linked Work Order in the lower table:
     - The gate is now released! The button now displays **"Assert PR Gate"** or **"Send to Shop"**.
  2. Click **"Send to Shop"**:
     - Work order status moves to `in_maintenance`.
  3. Click **"Mark Completed"**:
     - Work order status moves to `work_completed`.
  4. Click **"Release to Service"** / **"Vehicle Operational"**:
     - Work order status moves to `vehicle_operational`.
  5. Navigate to **Fleet** (`/fleet`):
     - Inspect the associated vehicle.
- **Expected Results:**
  - [ ] Vehicle status is automatically restored to green `Active` / `Operational`.
  - [ ] Audit log records vehicle restoration after maintenance.

---

## Module 8: Dynamic Form Builder Engine (`/form-builder`)

### Test Case 8.1: Field Palette Sidebar & Property Inspector

- **Objective:** Verify form layout editing with drag/click field components.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/form-builder`.
- **Steps:**
  1. Inspect the left sidebar palette:
     - Components: Text, Number, Dropdown/Select, Checkbox, Date/Time, Entity Lookup (Vehicle/Driver), Multi-stop Repeater.
  2. Search for `Driver` in the palette fuzzy search.
  3. Click on any field on the canvas to open the **Property Inspector**:
     - Edit Field Label: Change label and verify instant canvas update.
     - Toggle **Required**: Verify asterisk appears.
     - Toggle **Read-Only**: Verify field disables in preview.
- **Expected Results:**
  - [ ] Field builder operates smoothly with instant reactive updates.

### Test Case 8.2: Workflow Stage Matrix & Transition Rules Designer

- **Objective:** Verify stage permissions matrix and role-based transitions.
- **Steps:**
  1. In Form Builder, click the **"Workflow Matrix"** tab.
  2. Inspect the matrix grid:
     - Rows: Stages (`Draft`, `Submitted`, `Department Endorsement`, `Dispatched`, `Completed`).
     - Columns: Roles (`Requester`, `Approver`, `Logistics`, `Fleet`).
  3. Verify permission toggles: `Hidden`, `Read-Only`, `Editable`.
- **Expected Results:**
  - [ ] Grid accurately reflects stage access rules.

### Test Case 8.3: Form Preview by Role and Stage

- **Objective:** Verify real-time simulation of form appearance for different roles across stages.
- **Steps:**
  1. Click **"Preview Form"**.
  2. In the preview toolbar:
     - Select Role: `Department Requester` | Stage: `Draft` -> Notice all fields editable.
     - Select Role: `Department Requester` | Stage: `Dispatched` -> Notice fields are Read-Only; odometer hidden.
     - Select Role: `Logistics Officer` | Stage: `Department Endorsement` -> Notice allocation fields available.
- **Expected Results:**
  - [ ] Form preview dynamically adapts field states based on selected role and stage.

### Test Case 8.4: Form Versioning, Comparison & Publication

- **Objective:** Verify creating a draft, diffing versions, and publishing.
- **Steps:**
  1. Make a cosmetic label adjustment on the canvas.
  2. Click **"Save Draft"**.
  3. Click **"Version Diff"**:
     - Verify side-by-side comparison shows the exact modified field properties.
  4. Click **"Publish Form"**.
- **Expected Results:**
  - [ ] Publication confirmation dialog appears.b
  - [ ] Success toast: _"Form published successfully"_.
  - [ ] New submissions will use the updated published version; older submissions remain pinned to their historical version.

---

## Module 9: Reports & Operational Audit Extraction (`/reports`)

### Test Case 9.1: Form Submissions Register with Manila Date Boundaries

- **Objective:** Verify server-side paginated report of version-pinned form submissions.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/reports`.
- **Steps:**
  1. Select Form: `Trip Service Request Form (TSRF)`.
  2. Select Date Range: Pick from the first of the current month to today (Asia/Manila time).
  3. Filter by Status: Select `All` or `Approved`.
  4. Inspect table rows.
- **Expected Results:**
  - [ ] Displays Reference Number, Version, Department, Requester, Dates, and Reportable Fields.
  - [ ] Total record count accurately reflects authorized matches.

### Test Case 9.2: Privacy Projection (PII & Confidential Notes Masking)

- **Objective:** Verify report excludes sensitive employee PII and private reviewer notes.
- **Steps:**
  1. Inspect the columns of the Submissions Report.
- **Expected Results:**
  - [ ] Individual passenger contact phone numbers and personal signatures are masked/excluded from the general export view.
  - [ ] Only authorized reportable columns are displayed.

### Test Case 9.3: Chronological Workflow Evidence Inspection Modal

- **Objective:** Verify inspection of step-by-step workflow audit trail without exposing raw JSON payloads.
- **Steps:**
  1. On any submission row, click the **Eye icon** (`👁`).
  2. Modal opens: **Workflow Evidence**.
- **Expected Results:**
  - [ ] Displays chronological sequence of events: Created -> Submitted -> Endorsed -> Dispatched.
  - [ ] Each step displays: Actor Name, Role, Timestamp, Action Taken, and Transition Reason.
  - [ ] Free-form internal JSON payloads are strictly hidden.

### Test Case 9.4: 10,000-Row CSV Export with Formula Injection Escaping

- **Objective:** Verify spreadsheet export with security protections against formula injection.
- **Steps:**
  1. On `/reports`, click **"Export CSV"**.
  2. Browser downloads `submissions_report_YYYY-MM-DD.csv`.
  3. Open file in Excel or VS Code.
- **Expected Results:**
  - [ ] All authorized columns are correctly structured and formatted.
  - [ ] If search matches exceed 10,000 rows, API safely returns an error requiring narrower filter criteria rather than crashing.
  - [ ] Formula injection prefixes (`=`, `+`, `-`, `@`) are neutralized.

### Test Case 9.5: Organization Auditor Role (`auditor@hulma.com`) Read-Only Verification

- **Objective:** Verify that the dedicated Auditor role has read-only access to reports and audit trails, with all mutation and administrative functions blocked.
- **Preconditions:** Log out. Log in as `auditor@hulma.com` (Password: `audit123`).
- **Steps:**
  1. Verify automatic landing at `/reports`.
  2. Verify Submissions Report loads successfully.
  3. Click the **"Activity History"** tab on `/reports` -> Verify organization activity logs load.
  4. Check sidebar navigation:
     - Notice administrative pages (**User Management**, **Roles Management**, **Form Builder**, **Theme Editor**) are NOT visible.
  5. Attempt to navigate directly to `http://localhost:5173/users` or `/form-builder`.
- **Expected Results:**
  - [ ] Auditor can freely inspect reports and export CSVs.
  - [ ] Direct navigation to `/users` or `/form-builder` renders **"Access Restricted (403)"**.
  - [ ] Zero action buttons for creating, approving, or mutating data exist.

---

## Module 10: Reference Data & Catalogs / LOVs (`/reference-data`)

### Test Case 10.1: Department Catalog & Linking Approver User ID

- **Objective:** Verify that each department item links to an active Approver/Admin for TSRF routing.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/reference-data`.
- **Steps:**
  1. Select Catalog: `DEPARTMENTS`.
  2. Locate department `Information Technology` (Code: `IT`).
  3. Click **"Edit"** (Pencil icon).
  4. In the **"Linked Approver"** dropdown, select `Carlos Villanueva (Approver)` or `Super Administrator`.
  5. Click **"Save Changes"**.
- **Expected Results:**
  - [ ] Success toast: _"Department catalog item updated"_.
  - [ ] Submitting a TSRF under `IT` will now correctly route to this designated approver.

### Test Case 10.2: Vehicle Types Catalog

- **Objective:** Verify managing vehicle classifications.
- **Steps:**
  1. Select Catalog: `VEHICLE_TYPES`.
  2. Verify default entries: `Commuter Van`, `Truck (4W)`, `Truck (6W Forward)`, `Truck (10W Heavy Carrier)`.
  3. Click **"+ Add Item"**:
     - **Code:** `MOTORCYCLE`
     - **Label:** `Fleet Dispatch Motorcycle (2W)`
  4. Click **"Save"**.
- **Expected Results:**
  - [ ] Item is saved and becomes immediately selectable in vehicle creation and TSRF vehicle type dropdowns.

### Test Case 10.3: Expense Categories & 3PL Vendors

- **Objective:** Verify reference catalogs for procurement and tolls.
- **Steps:**
  1. Select Catalog: `EXPENSE_CATEGORIES` -> Verify items (PMS, Emergency Repairs, Tires, Tolls).
  2. Select Catalog: `VENDORS` -> Verify items (Autosweep, EasyTrip, Transportify, Shell, Petron).
- **Expected Results:**
  - [ ] Catalogs load with complete records.

---

## Module 11: User Management & Hybrid Account Administration (`/users`)

### Test Case 11.1: User Directory & Filters

- **Objective:** Verify searching and filtering registered users.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/users`.
- **Steps:**
  1. Search for `Marco` -> Row for `Marco Reyes` appears.
  2. Filter by Role: Select `Finance Manager` -> Row for `Sandra Cruz` appears.
  3. Filter by Status: Toggle `Active` vs `All`.
- **Expected Results:**
  - [ ] Table filters instantly.

### Test Case 11.2: Administrator Local Password Change & Immediate Session Invalidation

- **Objective:** Verify administrator can securely change a user's password and terminate their active sessions.
- **Steps:**
  1. In the users table, locate `driver1@hulma.com`.
  2. Click the **Key icon** (`🔑`) in the action column.
  3. Modal opens: **"Change User Password"**.
  4. Enter New Password: `NewDriverPass2026!` (must be at least 12 characters).
  5. Confirm Password: `NewDriverPass2026!`.
  6. Click **"Update Password & Invalidate Sessions"**.
- **Expected Results:**
  - [ ] Green toast: _"Password updated successfully. Existing sessions invalidated."_
  - [ ] If Driver 1 was logged in on another device/tab, their session is immediately terminated.
  - [ ] Driver 1 must now log in using `NewDriverPass2026!`; the old password `driver123` is rejected.

---

## Module 12: Roles & Permissions Matrix (`/roles`)

### Test Case 12.1: CASL Permission Matrix Inspection (Read-Only Policy)

- **Objective:** Verify system displays the authoritative permission grants while enforcing server-side policy immutability.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/roles`.
- **Steps:**
  1. Inspect the matrix: Roles across top headers, Permissions listed down the rows.
  2. Verify that permission checkboxes are visible for audit inspection but editing controls are disabled with an informational alert explaining that CASL policies are managed via server configuration.
- **Expected Results:**
  - [ ] Matrix clearly displays effective permissions for all 10 system roles.

### Test Case 12.2: Post-Login Landing Page Assignment per Role

- **Objective:** Verify administrator can configure where each role lands upon login.
- **Steps:**
  1. Scroll down to the **"Post-Login Landing Pages"** card.
  2. Locate role `Fleet Driver`.
  3. Change the dropdown selection from `/fleet` to `/driver`.
  4. Click the **Save icon** (`💾`) on that row.
- **Expected Results:**
  - [ ] Success toast: _"Landing page for Fleet Driver updated to /driver"_.
  - [ ] Next time any user with role `driver` logs in, they are automatically routed to `/driver`.

---

## Module 13: System Activity History & Audit Trail (`/history`)

### Test Case 13.1: Real-Time Audit Log Verification

- **Objective:** Verify immutable audit logging of operations performed across the entire system.
- **Preconditions:** Log in as System Admin (`admin@hulma.com`). Navigate to `/history`.
- **Steps:**
  1. Check the activity log rows.
  2. Look for entries generated from previous test steps:
     - _Vehicle odometer update_ (Module: `Fleet`)
     - _Purchase Requisition approved_ (Module: `Purchase Requisition`)
     - _Work order created_ (Module: `Work Order`)
     - _Password updated_ (Module: `Auth`)
- **Expected Results:**
  - [ ] Every entry logs Actor Name, Module, Action, Subject, Description, Severity, and Timestamp.
  - [ ] Passwords and secrets are NEVER recorded in audit metadata.

### Test Case 13.2: Multi-Filter Search

- **Objective:** Verify filtering audit entries by Module, Severity, Actor, and Date Range.
- **Steps:**
  1. Filter by Module: Select `Fleet`.
  2. Filter by Severity: Select `warning` or `success`.
  3. Filter by Actor: Type `Sandra Cruz`.
- **Expected Results:**
  - [ ] Table filters precisely to matching audit events.

---

## Module 14: Theme Editor & UI Customization (`/theme-editor`)

### Test Case 14.1: Dark Mode, Light Mode & High-Contrast Mode

- **Objective:** Verify accessibility and visual aesthetics across color modes.
- **Preconditions:** Navigate to `/theme-editor`.
- **Steps:**
  1. Click **"Light Mode"** -> Verify whole interface smoothly transitions to high-clarity daylight theme.
  2. Click **"Dark Mode"** -> Verify interface transitions to sleek dark glassmorphism theme (`#0f172a`).
  3. Click **"High Contrast"** -> Verify enhanced borders and contrasting text for maximum legibility.
- **Expected Results:**
  - [ ] All components, tables, sidebars, and cards adapt instantly without visual defects or unreadable text.

### Test Case 14.2: Accent Color Customization & Persistence

- **Objective:** Verify custom brand accent colors apply throughout the app.
- **Steps:**
  1. Select Accent Color: **Emerald** (or **Indigo**, **Violet**, **Amber**).
  2. Observe primary action buttons, active tab indicators, and progress bars.
  3. Press `F5` / reload the browser.
- **Expected Results:**
  - [ ] Accent color updates across all buttons, badges, and focus rings.
  - [ ] Selected theme and accent color persist across browser reloads via local storage.

---

## Module 15: Automated Codebase Health & Regression Sanity Suite

### Test Case 15.1: Frontend Vitest Automated Test Suite

- **Steps:**
  Open terminal in `Integrated-Fleet-Logistics-Maintenance-Management-System`:
  ```powershell
  npm test -- --run
  ```
- **Expected Results:**
  - [ ] All frontend test suites execute and pass cleanly (91+ passing tests).

### Test Case 15.2: Frontend TypeScript & Linter Verification

- **Steps:**
  In `Integrated-Fleet-Logistics-Maintenance-Management-System`:
  ```powershell
  npx tsc --noEmit
  npm run lint
  ```
- **Expected Results:**
  - [ ] TypeScript compiler exits with code 0 and zero errors.
  - [ ] Linter exits with zero errors.

### Test Case 15.3: Backend Automated Test Suite

- **Steps:**
  Open terminal in `fleet-backend`:
  ```powershell
  npm test
  ```
- **Expected Results:**
  - [ ] All backend test suites execute and pass (66+ passing tests).

### Test Case 15.4: OpenAPI Contract Synchronization

- **Steps:**
  In `Integrated-Fleet-Logistics-Maintenance-Management-System`:
  ```powershell
  npm run api:spec
  ```
- **Expected Results:**
  - [ ] `openapi.json` and `src/api/generated-types.ts` regenerate cleanly with zero schema drift.

---

## 4. Master Feature Verification Sign-Off Matrix

Complete this sign-off checklist upon executing each module:

| Module # | Feature / Workstream Scope      | Key Verification Checkpoint                                                      | Sign-off Status | Tester & Date |
| :------: | :------------------------------ | :------------------------------------------------------------------------------- | :-------------: | :------------ |
| **M01**  | **Authentication & RBAC**       | Local login, session sync, contractor signup queue, landing page routing         |    [ ] PASS     |               |
| **M02**  | **Dashboard Overview**          | Real-time KPI aggregation, quick actions, live audit activity stream             |    [ ] PASS     |               |
| **M03**  | **Fleet & KM Monitoring**       | Search/filter, mobile cards, odometer persistence, 5,000 KM PMS gating           |    [ ] PASS     |               |
| **M04**  | **Driver Quick-Log PWA**        | In-cab touch keypad, offline mutation drawer, background auto-sync               |    [ ] PASS     |               |
| **M05**  | **Fleet TCO & CPK Analytics**   | KPI cards, category charts, outlier watchlist, drilldown modal, CSV export       |    [ ] PASS     |               |
| **M06**  | **TSRF Logistics Workflow**     | Multi-stop planner, 4 PM cutoff alert, approver snapshot, digital stamps         |    [ ] PASS     |               |
| **M07**  | **PR Gatekeeper & Procurement** | Domain Rule 4 work order gating, Finance spend approval, shop fulfillment        |    [ ] PASS     |               |
| **M08**  | **Dynamic Form Builder**        | Field palette, property inspector, stage matrix, multi-role preview, publish     |    [ ] PASS     |               |
| **M09**  | **Reports & Audit Extraction**  | Version register, PII masking, evidence inspection, 10K CSV export, Auditor role |    [ ] PASS     |               |
| **M10**  | **Reference Data & Catalogs**   | Department approver linking, vehicle types, expense categories, vendors          |    [ ] PASS     |               |
| **M11**  | **User Management**             | User directory, provision account, admin password reset with session kill        |    [ ] PASS     |               |
| **M12**  | **Roles & Permissions**         | Read-only CASL matrix, post-login landing page customization per role            |    [ ] PASS     |               |
| **M13**  | **Activity History & Audit**    | Real-time immutable event stream, multi-filter query, metadata safety            |    [ ] PASS     |               |
| **M14**  | **Theme Editor**                | Dark/Light/High-contrast modes, accent palettes, local storage persistence       |    [ ] PASS     |               |
| **M15**  | **Automated Regression Suite**  | 91+ frontend tests, 66+ backend tests, clean `tsc`, OpenAPI contract sync        |    [ ] PASS     |               |

---

_Manual Test Script Prepared for Project Fleet (Project Elevate) — Hulma Fleet Logistics & Maintenance Management System._
