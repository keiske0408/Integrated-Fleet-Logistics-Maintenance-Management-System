import { pgTable, text, integer, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  plateNumber: text('plate_number').notNull().unique(),
  currentKm: integer('current_km').notNull().default(0),
  lastPmsKm: integer('last_pms_km').notNull().default(0),
  pmsIntervalKm: integer('pms_interval_km').notNull().default(5000),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pmsRecords = pgTable('pms_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id),
  pmsKm: integer('pms_km').notNull(),
  status: text('status', { enum: ['completed', 'skipped', 'scheduled'] })
    .notNull()
    .default('scheduled'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tsrfRequests = pgTable('tsrf_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestNumber: text('request_number').notNull().unique(),
  department: text('department').notNull(),
  projectName: text('project_name').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  departureDate: timestamp('departure_date').notNull(),
  callTime: text('call_time').notNull(),
  isFlaggedAfterCutoff: boolean('is_flagged_after_cutoff').notNull().default(false),
  approvalStatus: text('approval_status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  linkedPrId: uuid('linked_pr_id').references(() => purchaseRequisitions.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
