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

const jsonObjectSchema = z.record(z.unknown());
const lovListSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  isSystem: z.boolean(),
  supportsHierarchy: z.boolean(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
const lovAttributeSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'boolean', 'select']),
  required: z.boolean(),
  showInGrid: z.boolean(),
  sortOrder: z.number().int(),
  options: z.array(z.unknown()),
  createdAt: z.string().datetime(),
});
const lovItemSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  code: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  status: z.enum(['active', 'inactive']),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  attrs: jsonObjectSchema,
  approvalUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
const formDefinitionInputSchema = z.object({
  key: z.string(),
  name: z.string(),
  schema: jsonObjectSchema,
  workflow: jsonObjectSchema.optional(),
});
const formVersionInputSchema = z.object({
  schema: jsonObjectSchema,
  workflow: jsonObjectSchema.optional(),
});
const formSubmissionInputSchema = z.object({ data: jsonObjectSchema });
const formTransitionInputSchema = z.object({
  toStage: z.string(),
  comment: z.string().optional(),
});
const formDataPatchSchema = z.object({ data: jsonObjectSchema });

registry.register('LovList', lovListSchema);
registry.register('LovAttribute', lovAttributeSchema);
registry.register('LovItem', lovItemSchema);
registry.register('FormDefinitionInput', formDefinitionInputSchema);
registry.register('FormVersionInput', formVersionInputSchema);
registry.register('FormSubmissionInput', formSubmissionInputSchema);
registry.register('FormTransitionInput', formTransitionInputSchema);
registry.register('FormDataPatch', formDataPatchSchema);

type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface JsonEndpoint {
  method: ApiMethod;
  path: string;
  summary: string;
  response: z.ZodTypeAny;
  status?: number;
  params?: z.AnyZodObject;
  query?: z.AnyZodObject;
  body?: z.ZodTypeAny;
}

function registerJsonEndpoint(endpoint: JsonEndpoint) {
  const request: {
    params?: z.AnyZodObject;
    query?: z.AnyZodObject;
    body?: { content: { 'application/json': { schema: z.ZodTypeAny } } };
  } = {};
  if (endpoint.params) request.params = endpoint.params;
  if (endpoint.query) request.query = endpoint.query;
  if (endpoint.body) {
    request.body = {
      content: { 'application/json': { schema: endpoint.body } },
    };
  }
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    summary: endpoint.summary,
    ...(Object.keys(request).length ? { request } : {}),
    responses: {
      [endpoint.status ?? 200]: {
        description: `${endpoint.summary} response`,
        content: { 'application/json': { schema: endpoint.response } },
      },
    },
  });
}

const idParamsSchema = z.object({ id: z.string().uuid() });
const codeParamsSchema = z.object({ code: z.string() });
const keyParamsSchema = z.object({ key: z.string() });
const jsonResponseSchema = jsonObjectSchema;

registerJsonEndpoint({
  method: 'get',
  path: '/api/roles',
  summary: 'List roles and assigned permission keys',
  response: z.array(jsonResponseSchema),
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/roles/permissions',
  summary: 'List role permission catalog entries',
  response: z.array(jsonResponseSchema),
});

