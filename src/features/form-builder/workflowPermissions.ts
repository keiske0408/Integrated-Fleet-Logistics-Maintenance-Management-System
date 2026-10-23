import type { StageFieldPermission, WorkflowStage } from './types';

export interface BulkSetPermissionsParams {
  stages: WorkflowStage[];
  stageIds: string[];
  role: string;
  access: StageFieldPermission | '';
  fields: Array<{ key: string }>;
}

/**
 * Bulk updates field permissions for a given role across multiple workflow stages.
 */
export function bulkSetFieldPermissions({
  stages,
  stageIds,
  role,
  access,
  fields,
}: BulkSetPermissionsParams): WorkflowStage[] {
  const targetSet = new Set(stageIds);
  return stages.map((stage) => {
    if (!targetSet.has(stage.id)) return stage;

    const currentPermissions = stage.fieldPermissions ?? {};
    const nextPermissions: Record<string, Record<string, StageFieldPermission>> = {};

    fields.forEach((field) => {
      const fieldRoles = { ...(currentPermissions[field.key] ?? {}) };
      if (access) {
        fieldRoles[role] = access;
      } else {
        delete fieldRoles[role];
      }
      if (Object.keys(fieldRoles).length > 0) {
        nextPermissions[field.key] = fieldRoles;
      }
    });

    return {
      ...stage,
      fieldPermissions: nextPermissions,
    };
  });
}

export interface BulkUpdateSingleFieldParams {
  stages: WorkflowStage[];
  stageIds: string[];
  role: string;
  fieldKey: string;
  access: StageFieldPermission | '';
}

/**
 * Updates a single field's permission for a given role across multiple workflow stages.
 */
export function bulkUpdateSingleFieldPermission({
  stages,
  stageIds,
  role,
  fieldKey,
  access,
}: BulkUpdateSingleFieldParams): WorkflowStage[] {
  const targetSet = new Set(stageIds);
  return stages.map((stage) => {
    if (!targetSet.has(stage.id)) return stage;

    const currentPermissions = stage.fieldPermissions ?? {};
    const currentRoles = currentPermissions[fieldKey] ?? {};
    const nextRoles = { ...currentRoles };

    if (access) {
      nextRoles[role] = access;
    } else {
      delete nextRoles[role];
    }

    const nextPermissions = { ...currentPermissions };
    if (Object.keys(nextRoles).length > 0) {
      nextPermissions[fieldKey] = nextRoles;
    } else {
      delete nextPermissions[fieldKey];
    }

    return {
      ...stage,
      fieldPermissions: nextPermissions,
    };
  });
}

export interface CopyStagePermissionsParams {
  stages: WorkflowStage[];
  sourceStageId: string;
  targetStageIds: string[];
  role?: string;
}

/**
 * Copies field permissions from a source stage to one or more target stages.
 * If `role` is provided, only that role's permissions are copied. Otherwise, all role permissions are copied.
 */
export function copyStagePermissions({
  stages,
  sourceStageId,
  targetStageIds,
  role,
}: CopyStagePermissionsParams): WorkflowStage[] {
  const sourceStage = stages.find((s) => s.id === sourceStageId);
  if (!sourceStage) return stages;

  const sourcePermissions = sourceStage.fieldPermissions ?? {};
  const targetSet = new Set(targetStageIds);

  return stages.map((stage) => {
    if (!targetSet.has(stage.id)) return stage;

    if (!role) {
      return {
        ...stage,
        fieldPermissions: structuredClone(sourcePermissions),
      };
    }

    const nextPermissions: Record<string, Record<string, StageFieldPermission>> = {
      ...(stage.fieldPermissions ? structuredClone(stage.fieldPermissions) : {}),
    };

    const allFieldKeys = new Set([
      ...Object.keys(sourcePermissions),
      ...Object.keys(nextPermissions),
    ]);

    allFieldKeys.forEach((key) => {
      const sourceRoleAccess = sourcePermissions[key]?.[role];
      const targetRoles = { ...(nextPermissions[key] ?? {}) };

      if (sourceRoleAccess) {
        targetRoles[role] = sourceRoleAccess;
        nextPermissions[key] = targetRoles;
      } else {
        delete targetRoles[role];
      }

      if (Object.keys(targetRoles).length > 0) {
        nextPermissions[key] = targetRoles;
      } else {
        delete nextPermissions[key];
      }
    });

    return {
      ...stage,
      fieldPermissions: nextPermissions,
    };
  });
}

/**
 * Returns the common permission across multiple stages, or 'mixed' if they differ.
 */
export function getAggregatedFieldPermission({
  stages,
  stageIds,
  role,
  fieldKey,
}: {
  stages: WorkflowStage[];
  stageIds: string[];
  role: string;
  fieldKey: string;
}): StageFieldPermission | '' | 'mixed' {
  const targetStages = stages.filter((s) => stageIds.includes(s.id));
  if (targetStages.length === 0) return '';

  const permissions = targetStages.map(
    (s) => (s.fieldPermissions?.[fieldKey]?.[role] ?? '') as StageFieldPermission | '',
  );
  const first = permissions[0];
  const allSame = permissions.every((p) => p === first);
  return allSame ? first : 'mixed';
}
