import type { FormDefinition, FormField, FormSection } from './types';

export interface FormVersionChange {
  kind: 'section' | 'field';
  action: 'added' | 'removed' | 'changed';
  path: string;
  details?: string[];
}

const FIELD_PROPERTIES: Array<keyof FormField> = [
  'type',
  'label',
  'required',
  'placeholder',
  'defaultValue',
  'options',
  'dataSource',
  'content',
  'width',
  'rules',
  'minRows',
  'maxRows',
  'meta',
];

function fieldMap(sections: FormSection[]): Map<string, FormField> {
  const fields = new Map<string, FormField>();
  const visit = (items: FormField[], prefix = '') => {
    items.forEach((field) => {
      const path = prefix ? `${prefix}.${field.key}` : field.key;
      fields.set(path, field);
      visit(field.rowFields ?? [], path);
    });
  };
  sections.forEach((section) => visit(section.fields));
  return fields;
}

function fieldChanges(before: FormField, after: FormField): string[] {
  return FIELD_PROPERTIES.filter(
    (property) => JSON.stringify(before[property]) !== JSON.stringify(after[property]),
  ).map(String);
}

export function diffFormDefinitions(
  before: FormDefinition,
  after: FormDefinition,
): FormVersionChange[] {
  const changes: FormVersionChange[] = [];
  const beforeSections = new Map(before.sections.map((section) => [section.id, section]));
  const afterSections = new Map(after.sections.map((section) => [section.id, section]));

  before.sections.forEach((section) => {
    const next = afterSections.get(section.id);
    if (!next) {
      changes.push({ kind: 'section', action: 'removed', path: section.title });
    } else {
      const details = (['title', 'description'] as const).filter(
        (property) => section[property] !== next[property],
      );
      if (details.length) {
        changes.push({
          kind: 'section',
          action: 'changed',
          path: section.title,
          details: [...details],
        });
      }
    }
  });
  after.sections.forEach((section) => {
    if (!beforeSections.has(section.id))
      changes.push({ kind: 'section', action: 'added', path: section.title });
  });

  const previousFields = fieldMap(before.sections);
  const nextFields = fieldMap(after.sections);
  previousFields.forEach((field, path) => {
    const next = nextFields.get(path);
    if (!next) {
      changes.push({ kind: 'field', action: 'removed', path });
      return;
    }
    const details = fieldChanges(field, next);
    if (details.length) changes.push({ kind: 'field', action: 'changed', path, details });
  });
  nextFields.forEach((_field, path) => {
    if (!previousFields.has(path)) changes.push({ kind: 'field', action: 'added', path });
  });

  return changes;
}
