import { getFieldState } from './rules';
import type { FormDefinition, FormField, FormValues } from './types';

const MAX_SCHEMA_BYTES = 256 * 1024;

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
    if (field.dataSource && !availableLovCodes.has(field.dataSource.listCode)) {
      errors.push(
        `Field "${field.label}" references unknown LOV list "${field.dataSource.listCode}".`,
      );
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
    });
  };
  definition.sections.forEach((section) => validateFields(section.fields, values));
  return errors;
}
