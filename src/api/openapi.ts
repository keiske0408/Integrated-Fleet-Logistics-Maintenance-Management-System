import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import {
  selectVehicleSchema,
  insertVehicleSchema,
  selectPurchaseRequisitionSchema,
  insertPurchaseRequisitionSchema,
  selectRepairWorkOrderSchema,
  insertRepairWorkOrderSchema,
  selectTsrfRequestSchema,
  insertTsrfRequestSchema,
} from '../db/validation';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register components
registry.register('Vehicle', selectVehicleSchema);
registry.register('InsertVehicle', insertVehicleSchema);
registry.register('PurchaseRequisition', selectPurchaseRequisitionSchema);
registry.register('InsertPurchaseRequisition', insertPurchaseRequisitionSchema);
registry.register('RepairWorkOrder', selectRepairWorkOrderSchema);
registry.register('InsertRepairWorkOrder', insertRepairWorkOrderSchema);
registry.register('TSRFRequest', selectTsrfRequestSchema);
registry.register('InsertTSRFRequest', insertTsrfRequestSchema);

// Register routes
registry.registerPath({
  method: 'get',
  path: '/api/vehicles',
  summary: 'List all vehicles in fleet',
  responses: {
    200: {
      description: 'Vehicles list',
      content: {
        'application/json': {
          schema: z.array(selectVehicleSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/tsrf',
  summary: 'Submit a new TSRF request',
  request: {
    body: {
      content: {
        'application/json': {
          schema: insertTsrfRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'TSRF created',
      content: {
        'application/json': {
          schema: selectTsrfRequestSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/pr/{id}/approve',
  summary: 'Approve a Purchase Requisition (gated spend)',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'PR approved',
      content: {
        'application/json': {
          schema: selectPurchaseRequisitionSchema,
        },
      },
    },
  },
});

export function generateOpenApiSpec(): object {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Hulma Fleet Logistics & Maintenance Management API',
      description: 'Unified Fleet, PMS, PR gating, and TSRF Logistics REST API',
    },
    servers: [{ url: '/api' }],
  });
}

// Generate file if executed directly
if (process.argv[1] && process.argv[1].includes('openapi')) {
  const doc = generateOpenApiSpec();
  const outputPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf-8');
}
