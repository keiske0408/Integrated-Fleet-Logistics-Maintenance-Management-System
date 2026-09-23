# Fleet Logistics & Maintenance Management — Core Domain Rules

> **CRITICAL ARCHITECTURAL CONTRACT**: The business rules documented here represent non-negotiable operational constraints. Any code touching PMS calculations, repair approvals, PR gating, or TSRF request cutoffs must strictly adhere to these rules without exception.

---

## 1. PMS Due Mileage Calculation

- **Rule**: `PMS due = last completed PMS KM + manufacturer interval` (default **5,000 km** unless overridden per vehicle).
- **Behavior**: If `current_km >= last_completed_pms_km + interval`, the vehicle is flagged as `PMS_DUE`.

## 2. Repair Work Order PMS Compliance Check

- **Rule**: A repair work order cannot move to `"approved"` without a PMS compliance check.
- **Behavior**: Any attempt to approve a repair work order when vehicle PMS is overdue must be rejected unless explicitly resolved or validated.

## 3. Mandatory Incident Report on Skipped PMS

- **Rule**: If PMS was skipped, an incident/damage report is mandatory before the repair proceeds.
- **Behavior**: If the vehicle's last scheduled PMS status is `"skipped"`, repair work order approval requires `incident_report_filed === true`. Approval without an incident report is strictly blocked.

## 4. Single Centralized Purchase Requisition (PR) Gatekeeper

- **Rule**: Nothing unlocks (repair work order or TSRF trip) until the linked Purchase Requisition status = `"approved"` — this check lives in exactly one place, never duplicated per route.
- **Behavior**: The function `assertPrApproved(prStatus)` acts as the single source of truth. If linked PR is not `"approved"`, neither repair work nor dispatch logistics may execute.

## 5. TSRF Cutoff Time Flagging

- **Rule**: TSRF requests submitted after the department's cutoff time must be flagged, not silently accepted (confirm exact cutoff rule with the fleet team before hardcoding a value).
- **Behavior**: Submissions timestamped after the scheduled daily cutoff (default standard: **16:00 / 4:00 PM**) are persisted with `is_flagged_after_cutoff = true` and require supervisory exception review before dispatch scheduling.
