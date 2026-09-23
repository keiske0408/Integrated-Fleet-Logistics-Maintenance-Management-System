import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  vehicles,
  purchaseRequisitions,
  pmsRecords,
  repairWorkOrders,
  tsrfRequests,
} from './schema';

// Vehicles
export const insertVehicleSchema = createInsertSchema(vehicles);
export const selectVehicleSchema = createSelectSchema(vehicles);

// Purchase Requisitions
export const insertPurchaseRequisitionSchema = createInsertSchema(purchaseRequisitions);
export const selectPurchaseRequisitionSchema = createSelectSchema(purchaseRequisitions);

// PMS Records
export const insertPmsRecordSchema = createInsertSchema(pmsRecords);
export const selectPmsRecordSchema = createSelectSchema(pmsRecords);

// Repair Work Orders
export const insertRepairWorkOrderSchema = createInsertSchema(repairWorkOrders);
export const selectRepairWorkOrderSchema = createSelectSchema(repairWorkOrders);

// TSRF Requests
export const insertTsrfRequestSchema = createInsertSchema(tsrfRequests);
export const selectTsrfRequestSchema = createSelectSchema(tsrfRequests);

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type SelectVehicle = z.infer<typeof selectVehicleSchema>;
export type InsertPurchaseRequisition = z.infer<typeof insertPurchaseRequisitionSchema>;
export type SelectPurchaseRequisition = z.infer<typeof selectPurchaseRequisitionSchema>;
export type InsertRepairWorkOrder = z.infer<typeof insertRepairWorkOrderSchema>;
export type SelectRepairWorkOrder = z.infer<typeof selectRepairWorkOrderSchema>;
export type InsertTsrfRequest = z.infer<typeof insertTsrfRequestSchema>;
export type SelectTsrfRequest = z.infer<typeof selectTsrfRequestSchema>;
