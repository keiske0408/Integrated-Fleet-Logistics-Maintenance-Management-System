import { validateFormDefinition } from './validation';
import type { FormDefinition } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseFormDefinitionImport(
  content: string,
  availableLovCodes: Set<string>,
): { definition: FormDefinition | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { definition: null, errors: ['Import file must contain valid JSON.'] };
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.key !== 'string' ||
    typeof parsed.name !== 'string' ||
    !Array.isArray(parsed.sections) ||
    !parsed.sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.id === 'string' &&
        typeof section.title === 'string' &&
        Array.isArray(section.fields),
    )
  ) {
    return { definition: null, errors: ['JSON does not contain a form definition.'] };
  }

  try {
    const definition = parsed as unknown as FormDefinition;
    const errors = validateFormDefinition(definition, availableLovCodes);
    return errors.length > 0 ? { definition: null, errors } : { definition, errors: [] };
  } catch {
    return { definition: null, errors: ['JSON does not contain a valid form definition.'] };
  }
}
