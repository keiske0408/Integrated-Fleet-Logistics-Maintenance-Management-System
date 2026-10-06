import type { TSRFFormData } from '@/features/logistics/TSRFForm';
import type { FormDefinition, FormValues, FormWorkflow } from './types';

export const TSRF_WORKFLOW: FormWorkflow = {
  initialStage: 'submitted',
  stages: [
    { id: 'draft', label: 'Draft', statusCategory: 'draft' },
    { id: 'submitted', label: 'Submitted', statusCategory: 'in_review' },
    { id: 'endorsement', label: 'Endorsement', statusCategory: 'in_review' },
    { id: 'finance_verification', label: 'Finance Verification', statusCategory: 'in_review' },
    { id: 'approval', label: 'Approval', statusCategory: 'approved' },
    { id: 'dispatch_assignment', label: 'Dispatch Assignment', statusCategory: 'approved' },
    { id: 'confirmed', label: 'Confirmed', statusCategory: 'approved' },
    { id: 'in_progress', label: 'In Progress', statusCategory: 'in_progress' },
    { id: 'completed', label: 'Completed', statusCategory: 'completed' },
    { id: 'returned', label: 'Returned', statusCategory: 'returned' },
    { id: 'rejected', label: 'Rejected', statusCategory: 'rejected' },
    { id: 'cancelled', label: 'Cancelled', statusCategory: 'cancelled' },
  ],
  transitions: [
    { from: 'draft', to: 'submitted', roles: ['department_requester', 'admin'] },
    { from: 'submitted', to: 'endorsement', roles: ['approver', 'admin'] },
    { from: 'submitted', to: 'returned', roles: ['approver', 'admin'], reasonRequired: true },
    { from: 'submitted', to: 'rejected', roles: ['approver', 'admin'], reasonRequired: true },
    { from: 'endorsement', to: 'finance_verification', roles: ['finance', 'admin'] },
    { from: 'endorsement', to: 'approval', roles: ['approver', 'admin'] },
    { from: 'endorsement', to: 'returned', roles: ['approver', 'admin'], reasonRequired: true },
    { from: 'finance_verification', to: 'approval', roles: ['finance', 'approver', 'admin'] },
    { from: 'approval', to: 'dispatch_assignment', roles: ['approver', 'admin'] },
    { from: 'dispatch_assignment', to: 'confirmed', roles: ['fleet_team', 'admin'] },
    { from: 'confirmed', to: 'in_progress', roles: ['fleet_team', 'admin'] },
    { from: 'in_progress', to: 'completed', roles: ['fleet_team', 'admin'] },
    {
      from: 'draft',
      to: 'cancelled',
      roles: ['department_requester', 'admin'],
      reasonRequired: true,
    },
  ],
  cutoff: {
    time: '16:00',
    timezone: 'Asia/Manila',
    latePolicy: 'flag_and_exception_approval',
    exceptionStage: 'endorsement',
  },
};