registerJsonEndpoint({
  method: 'get',
  path: '/api/lov/lists',
  summary: 'List LOV catalogs',
  response: z.array(lovListSchema),
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/lov/lists',
  summary: 'Create an LOV catalog',
  body: z.object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    isSystem: z.boolean().optional(),
    supportsHierarchy: z.boolean().optional(),
  }),
  response: lovListSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/lov/lists/{code}',
  summary: 'Get an LOV catalog and its attributes',
  params: codeParamsSchema,
  response: lovListSchema.extend({ attributes: z.array(lovAttributeSchema) }),
});
registerJsonEndpoint({
  method: 'put',
  path: '/api/lov/lists/{id}',
  summary: 'Update LOV catalog metadata',
  params: idParamsSchema,
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    supportsHierarchy: z.boolean().optional(),
    status: z.enum(['active', 'archived']).optional(),
  }),
  response: lovListSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/lov/lists/{code}/items',
  summary: 'Search LOV items',
  params: codeParamsSchema,
  query: z.object({
    q: z.string().optional(),
    parentId: z.string().uuid().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
  response: z.array(lovItemSchema),
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/lov/lists/{code}/items',
  summary: 'Create an LOV item',
  params: codeParamsSchema,
  body: z.object({
    code: z.string(),
    label: z.string(),
    approvalUserId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    attrs: jsonObjectSchema.optional(),
  }),
  response: lovItemSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'put',
  path: '/api/lov/items/{id}',
  summary: 'Update an LOV item',
  params: idParamsSchema,
  body: z.object({
    code: z.string().optional(),
    label: z.string().optional(),
    approvalUserId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    attrs: jsonObjectSchema.optional(),
  }),
  response: lovItemSchema,
});
registerJsonEndpoint({
  method: 'delete',
  path: '/api/lov/items/{id}',
  summary: 'Deactivate an LOV item',
  params: idParamsSchema,
  response: lovItemSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/lov/lists/{code}/attributes',
  summary: 'List LOV attribute definitions',
  params: codeParamsSchema,
  response: z.array(lovAttributeSchema),
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/lov/lists/{code}/attributes',
  summary: 'Create an LOV attribute definition',
  params: codeParamsSchema,
  body: z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'boolean', 'select']).optional(),
    required: z.boolean().optional(),
    showInGrid: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    options: z.array(z.unknown()).optional(),
  }),
  response: lovAttributeSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'put',
  path: '/api/lov/attributes/{id}',
  summary: 'Update an LOV attribute definition',
  params: idParamsSchema,
  body: z.object({
    key: z.string().optional(),
    label: z.string().optional(),
    type: z.enum(['text', 'number', 'boolean', 'select']).optional(),
    required: z.boolean().optional(),
    showInGrid: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    options: z.array(z.unknown()).optional(),
  }),
  response: lovAttributeSchema,
});
registerJsonEndpoint({
  method: 'delete',
  path: '/api/lov/attributes/{id}',
  summary: 'Delete an LOV attribute definition',
  params: idParamsSchema,
  response: z.object({ id: z.string().uuid() }),
});

registerJsonEndpoint({
  method: 'get',
  path: '/api/forms/published/{key}',
  summary: 'Get the published form definition',
  params: keyParamsSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/forms/{key}',
  summary: 'Get a form definition and its versions',
  params: keyParamsSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/forms/{key}/submissions/report',
  summary: 'Get reportable form submission data',
  params: keyParamsSchema,
  query: z.object({ limit: z.string().optional() }),
  response: z.array(jsonResponseSchema),
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/forms/{key}/submissions',
  summary: 'Create a form submission',
  params: keyParamsSchema,
  body: formSubmissionInputSchema,
  response: jsonResponseSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/forms/submissions/{id}/transition',
  summary: 'Transition a form submission',
  params: idParamsSchema,
  body: formTransitionInputSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'patch',
  path: '/api/forms/submissions/{id}/data',
  summary: 'Update editable form submission data',
  params: idParamsSchema,
  body: formDataPatchSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/forms/submissions/{id}',
  summary: 'Get a form submission',
  params: idParamsSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'get',
  path: '/api/forms/submissions/{id}/events',
  summary: 'List form submission events',
  params: idParamsSchema,
  response: z.array(jsonResponseSchema),
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/forms',
  summary: 'Create a form definition and initial draft',
  body: formDefinitionInputSchema,
  response: jsonResponseSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/forms/{id}/versions',
  summary: 'Create a draft form version',
  params: idParamsSchema,
  body: formVersionInputSchema,
  response: jsonResponseSchema,
  status: 201,
});
registerJsonEndpoint({
  method: 'put',
  path: '/api/forms/versions/{id}',
  summary: 'Update a draft form version',
  params: idParamsSchema,
  body: formVersionInputSchema,
  response: jsonResponseSchema,
});
registerJsonEndpoint({
  method: 'post',
  path: '/api/forms/versions/{id}/publish',
  summary: 'Publish a validated form version',
  params: idParamsSchema,
  response: jsonResponseSchema,
});

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
