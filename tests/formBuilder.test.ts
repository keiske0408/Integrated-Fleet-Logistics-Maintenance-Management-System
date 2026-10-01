import { describe, expect, it } from 'vitest';
import { serializeTsrfValues, TSRF_V1 } from '@/features/form-builder';
import { evaluateCondition, getFieldState } from '@/features/form-builder';

describe('TSRF form definition', () => {
  it('contains published intake fields bound to the expected LOVs', () => {
    const fields = TSRF_V1.sections.flatMap((section) => section.fields);
    const department = fields.find((field) => field.key === 'department');
    const vehicleType = fields.find((field) => field.key === 'vehicleType');

    expect(TSRF_V1.status).toBe('published');
    expect(department?.dataSource).toEqual({ kind: 'lov', listCode: 'DEPARTMENTS' });
    expect(vehicleType?.dataSource).toEqual({ kind: 'lov', listCode: 'VEHICLE_TYPES' });
    expect(fields.some((field) => field.key === 'origin')).toBe(true);
    expect(fields.some((field) => field.key === 'destination')).toBe(true);
    expect(fields.find((field) => field.key === 'stops')?.type).toBe('repeater');
    expect(fields.find((field) => field.key === 'passengers')?.type).toBe('repeater');
    expect(fields.find((field) => field.key === 'cargo')?.type).toBe('repeater');
  });

  it('evaluates declarative visibility and requiredness rules', () => {
    const values = { vehicleType: 'TRUCK6W' };
    expect(
      evaluateCondition({ field: 'vehicleType', operator: 'eq', value: 'TRUCK6W' }, values),
    ).toBe(true);
    expect(
      getFieldState(
        [
          {
            when: { field: 'vehicleType', operator: 'eq', value: 'TRUCK6W' },
            show: true,
            required: true,
          },
        ],
        values,
      ),
    ).toEqual({ visible: true, required: true, enabled: true });
  });

  it('serializes schema values into the existing TSRF submission shape', () => {
    const data = serializeTsrfValues({
      projectName: 'Project',
      department: 'IT',
      origin: 'Origin',
      destination: 'Destination',
      departureDate: '2026-10-02',
      callTime: '08:00',
      vehicleType: 'VAN',
      stops: [{ locationName: 'Origin', address: 'Address', waitingTimeMinutes: 10 }],
      passengers: [{ name: 'Passenger', department: 'IT', role: 'Tech' }],
      cargo: [{ description: 'Tools', quantity: 2, isFragile: false }],
    });

    expect(data).toEqual({
      projectName: 'Project',
      department: 'IT',
      origin: 'Origin',
      destination: 'Destination',
      departureDate: '2026-10-02',
      callTime: '08:00',
      vehicleType: 'VAN',
      stops: [{ stopOrder: 1, locationName: 'Origin', address: 'Address', waitingTimeMinutes: 10 }],
      passengers: [{ name: 'Passenger', department: 'IT', role: 'Tech' }],
      cargo: [{ description: 'Tools', quantity: 2, isFragile: false }],
    });
  });
});