export const TSRF_V1: FormDefinition = {
  key: 'tsrf',
  name: 'Transportation Service Request Form',
  version: 1,
  status: 'published',
  sections: [
    {
      id: 'intake-notice',
      title: 'TSRF Intake',
      fields: [
        {
          id: 'cutoff-notice',
          key: 'cutoff_notice',
          type: 'notice',
          label: 'Cut-off Notice',
          section: 'intake-notice',
          content: 'Regular TSRF intake is available until the daily 4:00 PM cut-off.',
        },
      ],
    },
    {
      id: 'trip-details',
      title: '1. Transportation Service Request',
      description: 'Specify the project, schedule, and vehicle allocation requirements.',
      fields: [
        {
          id: 'project-name',
          key: 'projectName',
          type: 'text',
          label: 'Project Name',
          section: 'trip-details',
          required: true,
          defaultValue: 'Asset Retrieval and KE Biometric Project',
        },
        {
          id: 'department',
          key: 'department',
          type: 'lookup',
          label: 'Requesting Department',
          section: 'trip-details',
          required: true,
          dataSource: { kind: 'lov', listCode: 'DEPARTMENTS' },
          meta: { reportable: true, pii: false },
          options: [
            { value: 'IT', label: 'Information Technology' },
            { value: 'LOG', label: 'Logistics & Dispatch' },
          ],
        },
        {
          id: 'departure-date',
          key: 'departureDate',
          type: 'date',
          label: 'Departure Date',
          section: 'trip-details',
          required: true,
          meta: { reportable: true, pii: false },
        },
        {
          id: 'call-time',
          key: 'callTime',
          type: 'time',
          label: 'Expected Call Time',
          section: 'trip-details',
          required: true,
        },
        {
          id: 'vehicle-type',
          key: 'vehicleType',
          type: 'lookup',
          label: 'Vehicle Type / Allocation',
          section: 'trip-details',
          required: true,
          dataSource: { kind: 'lov', listCode: 'VEHICLE_TYPES' },
          meta: { reportable: true, pii: false },
          width: 'full',
          options: [
            { value: 'VAN', label: 'Commuter Van' },
            { value: 'TRUCK6W', label: '6-Wheeler Truck' },
            { value: 'TRUCK10W', label: '10-Wheeler Truck' },
          ],
        },
        {
          id: 'allocation-type',
          key: 'allocationType',
          type: 'select',
          label: 'Allocation Type',
          section: 'trip-details',
          required: true,
          defaultValue: 'fleet_asset',
          options: [
            { value: 'fleet_asset', label: 'Fleet Asset' },
            { value: 'third_party_trucker', label: '3rd Party Trucker' },
          ],
        },
        {
          id: 'assigned-vehicle',
          key: 'assignedVehicleId',
          type: 'entity_lookup',
          label: 'Fleet Vehicle',
          section: 'trip-details',
          required: false,
          defaultValue: '',
          dataSource: {
            kind: 'entity',
            entity: 'vehicles',
            valueField: 'id',
            labelField: 'plateNumber',
          },
          rules: [
            {
              when: { field: 'allocationType', operator: 'eq', value: 'third_party_trucker' },
              show: false,
            },
          ],
        },
        {
          id: 'trucker-name',
          key: 'truckerName',
          type: 'text',
          label: 'Third-party Trucker',
          section: 'trip-details',
          required: true,
          defaultValue: '',
          rules: [
            {
              when: { field: 'allocationType', operator: 'eq', value: 'fleet_asset' },
              show: false,
            },
          ],
        },
      ],
    },
    {
      id: 'route',
      title: '2. Multi-Stop Route & Location Management',
      fields: [
        {
          id: 'origin',
          key: 'origin',
          type: 'text',
          label: 'Primary Origin',
          section: 'route',
          required: true,
        },
        {
          id: 'destination',
          key: 'destination',
          type: 'text',
          label: 'Primary Destination',
          section: 'route',
          required: true,
        },
        {
          id: 'stops',
          key: 'stops',
          type: 'repeater',
          label: 'Waypoints & Stops',
          section: 'route',
          minRows: 1,
          maxRows: 10,
          defaultValue: [
            {
              stopOrder: 1,
              locationName: 'MMG Warehouse',
              address: 'Building 4, MMG Logistics Complex',
              waitingTimeMinutes: 15,
              notes: 'Initial cargo loading',
            },
            {
              stopOrder: 2,
              locationName: 'Kingston Excell Facility',
              address: 'Lot 12 Kingston Industrial Park',
              waitingTimeMinutes: 45,
              notes: 'Unloading biometric terminals',
            },
          ],
          rowFields: [
            {
              id: 'stop-location',
              key: 'locationName',
              type: 'text',
              label: 'Stop Name',
              section: 'stop',
              required: true,
            },
            {
              id: 'stop-address',
              key: 'address',
              type: 'text',
              label: 'Address',
              section: 'stop',
              required: true,
            },
            {
              id: 'stop-wait',
              key: 'waitingTimeMinutes',
              type: 'number',
              label: 'Waiting Time (minutes)',
              section: 'stop',
            },
            { id: 'stop-notes', key: 'notes', type: 'textarea', label: 'Notes', section: 'stop' },
          ],
        },
      ],
    },
    {
      id: 'passengers',
      title: '3. Passenger Manifest',
      description: 'Record each passenger travelling on the request.',
      fields: [
        {
          id: 'passengers',
          key: 'passengers',
          type: 'repeater',
          label: 'Passengers',
          section: 'passengers',
          required: true,
          minRows: 1,
          maxRows: 10,
          defaultValue: [
            { name: 'Juan Dela Cruz', department: 'IT Support', role: 'Lead Technician' },
            { name: 'Maria Santos', department: 'Asset Management', role: 'Auditor' },
          ],
          rowFields: [
            {
              id: 'passenger-name',
              key: 'name',
              type: 'text',
              label: 'Name',
              section: 'passenger',
              required: true,
              meta: { reportable: false, pii: true },
            },
            {
              id: 'passenger-department',
              key: 'department',
              type: 'text',
              label: 'Department',
              section: 'passenger',
              required: true,
            },
            {
              id: 'passenger-role',
              key: 'role',
              type: 'text',
              label: 'Role',
              section: 'passenger',
            },
          ],
        },
      ],
    },
    {
      id: 'cargo',
      title: '4. Cargo & Equipment Control',
      fields: [
        {
          id: 'cargo',
          key: 'cargo',
          type: 'repeater',
          label: 'Cargo Items',
          section: 'cargo',
          maxRows: 10,
          defaultValue: [
            {
              description: 'KE Biometric Scanners (Pack of 10)',
              quantity: 2,
              weightKg: 15,
              isFragile: true,
            },
          ],
          rowFields: [
            {
              id: 'cargo-description',
              key: 'description',
              type: 'text',
              label: 'Description',
              section: 'cargo-item',
              required: true,
            },
            {
              id: 'cargo-quantity',
              key: 'quantity',
              type: 'number',
              label: 'Quantity',
              section: 'cargo-item',
              required: true,
            },
            {
              id: 'cargo-weight',
              key: 'weightKg',
              type: 'number',
              label: 'Weight (kg)',
              section: 'cargo-item',
            },
            {
              id: 'cargo-fragile',
              key: 'isFragile',
              type: 'checkbox',
              label: 'Fragile',
              section: 'cargo-item',
            },
          ],
        },
      ],
    },
  ],
};

