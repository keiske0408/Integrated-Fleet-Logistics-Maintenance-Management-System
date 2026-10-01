import type { FormDefinition } from './types';

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
          width: 'full',
          options: [
            { value: 'VAN', label: 'Commuter Van' },
            { value: 'TRUCK6W', label: '6-Wheeler Truck' },
            { value: 'TRUCK10W', label: '10-Wheeler Truck' },
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
      ],
    },
  ],
};
