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
import {
  choosePublishedDefinition,
  formatPrintableFieldValue,
  resolveEntityLetterhead,
} from '@/features/form-builder';
import { fieldRegistry } from '@/features/form-builder';
import { getWorkflowApprovalStamps } from '@/features/form-builder';
import { moveFieldWithinSections } from '@/features/form-builder/reorder';
import { projectFormForRoleStage } from '@/features/form-builder/preview';
import { parseFormDefinitionImport } from '@/features/form-builder/importSchema';
import { diffFormDefinitions } from '@/features/form-builder/versionDiff';
import { createEditorHistory, editorHistoryReducer } from '@/features/form-builder/editorHistory';
import { formatFieldOptions, parseFieldOptions } from '@/features/form-builder/fieldConfiguration';

describe('TSRF form definition', () => {
  it('reorders fields by keyboard action without moving them across sections', () => {
    const sections = structuredClone(TSRF_V1.sections);
    const section = sections[1];
    const initialOrder = section.fields.map((field) => field.id);

    const moved = moveFieldWithinSections(sections, initialOrder[1], -1);
    expect(moved[1].fields.map((field) => field.id)).toEqual([
      initialOrder[1],
      initialOrder[0],
      ...initialOrder.slice(2),
    ]);
    expect(moved[0]).toBe(sections[0]);
    expect(moveFieldWithinSections(sections, initialOrder[0], -1)).toBe(sections);
  });

  it('projects the preview by role and stage, including nested field access', () => {
    const stage = {
      id: 'preview',
      label: 'Preview',
      statusCategory: 'in_review' as const,
      fieldPermissions: {
        projectName: { department_requester: 'edit' as const, admin: 'hidden' as const },
        department: { department_requester: 'hidden' as const, admin: 'read' as const },
        passengers: { department_requester: 'read' as const },
        'passengers.name': { department_requester: 'edit' as const },
      },
    };

    const requestor = projectFormForRoleStage(TSRF_V1, stage, 'department_requester');
    const requestorFields = requestor.definition.sections.flatMap((section) => section.fields);
    expect(requestorFields.some((field) => field.key === 'projectName')).toBe(true);
    expect(requestorFields.some((field) => field.key === 'department')).toBe(false);
    expect(requestor.fieldAccess.projectName).toBe('edit');
    expect(requestor.fieldAccess['passengers.name']).toBe('edit');

    const administrator = projectFormForRoleStage(TSRF_V1, stage, 'admin');
    const administratorFields = administrator.definition.sections.flatMap(
      (section) => section.fields,
    );
    expect(administratorFields.some((field) => field.key === 'projectName')).toBe(false);
    expect(administrator.fieldAccess.department).toBe('read');
    expect(administrator.fieldAccess.origin).toBe('read');
  });

  it('validates imported form JSON and rejects malformed schemas or missing LOVs', () => {
    const valid = parseFormDefinitionImport(
      JSON.stringify(TSRF_V1),
      new Set(['DEPARTMENTS', 'VEHICLE_TYPES', 'ENTITIES']),
    );
    expect(valid.definition?.key).toBe(TSRF_V1.key);
    expect(valid.errors).toEqual([]);

    expect(parseFormDefinitionImport('{', new Set()).errors).toContain(
      'Import file must contain valid JSON.',
    );
    const invalid = structuredClone(TSRF_V1);
    invalid.sections[1].fields.find((field) => field.key === 'projectName')!.dataSource = {
      kind: 'lov',
      listCode: 'MISSING',
    };
    expect(
      parseFormDefinitionImport(JSON.stringify(invalid), new Set(['DEPARTMENTS', 'ENTITIES']))
        .errors,
    ).toContain('Field "Project Name" references unknown LOV list "MISSING".');
  });

  it('diffs versioned schemas by section, field, and nested field properties', () => {
    const previous = structuredClone(TSRF_V1);
    const next = structuredClone(TSRF_V1);
    next.sections[0].title = 'Updated notice';
    const projectName = next.sections[1].fields.find((field) => field.key === 'projectName')!;
    projectName.label = 'Updated Project Name';
    const passengers = next.sections
      .flatMap((section) => section.fields)
      .find((field) => field.key === 'passengers')!;
    passengers.rowFields![0].required = !passengers.rowFields![0].required;
    next.sections[1].fields.push({
      id: 'new-field',
      key: 'newField',
      type: 'text',
      label: 'New Field',
      section: 'trip-details',
    });

    expect(diffFormDefinitions(previous, next)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'section', action: 'changed', path: 'TSRF Intake' }),
        expect.objectContaining({
          kind: 'field',
          action: 'changed',
          path: 'projectName',
          details: expect.arrayContaining(['label']),
        }),
        expect.objectContaining({
          kind: 'field',
          action: 'changed',
          path: 'passengers.name',
          details: expect.arrayContaining(['required']),
        }),
        expect.objectContaining({ kind: 'field', action: 'added', path: 'newField' }),
      ]),
    );
    expect(diffFormDefinitions(previous, previous)).toEqual([]);
  });

  it('supports undo, redo, and a new edit branch in editor history', () => {
    const initial = {
      definition: structuredClone(TSRF_V1),
      workflow: structuredClone(TSRF_WORKFLOW),
    };
    const changed = structuredClone(initial);
    changed.definition.name = 'Renamed TSRF';
    const branched = structuredClone(initial);
    branched.definition.name = 'Branched TSRF';

    const edited = editorHistoryReducer(createEditorHistory(initial), {
      type: 'edit',
      snapshot: changed,
    });
    expect(edited.present.definition.name).toBe('Renamed TSRF');
    const undone = editorHistoryReducer(edited, { type: 'undo' });
    expect(undone.present.definition.name).toBe(TSRF_V1.name);
    const redone = editorHistoryReducer(undone, { type: 'redo' });
    expect(redone.present.definition.name).toBe('Renamed TSRF');
    const undoThenBranch = editorHistoryReducer(undone, { type: 'edit', snapshot: branched });
    expect(undoThenBranch.future).toHaveLength(0);
    expect(editorHistoryReducer(undoThenBranch, { type: 'redo' })).toBe(undoThenBranch);
  });

  it('round-trips select options with optional explicit labels', () => {
    const options = parseFieldOptions('fleet_asset:Fleet Asset\nthird_party_trucker');
    expect(options).toEqual([
      { value: 'fleet_asset', label: 'Fleet Asset' },
      { value: 'third_party_trucker', label: 'third_party_trucker' },
    ]);
    expect(parseFieldOptions(formatFieldOptions(options))).toEqual(options);
  });

  it('validates select options and repeater row limits before publishing', () => {
    const invalid = structuredClone(TSRF_V1);
    const select = invalid.sections[1].fields.find((field) => field.key === 'allocationType')!;
    select.options = [
      { value: 'fleet_asset', label: 'Fleet Asset' },
      { value: 'fleet_asset', label: 'Duplicate' },
    ];
    const repeater = invalid.sections
      .flatMap((section) => section.fields)
      .find((field) => field.type === 'repeater')!;
    repeater.minRows = 4;
    repeater.maxRows = 2;

    expect(
      validateFormDefinition(invalid, new Set(['DEPARTMENTS', 'VEHICLE_TYPES', 'ENTITIES'])),
    ).toEqual(
      expect.arrayContaining([
        'Select field "Allocation Type" has duplicate option value "fleet_asset".',
        `Repeater field "${repeater.label}" maximum rows cannot be below minimum rows.`,
      ]),
    );
  });

  it('contains published intake fields bound to the expected LOVs', () => {
    const fields = TSRF_V1.sections.flatMap((section) => section.fields);
    const entity = fields.find((field) => field.key === 'entity');
    const department = fields.find((field) => field.key === 'department');
    const vehicleType = fields.find((field) => field.key === 'vehicleType');

    expect(TSRF_V1.status).toBe('published');
    expect(entity?.dataSource).toEqual({ kind: 'lov', listCode: 'ENTITIES' });
    expect(department?.dataSource).toEqual({ kind: 'lov', listCode: 'DEPARTMENTS' });
    expect(vehicleType?.dataSource).toEqual({ kind: 'lov', listCode: 'VEHICLE_TYPES' });
    expect(fields.some((field) => field.key === 'origin')).toBe(true);
    expect(fields.some((field) => field.key === 'destination')).toBe(true);
    expect(fields.find((field) => field.key === 'stops')?.type).toBe('repeater');
    expect(fields.find((field) => field.key === 'passengers')?.type).toBe('repeater');
    expect(fields.find((field) => field.key === 'cargo')?.type).toBe('repeater');
    const allocationType = fields.find((field) => field.key === 'allocationType');
    const fleetVehicle = fields.find((field) => field.key === 'assignedVehicleId');
    const endingOdometer = fields.find((field) => field.key === 'endingKm');
    const thirdParty = fields.find((field) => field.key === 'truckerName');
    expect(allocationType?.type).toBe('select');
    expect(fleetVehicle?.type).toBe('entity_lookup');
    expect(fleetVehicle?.dataSource).toMatchObject({ kind: 'entity', entity: 'vehicles' });
    expect(endingOdometer?.type).toBe('number');
    expect(endingOdometer?.rules?.[0].when.value).toBe('fleet_asset');
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

  it('accepts active driver entity lookup sources', () => {
    const definition = structuredClone(TSRF_V1);
    definition.sections[1].fields.push({
      id: 'assigned-driver',
      key: 'driverId',
      type: 'entity_lookup',
      label: 'Assigned Driver',
      section: 'trip-details',
      dataSource: {
        kind: 'entity',
        entity: 'drivers',
        valueField: 'id',
        labelField: 'name',
      },
    });

    expect(
      validateFormDefinition(definition, new Set(['DEPARTMENTS', 'VEHICLE_TYPES', 'ENTITIES'])),
    ).toEqual([]);
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

  it('allows owners to cancel submitted or returned TSRFs with a reason', () => {
    expect(TSRF_WORKFLOW.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'submitted',
          to: 'cancelled',
          roles: ['department_requester', 'admin'],
          reasonRequired: true,
        }),
        expect.objectContaining({
          from: 'returned',
          to: 'cancelled',
          roles: ['department_requester', 'admin'],
          reasonRequired: true,
        }),
      ]),
    );
  });

  it('keeps the odometer requestor-hidden and fleet-editable until trip completion', () => {
    const submitted = TSRF_WORKFLOW.stages.find((stage) => stage.id === 'submitted')!;
    const inProgress = TSRF_WORKFLOW.stages.find((stage) => stage.id === 'in_progress')!;
    expect(submitted.fieldPermissions?.endingKm?.department_requester).toBe('hidden');
    expect(inProgress.fieldPermissions?.endingKm).toMatchObject({
      department_requester: 'hidden',
      fleet_team: 'edit',
      admin: 'edit',
    });
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
      assignedVehicleId: 'vehicle-id',
      endingKm: 5200,
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
      assignedVehicleId: 'vehicle-id',
      endingKm: 5200,
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

  it('uses the saved entity label for print letterhead and falls back safely', () => {
    expect(
      resolveEntityLetterhead(
        { entity: 'GVE' },
        { entity: { code: 'GVE', label: 'Global Ventures Enterprise' } },
      ),
    ).toBe('Global Ventures Enterprise');
    expect(resolveEntityLetterhead({ entity: 'HULMA' }, {})).toBe('HULMA');
    expect(resolveEntityLetterhead({}, {})).toBe('FLEET LOGISTICS');
  });

  it('projects the latest finance verification and approval events for printing', () => {
    const stamps = getWorkflowApprovalStamps([
      {
        fromStage: null,
        toStage: 'submitted',
        actorName: 'Requester',
        actorRole: 'department_requester',
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        fromStage: 'endorsement',
        toStage: 'finance_verification',
        actorName: 'Finance Reviewer',
        actorRole: 'finance',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
      {
        fromStage: 'finance_verification',
        toStage: 'approval',
        actorName: 'Finance Reviewer',
        actorRole: 'finance',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        fromStage: 'endorsement',
        toStage: 'approval',
        actorName: 'Approver',
        actorRole: 'approver',
        createdAt: '2026-10-01T11:00:00.000Z',
      },
    ]);

    expect(stamps.finance).toMatchObject({
      actorName: 'Finance Reviewer',
      actorRole: 'finance',
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    expect(stamps.approval).toMatchObject({
      actorName: 'Approver',
      actorRole: 'approver',
      createdAt: '2026-10-01T11:00:00.000Z',
    });
    expect(getWorkflowApprovalStamps([])).toEqual({ finance: null, approval: null });
  });

  it('accepts seeded nested keys and rejects duplicate root keys and missing LOVs', () => {
    const codes = new Set(['DEPARTMENTS', 'VEHICLE_TYPES', 'ENTITIES']);
    expect(validateFormDefinition(TSRF_V1, codes)).toEqual([]);

    const nestedRule = structuredClone(TSRF_V1);
    const stopFields = nestedRule.sections
      .find((section) => section.id === 'route')
      ?.fields.find((field) => field.key === 'stops')?.rowFields;
    expect(stopFields).toBeDefined();
    stopFields![0].rules = [{ when: { field: 'address', operator: 'exists' }, required: true }];
    expect(validateFormDefinition(nestedRule, codes)).toEqual([]);

    const invalid = structuredClone(TSRF_V1);
    invalid.sections[1].fields.find((field) => field.key === 'entity')!.key = 'department';
    invalid.sections[1].fields.find(
      (field) => field.label === 'Requesting Department',
    )!.dataSource = {
      kind: 'lov',
      listCode: 'MISSING',
    };
    expect(validateFormDefinition(invalid, codes)).toEqual(
      expect.arrayContaining([
        'Field key "department" is duplicated.',
        'Field "Requesting Department" references unknown LOV list "MISSING".',
      ]),
    );
  });

  it('rejects rules with missing field references and required fields hidden without defaults', () => {
    const invalid = structuredClone(TSRF_V1);
    const projectName = invalid.sections[1].fields.find((field) => field.key === 'projectName')!;
    projectName.required = true;
    projectName.defaultValue = undefined;
    projectName.rules = [
      { when: { field: 'missing_field', operator: 'exists' }, required: true },
      { when: { field: 'department', operator: 'exists' }, show: false },
    ];

    expect(
      validateFormDefinition(invalid, new Set(['DEPARTMENTS', 'VEHICLE_TYPES', 'ENTITIES'])),
    ).toEqual(
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