function rowsFor(values: FormValues, key: string): FormValues[] {
  return Array.isArray(values[key]) ? (values[key] as FormValues[]) : [];
}

function isFormValues(value: unknown): value is FormValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectFieldValues(fields: FormField[], values: FormValues): FormValues {
  const projected: FormValues = {};
  fields.forEach((field) => {
    if (field.type === 'notice' || !Object.prototype.hasOwnProperty.call(values, field.key)) return;

    const value = values[field.key];
    projected[field.key] =
      field.type === 'repeater' && Array.isArray(value)
        ? value.map((row) =>
            isFormValues(row) ? projectFieldValues(field.rowFields ?? [], row) : row,
          )
        : value;
  });
  return projected;
}

export function projectFormValuesToDefinition(
  definition: FormDefinition,
  values: FormValues,
): FormValues {
  return projectFieldValues(
    definition.sections.flatMap((section) => section.fields),
    values,
  );
}

export function serializeTsrfValues(values: FormValues): TSRFFormData {
  return {
    projectName: String(values.projectName ?? ''),
    department: String(values.department ?? ''),
    origin: String(values.origin ?? ''),
    destination: String(values.destination ?? ''),
    departureDate: String(values.departureDate ?? ''),
    callTime: String(values.callTime ?? ''),
    vehicleType: String(values.vehicleType ?? ''),
    allocationType: String(
      values.allocationType ?? 'fleet_asset',
    ) as TSRFFormData['allocationType'],
    ...(values.assignedVehicleId ? { assignedVehicleId: String(values.assignedVehicleId) } : {}),
    ...(values.truckerName ? { truckerName: String(values.truckerName) } : {}),
    stops: rowsFor(values, 'stops').map((row, index) => ({
      stopOrder: Number(row.stopOrder ?? index + 1),
      locationName: String(row.locationName ?? ''),
      address: String(row.address ?? ''),
      waitingTimeMinutes: Number(row.waitingTimeMinutes ?? 0),
      ...(row.notes ? { notes: String(row.notes) } : {}),
    })),
    passengers: rowsFor(values, 'passengers').map((row) => ({
      name: String(row.name ?? ''),
      department: String(row.department ?? ''),
      ...(row.role ? { role: String(row.role) } : {}),
    })),
    cargo: rowsFor(values, 'cargo').map((row) => ({
      description: String(row.description ?? ''),
      quantity: Number(row.quantity ?? 0),
      ...(row.weightKg !== undefined ? { weightKg: Number(row.weightKg) } : {}),
      isFragile: Boolean(row.isFragile),
    })),
  };
}
