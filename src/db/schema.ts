import { pgTable, text, integer, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  plateNumber: text('plate_number').notNull().unique(),
  model: text('model').notNull().default('Standard Fleet Unit'),
  vehicleType: text('vehicle_type').notNull().default('commuter_van'),
  assignedDriver: text('assigned_driver'),
  currentKm: integer('current_km').notNull().default(0),
  lastPmsKm: integer('last_pms_km').notNull().default(0),
  pmsIntervalKm: integer('pms_interval_km').notNull().default(5000),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchaseRequisitions = pgTable('purchase_requisitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  prNumber: text('pr_number').notNull().unique(),
  department: text('department').notNull(),
  amount: integer('amount').notNull().default(0),
  status: text('status', { enum: ['draft', 'pending', 'approved', 'rejected'] })
    .notNull()
    .default('draft'),
  purpose: text('purpose').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  procurementNotes: text('procurement_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pmsRecords = pgTable('pms_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id),
  pmsKm: integer('pms_km').notNull(),
  status: text('status', { enum: ['completed', 'skipped', 'scheduled', 'in_progress'] })
    .notNull()
    .default('scheduled'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const repairWorkOrders = pgTable('repair_work_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id),
  description: text('description').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'in_progress', 'completed', 'rejected'] })
    .notNull()
    .default('pending'),
  linkedPrId: uuid('linked_pr_id').references(() => purchaseRequisitions.id),
  hasPmsCompliance: boolean('has_pms_compliance').notNull().default(false),
  incidentReportFiled: boolean('incident_report_filed').notNull().default(false),
  procurementFulfillmentStatus: text('procurement_fulfillment_status').notNull().default('pending_pr_approval'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incidentReports = pgTable('incident_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id),
  repairWorkOrderId: uuid('repair_work_order_id').references(() => repairWorkOrders.id),
  reportedBy: text('reported_by').notNull(),
  incidentDate: timestamp('incident_date').notNull(),
  reason: text('reason').notNull(),
  damagesDescription: text('damages_description').notNull(),
  preventativeAction: text('preventative_action'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tsrfRequests = pgTable('tsrf_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestNumber: text('request_number').notNull().unique(),
  department: text('department').notNull(),
  projectName: text('project_name').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  stopsJson: text('stops_json').notNull().default('[]'),
  passengersJson: text('passengers_json').notNull().default('[]'),
  cargoJson: text('cargo_json').notNull().default('[]'),
  vehicleType: text('vehicle_type').notNull().default('commuter_van'),
  assignedVehicleId: uuid('assigned_vehicle_id').references(() => vehicles.id),
  assignedDriver: text('assigned_driver'),
  departureDate: timestamp('departure_date').notNull(),
  callTime: text('call_time').notNull(),
  startingKm: integer('starting_km'),
  endingKm: integer('ending_km'),
  isFlaggedAfterCutoff: boolean('is_flagged_after_cutoff').notNull().default(false),
  cutoffReason: text('cutoff_reason'),
  approvalStatus: text('approval_status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  linkedPrId: uuid('linked_pr_id').references(() => purchaseRequisitions.id),
  tripStatus: text('trip_status').notNull().default('requested'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
