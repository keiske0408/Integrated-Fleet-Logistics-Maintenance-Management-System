import type { FormDefinition, FormField, WorkflowStage } from './types';

const STRICT_FIELD_ACCESS_ROLES = new Set(['department_requester', 'procurement', 'driver']);

export function projectFormForRoleStage(
  definition: FormDefinition,
  stage: WorkflowStage,
  role: string,
): { definition: FormDefinition; fieldAccess: Record<string, 'read' | 'edit'> } {
  const fieldAccess: Record<string, 'read' | 'edit'> = {};
  const projectFields = (fields: FormField[], prefix = ''): FormField[] =>
    fields.flatMap((field) => {
      const path = prefix ? `${prefix}.${field.key}` : field.key;
      const permission = stage.fieldPermissions?.[path]?.[role];
      if (
        permission === 'hidden' ||
        (permission === undefined && STRICT_FIELD_ACCESS_ROLES.has(role))
      ) {
        return [];
      }
      fieldAccess[path] = permission === 'edit' ? 'edit' : 'read';
      return [
        {
          ...field,
          ...(field.rowFields ? { rowFields: projectFields(field.rowFields, path) } : {}),
        },
      ];
    });

  return {
    definition: {
      ...definition,
      sections: definition.sections.map((section) => ({
        ...section,
        fields: projectFields(section.fields),
      })),
    },
    fieldAccess,
  };
}
