import React, { useCallback, useId, useMemo, useState, useTransition } from 'react';
import {
  Check,
  Copy,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { WORKFLOW_ROLES } from './WorkflowStageMatrix';
import { VersionReadAccess } from '../VersionReadAccess';
import {
  bulkSetFieldPermissions,
  bulkUpdateSingleFieldPermission,
  copyStagePermissions,
  getAggregatedFieldPermission,
} from '../workflowPermissions';
import type { FormDefinition, FormWorkflow, StageFieldPermission } from '../types';

export interface StageFieldAccessMatrixProps {
  workflow: FormWorkflow;
  fields: Array<{ key: string; label: string }>;
  permissionRole: string;
  setPermissionRole: (role: string) => void;
  permissionStageId: string;
  setPermissionStageId: (stageId: string) => void;
  isBulkStageMode: boolean;
  setIsBulkStageMode: (bulk: boolean | ((prev: boolean) => boolean)) => void;
  bulkSelectedStageIds: string[];
  setBulkSelectedStageIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateWorkflow: (updates: Partial<FormWorkflow>) => void;
  definition: FormDefinition;
  selectedVersionId: string | null;
  currentUser?: { role?: string; id?: string; name?: string } | null;
  isLoading?: boolean;
}

/**
 * High-performance Shimmer Skeleton for Stage Field Access Matrix.
 */
export const StageFieldAccessSkeleton: React.FC<{ subtitle?: string }> = ({
  subtitle = 'Configuring Stage Field Access Matrix...',
}) => {
  return (
    <Card className="animate-fade-in border-border/70 overflow-hidden shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-48 rounded-md bg-muted/80 animate-pulse" />
              <div className="h-4 w-24 rounded-full bg-muted/60 animate-pulse" />
            </div>
            <div className="h-3 w-80 rounded-md bg-muted/60 animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="h-8 w-24 rounded-lg bg-muted/70 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-muted/70 animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
            <div className="h-8 w-36 rounded-lg bg-muted/70 animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Filter & Controls Skeleton */}
        <div className="space-y-3 rounded-lg border border-border/60 p-3.5 bg-muted/20">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 space-y-1.5 flex-1 sm:flex-initial">
              <div className="h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/60 animate-pulse" />
            </div>
            <div className="min-w-56 space-y-1.5 flex-1 sm:flex-initial">
              <div className="h-3.5 w-20 rounded bg-muted/70 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/60 animate-pulse" />
            </div>
            <div className="flex-1 min-w-48 space-y-1.5">
              <div className="h-3.5 w-20 rounded bg-muted/70 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/60 animate-pulse" />
            </div>
          </div>
          <div className="h-3.5 w-64 rounded bg-muted/50 animate-pulse pt-1" />
        </div>

        {/* Shimmering Center Status Badge */}
        <div className="flex items-center justify-center gap-2.5 py-2.5 text-xs text-muted-foreground animate-fade-in">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium text-foreground">{subtitle}</span>
        </div>

        {/* Field Rows Skeleton Grid */}
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-border/50 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div
                  className="h-4 rounded bg-muted/80 animate-pulse"
                  style={{ width: `${Math.floor(45 + (i % 4) * 12)}%` }}
                />
                <div
                  className="h-3 rounded bg-muted/50 animate-pulse"
                  style={{ width: `${Math.floor(25 + (i % 3) * 10)}%` }}
                />
              </div>
              <div className="h-8 w-36 rounded-md bg-muted/70 shrink-0 animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const StageFieldAccessMatrix: React.FC<StageFieldAccessMatrixProps> = React.memo(
  ({
    workflow,
    fields,
    permissionRole,
    setPermissionRole,
    permissionStageId,
    setPermissionStageId,
    isBulkStageMode,
    setIsBulkStageMode,
    bulkSelectedStageIds,
    setBulkSelectedStageIds,
    updateWorkflow,
    definition,
    selectedVersionId,
    currentUser,
    isLoading = false,
  }) => {
    const { success: toastSuccess, warning: toastWarning } = useToast();
    // Internal localized search state to prevent re-rendering the parent form builder
    const [fieldSearch, setFieldSearch] = useState('');
    const [isSwitchingStage, setIsSwitchingStage] = useState(false);
    const [, startTransition] = useTransition();

    // Copy permissions modal state
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copySourceStageId, setCopySourceStageId] = useState('');
    const [copyTargetStageIds, setCopyTargetStageIds] = useState<string[]>([]);
    const [copyScope, setCopyScope] = useState<'current_role' | 'all_roles'>('current_role');

    const searchInputId = useId();
    const stageSelectId = useId();
    const roleSelectId = useId();

    // Memoize valid selected stage IDs for bulk mode
    const validBulkStageIds = useMemo(
      () => bulkSelectedStageIds.filter((id) => workflow.stages.some((stage) => stage.id === id)),
      [bulkSelectedStageIds, workflow.stages],
    );

    // Memoize the selected single stage
    const selectedPermissionStage = useMemo(
      () =>
        workflow.stages.find((stage) => stage.id === permissionStageId) ?? workflow.stages[0],
      [workflow.stages, permissionStageId],
    );

    // Pre-calculate aggregated permissions map for O(1) row lookups in bulk mode
    const aggregatedPermissionsMap = useMemo(() => {
      if (!isBulkStageMode || validBulkStageIds.length === 0) {
        return {} as Record<string, StageFieldPermission | '' | 'mixed'>;
      }
      const map: Record<string, StageFieldPermission | '' | 'mixed'> = {};
      for (const field of fields) {
        map[field.key] = getAggregatedFieldPermission({
          stages: workflow.stages,
          stageIds: validBulkStageIds,
          role: permissionRole,
          fieldKey: field.key,
        });
      }
      return map;
    }, [isBulkStageMode, validBulkStageIds, workflow.stages, permissionRole, fields]);

    // Pre-calculate single stage permissions map for O(1) row lookups in single mode
    const singleStagePermissionsMap = useMemo(() => {
      if (isBulkStageMode || !selectedPermissionStage?.fieldPermissions) {
        return {} as Record<string, StageFieldPermission | ''>;
      }
      const map: Record<string, StageFieldPermission | ''> = {};
      for (const field of fields) {
        map[field.key] =
          (selectedPermissionStage.fieldPermissions[field.key]?.[permissionRole] as
            | StageFieldPermission
            | undefined) ?? '';
      }
      return map;
    }, [isBulkStageMode, selectedPermissionStage, permissionRole, fields]);

    // Memoize active custom overrides count for single stage mode
    const activeOverridesCount = useMemo(() => {
      if (isBulkStageMode || !selectedPermissionStage?.fieldPermissions) return 0;
      return fields.filter(
        (f) => Boolean(selectedPermissionStage.fieldPermissions?.[f.key]?.[permissionRole]),
      ).length;
    }, [isBulkStageMode, selectedPermissionStage, permissionRole, fields]);

    // Memoize filtered fields based on search query
    const filteredFields = useMemo(() => {
      const query = fieldSearch.trim().toLowerCase();
      if (!query) return fields;
      return fields.filter(
        (field) =>
          field.label.toLowerCase().includes(query) || field.key.toLowerCase().includes(query),
      );
    }, [fields, fieldSearch]);

    // Handle changing the workflow stage with a smooth micro-transition
    const handleStageChange = useCallback(
      (newStageId: string) => {
        if (newStageId === '__bulk_all__') {
          setIsBulkStageMode(true);
          setBulkSelectedStageIds(workflow.stages.map((s) => s.id));
          return;
        }
        setIsSwitchingStage(true);
        startTransition(() => {
          setPermissionStageId(newStageId);
        });
        window.setTimeout(() => {
          setIsSwitchingStage(false);
        }, 160);
      },
      [workflow.stages, setIsBulkStageMode, setBulkSelectedStageIds, setPermissionStageId],
    );

    // Handle changing the actor role with a smooth micro-transition
    const handleRoleChange = useCallback(
      (newRole: string) => {
        setIsSwitchingStage(true);
        startTransition(() => {
          setPermissionRole(newRole);
        });
        window.setTimeout(() => {
          setIsSwitchingStage(false);
        }, 160);
      },
      [setPermissionRole],
    );

    // Update single field permission
    const updateFieldPermission = useCallback(
      (fieldKey: string, permission: '' | 'edit' | 'read' | 'hidden') => {
        const targetStageIds = isBulkStageMode
          ? validBulkStageIds
          : selectedPermissionStage
            ? [selectedPermissionStage.id]
            : [];

        if (targetStageIds.length === 0) {
          toastWarning('Please select at least one workflow stage.');
          return;
        }

        const updatedStages = bulkUpdateSingleFieldPermission({
          stages: workflow.stages,
          stageIds: targetStageIds,
          role: permissionRole,
          fieldKey,
          access: permission,
        });
        updateWorkflow({ stages: updatedStages });
      },
      [isBulkStageMode, validBulkStageIds, selectedPermissionStage, workflow.stages, permissionRole, updateWorkflow],
    );

    // Set all fields to edit, read, or reset
    const setAllFieldPermissions = useCallback(
      (access: '' | 'edit' | 'read' | 'hidden') => {
        const targetStageIds = isBulkStageMode
          ? validBulkStageIds
          : selectedPermissionStage
            ? [selectedPermissionStage.id]
            : [];

        if (targetStageIds.length === 0) {
          toastWarning('Please select at least one workflow stage.');
          return;
        }

        const updatedStages = bulkSetFieldPermissions({
          stages: workflow.stages,
          stageIds: targetStageIds,
          role: permissionRole,
          access,
          fields,
        });
        updateWorkflow({ stages: updatedStages });

        const accessLabel =
          access === 'edit'
            ? 'Editable'
            : access === 'read'
              ? 'Read-Only'
              : access === 'hidden'
                ? 'Hidden'
                : 'Default (Inherited)';
        toastSuccess(
          `Set all fields to ${accessLabel} across ${targetStageIds.length} stage${targetStageIds.length > 1 ? 's' : ''} for ${permissionRole.replaceAll('_', ' ')}.`,
        );
      },
      [isBulkStageMode, validBulkStageIds, selectedPermissionStage, workflow.stages, permissionRole, fields, updateWorkflow],
    );

    // Open copy permissions modal
    const openCopyModal = useCallback(() => {
      setCopySourceStageId(selectedPermissionStage?.id ?? workflow.stages[0]?.id ?? '');
      setCopyTargetStageIds([]);
      setCopyScope('current_role');
      setShowCopyModal(true);
    }, [selectedPermissionStage, workflow.stages]);

    // Execute copy permissions
    const executeCopyPermissions = useCallback(() => {
      if (!copySourceStageId) {
        toastWarning('Please select a source stage to copy from.');
        return;
      }
      if (copyTargetStageIds.length === 0) {
        toastWarning('Please select at least one target stage to copy permissions to.');
        return;
      }

      const updatedStages = copyStagePermissions({
        stages: workflow.stages,
        sourceStageId: copySourceStageId,
        targetStageIds: copyTargetStageIds,
        role: copyScope === 'current_role' ? permissionRole : undefined,
      });

      updateWorkflow({ stages: updatedStages });
      setShowCopyModal(false);
      const sourceLabel =
        workflow.stages.find((s) => s.id === copySourceStageId)?.label ?? copySourceStageId;
      toastSuccess(
        `Copied permissions from "${sourceLabel}" to ${copyTargetStageIds.length} target stage${copyTargetStageIds.length > 1 ? 's' : ''}${copyScope === 'current_role' ? ` for ${permissionRole.replaceAll('_', ' ')}` : ' for all roles'}.`,
      );
    }, [copySourceStageId, copyTargetStageIds, copyScope, workflow.stages, permissionRole, updateWorkflow]);

    if (isLoading) {
      return (
        <div className="space-y-4">
          <StageFieldAccessSkeleton subtitle="Loading Stage Field Access Matrix..." />
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <Card className="border-border/80 shadow-sm overflow-hidden transition-all duration-200">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Stage Field Access Control</span>
                  {isBulkStageMode && (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      Bulk Mode ({validBulkStageIds.length} stages)
                    </Badge>
                  )}
                  {isSwitchingStage && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure field-level visibility and editability per workflow stage and actor role
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAllFieldPermissions('edit')}
                  disabled={isBulkStageMode && validBulkStageIds.length === 0}
                  title={
                    isBulkStageMode
                      ? `Set all fields to Editable across ${validBulkStageIds.length} selected stages`
                      : 'Set all fields to Editable for this stage'
                  }
                >
                  All Editable
                  {isBulkStageMode && validBulkStageIds.length > 0
                    ? ` (${validBulkStageIds.length})`
                    : ''}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAllFieldPermissions('read')}
                  disabled={isBulkStageMode && validBulkStageIds.length === 0}
                  title={
                    isBulkStageMode
                      ? `Set all fields to Read-Only across ${validBulkStageIds.length} selected stages`
                      : 'Set all fields to Read-Only for this stage'
                  }
                >
                  All Read-Only
                  {isBulkStageMode && validBulkStageIds.length > 0
                    ? ` (${validBulkStageIds.length})`
                    : ''}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAllFieldPermissions('')}
                  disabled={isBulkStageMode && validBulkStageIds.length === 0}
                  title={
                    isBulkStageMode
                      ? `Reset field overrides across ${validBulkStageIds.length} selected stages`
                      : 'Reset field overrides for this stage'
                  }
                >
                  Reset Overrides
                  {isBulkStageMode && validBulkStageIds.length > 0
                    ? ` (${validBulkStageIds.length})`
                    : ''}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={openCopyModal}
                  title="Duplicate permissions from one stage to other stages"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Permissions...
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Control & Filter Strip */}
            <div className="space-y-3 rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-60 flex-1 sm:flex-initial">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor={stageSelectId} className="block text-xs font-semibold">
                      Workflow Stage
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isBulkStageMode) {
                          setIsBulkStageMode(true);
                          if (validBulkStageIds.length === 0) {
                            setBulkSelectedStageIds(workflow.stages.map((s) => s.id));
                          }
                        } else {
                          setIsBulkStageMode(false);
                        }
                      }}
                      className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Layers className="h-3 w-3" />
                      {isBulkStageMode ? 'Single Stage View' : 'Bulk Select Stages'}
                    </button>
                  </div>
                  {!isBulkStageMode ? (
                    <Select
                      id={stageSelectId}
                      value={selectedPermissionStage?.id ?? ''}
                      onChange={(event) => handleStageChange(event.target.value)}
                    >
                      <option value="__bulk_all__">⚡ Select Multiple / All Stages...</option>
                      {workflow.stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1.5 h-9">
                      <Badge variant="default" className="text-xs py-1 px-2.5 font-medium">
                        Bulk: {validBulkStageIds.length} of {workflow.stages.length} Stages
                      </Badge>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                        onClick={() => setIsBulkStageMode(false)}
                      >
                        Single Stage
                      </button>
                    </div>
                  )}
                </div>

                <div className="min-w-56 flex-1 sm:flex-initial">
                  <label htmlFor={roleSelectId} className="mb-1 block text-xs font-semibold">
                    Actor Role
                  </label>
                  <Select
                    id={roleSelectId}
                    value={permissionRole}
                    onChange={(event) => handleRoleChange(event.target.value)}
                  >
                    {WORKFLOW_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex-1 min-w-48">
                  <label htmlFor={searchInputId} className="mb-1 block text-xs font-semibold">
                    Filter Fields
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id={searchInputId}
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      placeholder="Search by field name or key..."
                      className="h-9 pl-8 pr-8 text-xs bg-background"
                    />
                    {fieldSearch && (
                      <button
                        type="button"
                        onClick={() => setFieldSearch('')}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Clear filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Stage Selector Chips */}
              {isBulkStageMode && (
                <div className="pt-2.5 border-t border-border/60 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Select Workflow Stages to Bulk Update:
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium cursor-pointer"
                        onClick={() => setBulkSelectedStageIds(workflow.stages.map((s) => s.id))}
                      >
                        Select All ({workflow.stages.length})
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline cursor-pointer"
                        onClick={() => setBulkSelectedStageIds([])}
                      >
                        Clear All
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline cursor-pointer"
                        onClick={() =>
                          setBulkSelectedStageIds(
                            workflow.stages
                              .filter((s) => !bulkSelectedStageIds.includes(s.id))
                              .map((s) => s.id),
                          )
                        }
                      >
                        Invert
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {workflow.stages.map((stage) => {
                      const isSelected = validBulkStageIds.includes(stage.id);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => {
                            setBulkSelectedStageIds((prev) =>
                              prev.includes(stage.id)
                                ? prev.filter((id) => id !== stage.id)
                                : [...prev, stage.id],
                            );
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <div className="h-2.5 w-2.5 rounded-[2px] border border-muted-foreground/50" />
                          )}
                          {stage.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded bg-primary/10 border border-primary/20 px-3 py-1.5 text-[11px] text-foreground flex items-center justify-between">
                    <span>
                      ⚡ <strong>Bulk Mode Active:</strong> Clicking &quot;All Editable&quot;, &quot;All Read-Only&quot;, or changing any field dropdown below updates all{' '}
                      <strong>{validBulkStageIds.length}</strong> selected stages for role <em>&quot;{permissionRole.replaceAll('_', ' ')}&quot;</em>.
                    </span>
                    {validBulkStageIds.length === 0 && (
                      <span className="text-amber-500 font-semibold ml-2">
                        Select at least one stage!
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Single Stage Status Line */}
              {!isBulkStageMode && (
                <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <span>
                    Viewing permissions for stage <strong>&quot;{selectedPermissionStage?.label}&quot;</strong> and role <strong>&quot;{permissionRole.replaceAll('_', ' ')}&quot;</strong>.
                  </span>
                  <span className="font-mono text-[10px] bg-muted/60 px-2 py-0.5 rounded border border-border">
                    {activeOverridesCount > 0
                      ? `✓ ${activeOverridesCount} custom overrides active`
                      : 'Inheriting role default (no stage overrides)'}
                  </span>
                </div>
              )}
            </div>

            {/* Field Matrix List */}
            <div
              className={cn(
                'grid gap-x-6 gap-y-2 sm:grid-cols-2 transition-opacity duration-150',
                isSwitchingStage && 'opacity-60 pointer-events-none',
              )}
            >
              {filteredFields.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                  No fields match &quot;{fieldSearch}&quot;.
                </div>
              ) : (
                filteredFields.map((field) => {
                  const fieldVal = isBulkStageMode
                    ? (aggregatedPermissionsMap[field.key] ?? '')
                    : (singleStagePermissionsMap[field.key] ?? '');

                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 hover:bg-muted/30 px-1 rounded transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{field.label}</p>
                        <p className="truncate text-xs font-mono text-muted-foreground">
                          {field.key}
                        </p>
                      </div>
                      <Select
                        aria-label={`${field.label} access for ${permissionRole}`}
                        className="w-40 h-8 text-xs shrink-0"
                        value={fieldVal}
                        disabled={isBulkStageMode && validBulkStageIds.length === 0}
                        onChange={(event) =>
                          updateFieldPermission(
                            field.key,
                            event.target.value as '' | 'edit' | 'read' | 'hidden',
                          )
                        }
                      >
                        {isBulkStageMode && fieldVal === 'mixed' && (
                          <option value="mixed" disabled>
                            (Mixed - Select to apply to all)
                          </option>
                        )}
                        <option value="">Default (Inherited)</option>
                        <option value="edit">Editable</option>
                        <option value="read">Read Only</option>
                        <option value="hidden">Hidden</option>
                      </Select>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Historical Read Access for Published Versions */}
        {definition.status !== 'draft' &&
          selectedVersionId &&
          currentUser?.role === 'system_admin' && (
            <VersionReadAccess
              versionId={selectedVersionId}
              definition={definition}
              workflow={workflow}
            />
          )}

        {/* Copy Permissions Dialog */}
        <Dialog
          open={showCopyModal}
          onOpenChange={setShowCopyModal}
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              Copy Stage Field Permissions
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Duplicate field access configuration from one workflow stage to other stages.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-foreground">Source Stage</label>
              <Select
                value={copySourceStageId}
                onChange={(e) => setCopySourceStageId(e.target.value)}
                className="h-8 text-xs"
              >
                {workflow.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-foreground">Target Stages</label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    className="text-primary hover:underline cursor-pointer"
                    onClick={() =>
                      setCopyTargetStageIds(
                        workflow.stages.filter((s) => s.id !== copySourceStageId).map((s) => s.id),
                      )
                    }
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline cursor-pointer"
                    onClick={() => setCopyTargetStageIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-2 bg-muted/20">
                {workflow.stages
                  .filter((stage) => stage.id !== copySourceStageId)
                  .map((stage) => {
                    const isChecked = copyTargetStageIds.includes(stage.id);
                    return (
                      <label
                        key={stage.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setCopyTargetStageIds((prev) =>
                              prev.includes(stage.id)
                                ? prev.filter((id) => id !== stage.id)
                                : [...prev, stage.id],
                            )
                          }
                          className="rounded border-input text-primary"
                        />
                        <span className="font-medium text-foreground">{stage.label}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-foreground">Role Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCopyScope('current_role')}
                  className={cn(
                    'rounded-md border p-2 text-left text-xs transition-colors cursor-pointer',
                    copyScope === 'current_role'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/30',
                  )}
                >
                  <div>Current Role Only</div>
                  <div className="text-[10px] opacity-80 mt-0.5 truncate">
                    {permissionRole.replaceAll('_', ' ')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCopyScope('all_roles')}
                  className={cn(
                    'rounded-md border p-2 text-left text-xs transition-colors cursor-pointer',
                    copyScope === 'all_roles'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/30',
                  )}
                >
                  <div>All Actor Roles</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Copies full matrix</div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCopyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={executeCopyPermissions}
              disabled={copyTargetStageIds.length === 0}
            >
              Apply Copy ({copyTargetStageIds.length})
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    );
  },
);

StageFieldAccessMatrix.displayName = 'StageFieldAccessMatrix';
