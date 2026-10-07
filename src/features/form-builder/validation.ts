import { getFieldState } from './rules';
import type {
  FormDefinition,
  FormField,
  FormValues,
  FormWorkflow,
  SystemStatusCategory,
} from './types';

const MAX_SCHEMA_BYTES = 256 * 1024;
const SYSTEM_STATUS_CATEGORIES: SystemStatusCategory[] = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];
const WORKFLOW_ROLES = [
  'department_requester',
  'approver',
  'finance',
  'fleet_team',
  'procurement',
  'admin',
];

export function validateFormDefinition(
  definition: FormDefinition,
  availableLovCodes: Set<string>,
): string[] {
  const errors: string[] = [];
  const rootKeys = new Set(
    definition.sections.flatMap((section) => section.fields.map((field) => field.key)),
  );
  const visit = (
    field: FormField,
    scope: string,
    keys: Set<string>,
    availableRuleKeys: Set<string>,
  ) => {
    const scopedKey = `${scope}${field.key}`;
    if (!field.key.trim()) errors.push(`Field "${field.label}" is missing a key.`);
    else if (keys.has(scopedKey)) errors.push(`Field key "${scopedKey}" is duplicated.`);
    else keys.add(scopedKey);

    if (!field.label.trim()) errors.push(`Field "${field.key}" is missing a label.`);
    if (field.type === 'select') {
      const options = Array.isArray(field.options) ? (field.options as unknown[]) : [];
      if (options.length === 0)
        errors.push(`Select field "${field.label}" needs at least one option.`);
      const optionValues = new Set<string>();
      options.forEach((option) => {
        if (
          typeof option !== 'object' ||
          option === null ||
          typeof (option as { value?: unknown }).value !== 'string' ||
          typeof (option as { label?: unknown }).label !== 'string' ||
          !(option as { value: string }).value.trim() ||
          !(option as { label: string }).label.trim()
        ) {
          errors.push(`Select field "${field.label}" has an invalid option.`);
          return;
        }
        const value = (option as { value: string }).value;
        if (optionValues.has(value))
          errors.push(`Select field "${field.label}" has duplicate option value "${value}".`);
        optionValues.add(value);
      });
    }
    if (field.minRows !== undefined && (!Number.isInteger(field.minRows) || field.minRows < 0))
      errors.push(`Repeater field "${field.label}" minimum rows must be a non-negative integer.`);
    if (field.maxRows !== undefined && (!Number.isInteger(field.maxRows) || field.maxRows < 0))
      errors.push(`Repeater field "${field.label}" maximum rows must be a non-negative integer.`);
    if (
      field.minRows !== undefined &&
      field.maxRows !== undefined &&
      field.maxRows < field.minRows
    ) {
      errors.push(`Repeater field "${field.label}" maximum rows cannot be below minimum rows.`);
    }
    if (field.dataSource?.kind === 'lov' && !availableLovCodes.has(field.dataSource.listCode)) {
      errors.push(
        `Field "${field.label}" references unknown LOV list "${field.dataSource.listCode}".`,
      );
    }
    if (
      field.dataSource?.kind === 'entity' &&
      field.dataSource.entity !== 'vehicles' &&
      field.dataSource.entity !== 'drivers'
    ) {
      errors.push(`Field "${field.label}" references an unsupported entity.`);
    }
    field.rules?.forEach((rule) => {
      if (!availableRuleKeys.has(rule.when.field)) {
        errors.push(`Field "${field.label}" rule references unknown field "${rule.when.field}".`);
      }
      if (
        rule.show === false &&
        (field.required || rule.required) &&
        field.defaultValue === undefined
      ) {
        errors.push(`Required field "${field.label}" is hidden by a rule and has no default.`);
      }
    });
    const rowFields = field.rowFields ?? [];
    const childKeys = new Set<string>();
    const rowRuleKeys = new Set([...rootKeys, ...rowFields.map((rowField) => rowField.key)]);
    rowFields.forEach((rowField) => visit(rowField, `${scopedKey}.`, childKeys, rowRuleKeys));
  };

  if (!definition.key.trim()) errors.push('Form key is required.');
  if (!definition.name.trim()) errors.push('Form name is required.');
  if (definition.sections.length === 0) errors.push('Add at least one section before publishing.');
  const keys = new Set<string>();
  definition.sections.forEach((section) =>
    section.fields.forEach((field) => visit(field, '', keys, rootKeys)),
  );
  if (new TextEncoder().encode(JSON.stringify(definition)).byteLength > MAX_SCHEMA_BYTES) {
    errors.push('Form definition exceeds the 256 KB size limit.');
  }
  return errors;
}

