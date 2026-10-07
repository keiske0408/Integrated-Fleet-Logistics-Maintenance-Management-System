import type { FormSection } from './types';

export function moveFieldWithinSections(
  sections: FormSection[],
  fieldId: string,
  offset: -1 | 1,
): FormSection[] {
  const sectionIndex = sections.findIndex((section) =>
    section.fields.some((field) => field.id === fieldId),
  );
  if (sectionIndex < 0) return sections;

  const section = sections[sectionIndex];
  const fieldIndex = section.fields.findIndex((field) => field.id === fieldId);
  const targetIndex = fieldIndex + offset;
  if (targetIndex < 0 || targetIndex >= section.fields.length) return sections;

  const fields = [...section.fields];
  const [field] = fields.splice(fieldIndex, 1);
  fields.splice(targetIndex, 0, field);
  const nextSections = [...sections];
  nextSections[sectionIndex] = { ...section, fields };
  return nextSections;
}
