import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  projectFormValuesToDefinition,
  serializeTsrfValues,
  TSRF_V1,
  TSRF_WORKFLOW,
} from '@/features/form-builder';
import { evaluateCondition, getFieldState } from '@/features/form-builder';
import {
  validateFormDefinition,
  validateFormValues,
  validateFormWorkflow,
} from '@/features/form-builder';
import { choosePublishedDefinition, formatPrintableFieldValue } from '@/features/form-builder';
import { fieldRegistry } from '@/features/form-builder';

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
    const allocationType = fields.find((field) => field.key === 'allocationType');
    const fleetVehicle = fields.find((field) => field.key === 'assignedVehicleId');
    const thirdParty = fields.find((field) => field.key === 'truckerName');
    expect(allocationType?.type).toBe('select');
    expect(fleetVehicle?.type).toBe('entity_lookup');
    expect(fleetVehicle?.dataSource).toMatchObject({ kind: 'entity', entity: 'vehicles' });
    expect(fleetVehicle?.rules?.[0].when.value).toBe('third_party_trucker');
    expect(thirdParty?.rules?.[0].when.value).toBe('fleet_asset');
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

  it('validates workflow stages, transition roles, and cutoff configuration', () => {
    const fields = TSRF_V1.sections.flatMap((section) => section.fields);
    expect(validateFormWorkflow(TSRF_WORKFLOW, fields)).toEqual([]);

    const invalid = structuredClone(TSRF_WORKFLOW);
    invalid.cutoff.time = '25:90';
    invalid.transitions[0].roles = [];
    invalid.stages[0].fieldPermissions = { missing_field: { department_requester: 'edit' } };
    expect(validateFormWorkflow(invalid, fields)).toEqual(
      expect.arrayContaining([
        'Workflow transition 1 must allow at least one role.',
        'Cutoff time must use 24-hour HH:MM format.',
        'Stage "Draft" permissions reference unknown field "missing_field".',
      ]),
    );
  });

  it('allows requestors to edit and resubmit the default returned TSRF', () => {
    const returnedStage = TSRF_WORKFLOW.stages.find((stage) => stage.id === 'returned');
    expect(returnedStage?.fieldPermissions).toMatchObject({
      projectName: { department_requester: 'edit' },
      'passengers.name': { department_requester: 'edit' },
      'cargo.description': { department_requester: 'edit' },
    });
    expect(TSRF_WORKFLOW.transitions).toContainEqual(
      expect.objectContaining({
        from: 'returned',
        to: TSRF_WORKFLOW.initialStage,
        roles: ['department_requester', 'admin'],
        action: 'resubmitted',
      }),
    );
  });

  it('passes disabled rule state to registered field controls', () => {
    const field = TSRF_V1.sections[1].fields[0];
    const element = fieldRegistry.text({
      field,
      value: 'Project',
      disabled: true,
      onChange: () => undefined,
    });
    expect(React.isValidElement(element)).toBe(true);
    expect((element as React.ReactElement<{ disabled?: boolean }>).props.disabled).toBe(true);
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
      allocationType: 'fleet_asset',
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
      allocationType: 'fleet_asset',
      stops: [{ stopOrder: 1, locationName: 'Origin', address: 'Address', waitingTimeMinutes: 10 }],
      passengers: [{ name: 'Passenger', department: 'IT', role: 'Tech' }],
      cargo: [{ description: 'Tools', quantity: 2, isFragile: false }],
    });
  });

  it('projects published submissions to the loaded schema including repeater row fields', () => {
    const staleDefinition = structuredClone(TSRF_V1);
    staleDefinition.sections[1].fields = staleDefinition.sections[1].fields.filter(
      (field) => field.key !== 'allocationType',
    );
    const stopRepeater = staleDefinition.sections
      .find((section) => section.id === 'route')
      ?.fields.find((field) => field.key === 'stops');
    stopRepeater!.rowFields = stopRepeater!.rowFields!.filter((field) => field.key !== 'stopOrder');

    const projected = projectFormValuesToDefinition(staleDefinition, {
      projectName: 'Project',
      allocationType: 'fleet_asset',
      stops: [
        {
          stopOrder: 1,
          locationName: 'Origin',
          address: 'Address',
          waitingTimeMinutes: 10,
        },
      ],
    });

    expect(projected).not.toHaveProperty('allocationType');
    expect(projected.projectName).toBe('Project');
    expect(projected.stops).toEqual([
      { locationName: 'Origin', address: 'Address', waitingTimeMinutes: 10 },
    ]);
  });

  it('prints option labels and saved LOV labels instead of internal codes', () => {
    const fields = TSRF_V1.sections.flatMap((section) => section.fields);
    const allocationType = fields.find((field) => field.key === 'allocationType')!;
    const department = fields.find((field) => field.key === 'department')!;

    expect(formatPrintableFieldValue(allocationType, 'fleet_asset', 'allocationType', {})).toBe(
      'Fleet Asset',
    );
    expect(
      formatPrintableFieldValue(department, 'IT', 'department', {
        department: { code: 'IT', label: 'Information Technology' },
      }),
    ).toBe('Information Technology');
  });

  it('accepts seeded nested keys and rejects duplicate root keys and missing LOVs', () => {
    const codes = new Set(['DEPARTMENTS', 'VEHICLE_TYPES']);
    expect(validateFormDefinition(TSRF_V1, codes)).toEqual([]);

    const nestedRule = structuredClone(TSRF_V1);
    const stopFields = nestedRule.sections
      .find((section) => section.id === 'route')
      ?.fields.find((field) => field.key === 'stops')?.rowFields;
    expect(stopFields).toBeDefined();
    stopFields![0].rules = [{ when: { field: 'address', operator: 'exists' }, required: true }];
    expect(validateFormDefinition(nestedRule, codes)).toEqual([]);

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

  it('rejects rules with missing field references and required fields hidden without defaults', () => {
    const invalid = structuredClone(TSRF_V1);
    const projectName = invalid.sections[1].fields[0];
    projectName.required = true;
    projectName.defaultValue = undefined;
    projectName.rules = [
      { when: { field: 'missing_field', operator: 'exists' }, required: true },
      { when: { field: 'department', operator: 'exists' }, show: false },
    ];

    expect(validateFormDefinition(invalid, new Set(['DEPARTMENTS', 'VEHICLE_TYPES']))).toEqual(
      expect.arrayContaining([
        'Field "Project Name" rule references unknown field "missing_field".',
        'Required field "Project Name" is hidden by a rule and has no default.',
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
