import { describe, expect, it } from 'vitest';
import { serializeTsrfValues, TSRF_V1 } from '@/features/form-builder';
import { evaluateCondition, getFieldState } from '@/features/form-builder';
import { validateFormDefinition, validateFormValues } from '@/features/form-builder';
import { choosePublishedDefinition } from '@/features/form-builder';

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

  it('accepts seeded nested keys and rejects duplicate root keys and missing LOVs', () => {
    const codes = new Set(['DEPARTMENTS', 'VEHICLE_TYPES']);
    expect(validateFormDefinition(TSRF_V1, codes)).toEqual([]);

    const invalid = structuredClone(TSRF_V1);
    invalid.sections[1].fields[0].key = 'department';
    invalid.sections[1].fields[1].dataSource = { kind: 'lov', listCode: 'MISSING' };
    expect(validateFormDefinition(invalid, codes)).toEqual(
      expect.arrayContaining([
        'Field key "department" is duplicated.',
        'Field "Requesting Department" references unknown LOV list "MISSING".',
      ]),
    );
  });

  it('blocks submissions without the required passenger row', () => {
    const errors = validateFormValues(TSRF_V1, {
      projectName: 'Project',
      department: 'IT',
      departureDate: '2026-10-02',
      callTime: '08:00',
      vehicleType: 'VAN',
      origin: 'Origin',
      destination: 'Destination',
      stops: [{}],
      passengers: [],
      cargo: [],
    });
    expect(errors).toContain('Passengers requires at least 1 row.');
  });

  it('uses the newest published definition rather than an unpublished draft', () => {
    const published = { ...TSRF_V1, version: 2 };
    const selected = choosePublishedDefinition([
      {
        id: 'draft',
        version: 3,
        status: 'draft',
        schema: { ...TSRF_V1, version: 3, status: 'draft' },
      },
      { id: 'published-v1', version: 1, status: 'published', schema: TSRF_V1 },
      { id: 'published-v2', version: 2, status: 'published', schema: published },
    ]);
    expect(selected.version).toBe(2);
    expect(selected.status).toBe('published');
  });
});