export function validateFormWorkflow(workflow: FormWorkflow, fields: FormField[]): string[] {
  const errors: string[] = [];
  const stageIds = new Set<string>();
  workflow.stages.forEach((stage) => {
    if (!stage.id.trim()) errors.push('Workflow stage ID is required.');
    else if (stageIds.has(stage.id)) errors.push(`Workflow stage ID "${stage.id}" is duplicated.`);
    else stageIds.add(stage.id);
    if (!stage.label.trim()) errors.push(`Workflow stage "${stage.id}" needs a label.`);
    if (!SYSTEM_STATUS_CATEGORIES.includes(stage.statusCategory))
      errors.push(`Workflow stage "${stage.id}" has an invalid status category.`);
  });
  if (!stageIds.has(workflow.initialStage))
    errors.push('Initial workflow stage must reference an existing stage.');

  const fieldKeys = new Set<string>();
  const collectKeys = (nestedFields: FormField[], prefix = '') =>
    nestedFields.forEach((field) => {
      const key = prefix ? `${prefix}.${field.key}` : field.key;
      fieldKeys.add(key);
      if (field.rowFields) collectKeys(field.rowFields, key);
    });
  collectKeys(fields);
  workflow.stages.forEach((stage) => {
    Object.entries(stage.fieldPermissions ?? {}).forEach(([fieldKey, rolePermissions]) => {
      if (!fieldKeys.has(fieldKey))
        errors.push(`Stage "${stage.label}" permissions reference unknown field "${fieldKey}".`);
      Object.entries(rolePermissions).forEach(([role, permission]) => {
        if (!WORKFLOW_ROLES.includes(role))
          errors.push(`Stage "${stage.label}" uses unknown role "${role}".`);
        if (!['edit', 'read', 'hidden'].includes(permission))
          errors.push(`Stage "${stage.label}" has an invalid field permission.`);
      });
    });
  });
  workflow.transitions.forEach((transition, index) => {
    if (!stageIds.has(transition.from) || !stageIds.has(transition.to))
      errors.push(`Workflow transition ${index + 1} references an unknown stage.`);
    if (transition.from === transition.to)
      errors.push(`Workflow transition ${index + 1} cannot loop to the same stage.`);
    if (transition.roles.length === 0)
      errors.push(`Workflow transition ${index + 1} must allow at least one role.`);
    transition.requiredFields?.forEach((key) => {
      if (!fieldKeys.has(key))
        errors.push(`Workflow transition ${index + 1} requires unknown field "${key}".`);
    });
    const target = workflow.stages.find((stage) => stage.id === transition.to);
    if (
      target &&
      ['returned', 'rejected', 'cancelled'].includes(target.statusCategory) &&
      !transition.reasonRequired
    ) {
      errors.push(`Transition to ${target.label} must require a reason.`);
    }
  });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(workflow.cutoff.time))
    errors.push('Cutoff time must use 24-hour HH:MM format.');
  if (!workflow.cutoff.timezone.trim()) errors.push('Cutoff timezone is required.');
  if (
    workflow.cutoff.latePolicy === 'flag_and_exception_approval' &&
    !stageIds.has(workflow.cutoff.exceptionStage ?? '')
  ) {
    errors.push('Cutoff exception stage must reference an existing stage.');
  }
  return errors;
}

export function validateFormValues(definition: FormDefinition, values: FormValues): string[] {
  const errors: string[] = [];
  const validateFields = (fields: FormField[], source: FormValues, scope = '') => {
    fields.forEach((field) => {
      const state = getFieldState(field.rules, source);
      if (!state.visible || field.type === 'notice') return;
      const value = source[field.key];
      const required = field.required || state.required;
      if (field.type === 'repeater') {
        const rows = Array.isArray(value) ? value : [];
        const minRows = field.minRows ?? (required ? 1 : 0);
        if (rows.length < minRows)
          errors.push(
            `${scope}${field.label} requires at least ${minRows} row${minRows === 1 ? '' : 's'}.`,
          );
        if (field.maxRows !== undefined && rows.length > field.maxRows)
          errors.push(`${scope}${field.label} allows at most ${field.maxRows} rows.`);
        rows.forEach((row, index) =>
          validateFields(field.rowFields ?? [], row, `${field.label} row ${index + 1}: `),
        );
        return;
      }
      if (required && (value === undefined || value === '' || value === false)) {
        errors.push(`${scope}${field.label} is required.`);
      }
      if (
        field.type === 'entity_lookup' &&
        value !== undefined &&
        value !== '' &&
        !(field.options ?? []).some((option) => option.value === value)
      ) {
        errors.push(`${scope}${field.label} must be selected from the available fleet records.`);
      }
    });
  };
  definition.sections.forEach((section) => validateFields(section.fields, values));
  return errors;
}
