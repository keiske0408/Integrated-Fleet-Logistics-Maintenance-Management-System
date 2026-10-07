import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Copy,
  Download,
  GripVertical,
  Eye,
  Save,
  Send,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormRenderer } from './FormRenderer';
import { TSRF_V1, TSRF_WORKFLOW } from './seed';
import { useLov } from '@/features/lov';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { validateFormDefinition, validateFormWorkflow } from './validation';
import { projectFormForRoleStage } from './preview';
import type {
  FieldType,
  FormDefinition,
  FormField,
  FormWorkflow,
  SystemStatusCategory,
} from './types';
import type { FieldRule, RuleOperator } from './rules';
import { moveFieldWithinSections } from './reorder';
import { parseFormDefinitionImport } from './importSchema';
import { diffFormDefinitions } from './versionDiff';
import { createEditorHistory, editorHistoryReducer } from './editorHistory';
import { formatFieldOptions, parseFieldOptions } from './fieldConfiguration';

const PALETTE: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'select', label: 'Select' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'repeater', label: 'Repeater' },
  { type: 'lookup', label: 'LOV Lookup' },
  { type: 'entity_lookup', label: 'Fleet Vehicle' },
  { type: 'notice', label: 'Notice' },
];
const WORKFLOW_ROLES = [
  'department_requester',
  'approver',
  'finance',
  'fleet_team',
  'procurement',
  'admin',
];
const STATUS_CATEGORIES: SystemStatusCategory[] = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

function flattenPermissionFields(
  fields: FormField[],
  prefix = '',
): Array<{ key: string; label: string }> {
  return fields.flatMap((field) => {
    const key = prefix ? `${prefix}.${field.key}` : field.key;
    return [
      { key, label: `${prefix ? `${prefix} / ` : ''}${field.label}` },
      ...flattenPermissionFields(field.rowFields ?? [], key),
    ];
  });
}

function collectFieldIds(fields: FormField[]): string[] {
  return fields.flatMap((field) => [field.id, ...collectFieldIds(field.rowFields ?? [])]);
}

function cloneDefinition(): FormDefinition {
  return structuredClone(TSRF_V1);
}

export function FormBuilderPage() {
  const {
    version: routeVersion,
    role: routeRole,
    stage: routeStage,
  } = useParams<{
    version?: string;
    role?: string;
    stage?: string;
  }>();
  const navigate = useNavigate();
  const [editorHistory, dispatchEditorHistory] = useReducer(
    editorHistoryReducer,
    {
      definition: cloneDefinition(),
      workflow: structuredClone(TSRF_WORKFLOW),
    },
    createEditorHistory,
  );
  const definition = editorHistory.present.definition;
  const workflow = editorHistory.present.workflow;
  const [editRevision, setEditRevision] = useState(0);
  const [isDefinitionLoaded, setIsDefinitionLoaded] = useState(false);
  const savedRevisionRef = useRef(0);
  const autosaveErrorRevisionRef = useRef<number | null>(null);
  const saveDraftRef = useRef<(automatic: boolean, revision: number) => Promise<void>>(
    async () => undefined,
  );
  const setDefinition = (update: React.SetStateAction<FormDefinition>) => {
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'update',
      update: (snapshot) => ({
        ...snapshot,
        definition: typeof update === 'function' ? update(snapshot.definition) : update,
      }),
    });
  };
  const setWorkflow = (update: React.SetStateAction<FormWorkflow>) => {
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'update',
      update: (snapshot) => ({
        ...snapshot,
        workflow: typeof update === 'function' ? update(snapshot.workflow) : update,
      }),
    });
  };
  const [selectedId, setSelectedId] = useState(definition.sections[1]?.fields[0]?.id ?? '');
  const [preview, setPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [publishedFieldIds, setPublishedFieldIds] = useState<Set<string>>(() => new Set());
  const [publishedBaseline, setPublishedBaseline] = useState<FormDefinition | null>(null);
  const [availableVersions, setAvailableVersions] = useState<
    Array<{ version: number; status: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionRole, setPermissionRole] = useState('department_requester');
  const [permissionStageId, setPermissionStageId] = useState('dispatch_assignment');
  const { lists } = useLov();
  const { currentUser } = useAuth();
  const fields = definition.sections.flatMap((section) => section.fields);
  const selectedField = fields.find((field) => field.id === selectedId);
  const permissionFields = flattenPermissionFields(fields);
  const selectedPermissionStage =
    workflow.stages.find((stage) => stage.id === permissionStageId) ?? workflow.stages[0];
  const previewProjection = selectedPermissionStage
    ? projectFormForRoleStage(definition, selectedPermissionStage, permissionRole)
    : { definition, fieldAccess: {} };
  const versionChanges =
    definition.status === 'draft' && publishedBaseline
      ? diffFormDefinitions(publishedBaseline, definition)
      : [];
  const previewUrl = (role: string, stageId: string) =>
    `/form-builder/preview/${encodeURIComponent(role)}/${encodeURIComponent(stageId)}${routeVersion ? `/${encodeURIComponent(routeVersion)}` : ''}`;
  const openPreview = () => {
    const stageId = selectedPermissionStage?.id ?? workflow.initialStage;
    navigate(previewUrl(permissionRole, stageId));
  };
  const leavePreview = () => {
    setPreview(false);
    navigate(routeVersion ? `/form-builder/versions/${routeVersion}` : '/form-builder');
  };
  const selectVersion = (version: string) => {
    if (saving || editRevision > savedRevisionRef.current) {
      setMessage('Save the current changes before switching versions.');
      return;
    }
    navigate(version === 'working' ? '/form-builder' : `/form-builder/versions/${version}`);
  };

  useEffect(() => {
    if (!isDefinitionLoaded) return;
    if (!routeRole && !routeStage) {
      setPreview(false);
      return;
    }
    if (
      !routeRole ||
      !routeStage ||
      !WORKFLOW_ROLES.includes(routeRole) ||
      !workflow.stages.some((stage) => stage.id === routeStage)
    ) {
      navigate('/form-builder', { replace: true });
      return;
    }
    setPermissionRole(routeRole);
    setPermissionStageId(routeStage);
    setPreview(true);
  }, [isDefinitionLoaded, navigate, routeRole, routeStage, workflow.stages]);

  useEffect(() => {
    let cancelled = false;
    setIsDefinitionLoaded(false);
    apiFetch(`/api/forms/${encodeURIComponent(definition.key)}`)
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Unable to load saved form versions.');
        return response.json();
      })
      .then((saved) => {
        if (cancelled) return;
        if (!saved) {
          setIsDefinitionLoaded(true);
          return;
        }
        setDefinitionId(saved.id);
        const versions = [...saved.versions].sort((a, b) => b.version - a.version);
        setAvailableVersions(
          versions.map((version) => ({ version: version.version, status: version.status })),
        );
        const published = versions.find((version) => version.status === 'published');
        setPublishedBaseline(
          published?.schema
            ? { ...published.schema, version: published.version, status: 'published' }
            : null,
        );
        setPublishedFieldIds(
          published?.schema
            ? new Set(
                collectFieldIds(
                  published.schema.sections.flatMap(
                    (section: { fields?: FormField[] }) => section.fields ?? [],
                  ),
                ),
              )
            : new Set(),
        );
        const activeDraft = versions.find((version) => version.status === 'draft');
        const requestedVersion = routeVersion
          ? versions.find((version) => String(version.version) === routeVersion)
          : undefined;
        if (routeVersion && !requestedVersion)
          setMessage(`Form version ${routeVersion} was not found.`);
        const selected =
          requestedVersion ??
          activeDraft ??
          versions.find((version) => version.status === 'published');
        if (selected?.schema) {
          savedRevisionRef.current = 0;
          setEditRevision(0);
          dispatchEditorHistory({
            type: 'reset',
            snapshot: {
              definition: {
                ...selected.schema,
                version: selected.version,
                status: selected.status,
              },
              workflow: selected.workflow?.stages
                ? selected.workflow
                : structuredClone(TSRF_WORKFLOW),
            },
          });
          setDraftVersionId(selected.status === 'draft' ? selected.id : null);
          setSelectedId(selected.schema.sections[1]?.fields[0]?.id ?? '');
        }
        setIsDefinitionLoaded(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Unable to load form definition.');
          setIsDefinitionLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, definition.key, routeVersion]);

  const saveDraft = async (automatic = false, revision = editRevision) => {
    if (saving) return;
    setSaving(true);
    if (!automatic) setMessage(null);
    try {
      const draft = { ...definition, status: 'draft' as const };
      let response: Response;
      if (!definitionId) {
        response = await apiFetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: draft.key, name: draft.name, schema: draft, workflow }),
        });
      } else if (draftVersionId) {
        response = await apiFetch(`/api/forms/versions/${encodeURIComponent(draftVersionId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft, workflow }),
        });
      } else {
        response = await apiFetch(`/api/forms/${encodeURIComponent(definitionId)}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft, workflow }),
        });
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save draft.');
      const resolvedDefId = result.formDefinitionId ?? (result.version ? result.id : definitionId);
      if (resolvedDefId) setDefinitionId(resolvedDefId);
      const version = result.version ?? result;
      setDraftVersionId(version.id);
      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      autosaveErrorRevisionRef.current = null;
      dispatchEditorHistory({
        type: 'replace-present',
        update: (snapshot) => ({
          ...snapshot,
          definition: { ...snapshot.definition, version: version.version, status: 'draft' },
        }),
      });
      setMessage(`Draft v${version.version} ${automatic ? 'autosaved' : 'saved'}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to save draft.';
      if (automatic) autosaveErrorRevisionRef.current = revision;
      setMessage(automatic ? `Autosave failed: ${detail} Use Save Draft to retry.` : detail);
    } finally {
      setSaving(false);
    }
  };
  saveDraftRef.current = saveDraft;

  useEffect(() => {
    if (
      !isDefinitionLoaded ||
      saving ||
      editRevision <= savedRevisionRef.current ||
      autosaveErrorRevisionRef.current === editRevision
    ) {
      return;
    }
    const revision = editRevision;
    const timer = window.setTimeout(() => {
      void saveDraftRef.current(true, revision);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editRevision, isDefinitionLoaded, saving]);

  const publish = async () => {
    const errors = [
      ...validateFormDefinition(definition, new Set(lists.map((list) => list.code))),
      ...validateFormWorkflow(workflow, fields),
    ];
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    if (!draftVersionId) {
      setMessage('Save a draft before publishing.');
      return;
    }
    if (editRevision > savedRevisionRef.current) {
      setMessage('Wait for the current draft changes to save before publishing.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(draftVersionId)}/publish`,
        { method: 'POST' },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to publish form.');
      const published = { ...definition, version: result.version, status: 'published' as const };
      savedRevisionRef.current = editRevision;
      dispatchEditorHistory({
        type: 'reset',
        snapshot: { definition: published, workflow },
      });
      setPublishedBaseline(published);
      setPublishedFieldIds(new Set(collectFieldIds(fields)));
      setDraftVersionId(null);
      setMessage(`Form v${result.version} published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish form.');
    } finally {
      setSaving(false);
    }
  };

  const undoEdit = () => {
    if (editorHistory.past.length === 0) return;
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({ type: 'undo' });
  };
  const redoEdit = () => {
    if (editorHistory.future.length === 0) return;
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({ type: 'redo' });
  };
  const updateField = (updates: Partial<FormField>) =>
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === selectedId ? { ...field, ...updates } : field,
        ),
      })),
    }));
  const updateRules = (rules: FieldRule[]) => updateField({ rules });
  const updateWorkflow = (updates: Partial<FormWorkflow>) =>
    setWorkflow((current) => ({ ...current, ...updates }));
  const updateStage = (index: number, updates: Partial<FormWorkflow['stages'][number]>) =>
    updateWorkflow({
      stages: workflow.stages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...updates } : stage,
      ),
    });
  const updateTransition = (index: number, updates: Partial<FormWorkflow['transitions'][number]>) =>
    updateWorkflow({
      transitions: workflow.transitions.map((transition, transitionIndex) =>
        transitionIndex === index ? { ...transition, ...updates } : transition,
      ),
    });
  const updateFieldPermission = (fieldKey: string, permission: '' | 'edit' | 'read' | 'hidden') => {
    if (!selectedPermissionStage) return;
    const stageIndex = workflow.stages.findIndex(
      (stage) => stage.id === selectedPermissionStage.id,
    );
    const currentFieldPermissions = selectedPermissionStage.fieldPermissions ?? {};
    const currentRoles = currentFieldPermissions[fieldKey] ?? {};
    const nextRoles = { ...currentRoles };
    if (permission) nextRoles[permissionRole] = permission;
    else delete nextRoles[permissionRole];
    const nextFieldPermissions = { ...currentFieldPermissions };
    if (Object.keys(nextRoles).length) nextFieldPermissions[fieldKey] = nextRoles;
    else delete nextFieldPermissions[fieldKey];
    updateStage(stageIndex, { fieldPermissions: nextFieldPermissions });
  };
  const addField = (type: FieldType) => {
    const field: FormField = {
      id: `field-${Date.now()}`,
      key: `new_field_${fields.length + 1}`,
      type,
      label: `New ${type} field`,
      section: 'trip-details',
      required: false,
      ...(type === 'select' ? { options: [{ value: 'option_1', label: 'Option 1' }] } : {}),
      ...(type === 'repeater'
        ? {
            minRows: 0,
            rowFields: [
              {
                id: `field-${Date.now()}-row-1`,
                key: 'item',
                type: 'text' as const,
                label: 'Item',
                section: 'trip-details',
              },
            ],
          }
        : {}),
      ...(type === 'entity_lookup'
        ? {
            dataSource: {
              kind: 'entity' as const,
              entity: 'vehicles' as const,
              valueField: 'id' as const,
              labelField: 'plateNumber' as const,
            },
          }
        : {}),
    };
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === 'trip-details'
          ? { ...section, fields: [...section.fields, field] }
          : section,
      ),
    }));
    setSelectedId(field.id);
  };
  const moveField = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        const from = section.fields.findIndex((field) => field.id === draggedId);
        const to = section.fields.findIndex((field) => field.id === targetId);
        if (from < 0 || to < 0) return section;
        const next = [...section.fields];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...section, fields: next };
      }),
    }));
    setDraggedId(null);
  };
  const moveFieldByOffset = (fieldId: string, offset: -1 | 1) =>
    setDefinition((current) => ({
      ...current,
      sections: moveFieldWithinSections(current.sections, fieldId, offset),
    }));
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${definition.key}-v${definition.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const result = parseFormDefinitionImport(
        await file.text(),
        new Set(lists.map((list) => list.code)),
      );
      if (!result.definition) {
        setMessage(result.errors.join(' '));
        return;
      }
      if (result.definition.key !== definition.key) {
        setMessage(
          `This file is for "${result.definition.key}"; the current form is "${definition.key}".`,
        );
        return;
      }
      const imported = {
        ...result.definition,
        version: definition.version,
        status: 'draft' as const,
      };
      setDefinition(imported);
      setSelectedId(
        imported.sections.find((section) => section.fields.length > 0)?.fields[0].id ?? '',
      );
      setMessage('Schema imported locally. Save Draft to persist the changes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read the JSON file.');
    }
  };

  if (preview)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Preview: {definition.name}</h1>
          <Button variant="outline" onClick={leavePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Back to Design
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="min-w-48">
            <label htmlFor="preview-stage" className="mb-1 block text-xs font-semibold">
              Workflow stage
            </label>
            <Select
              id="preview-stage"
              value={selectedPermissionStage?.id ?? ''}
              onChange={(event) => {
                const stageId = event.target.value;
                setPermissionStageId(stageId);
                navigate(previewUrl(permissionRole, stageId));
              }}
            >
              {workflow.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-48">
            <label htmlFor="preview-role" className="mb-1 block text-xs font-semibold">
              Role
            </label>
            <Select
              id="preview-role"
              value={permissionRole}
              onChange={(event) => {
                const role = event.target.value;
                setPermissionRole(role);
                navigate(previewUrl(role, selectedPermissionStage?.id ?? workflow.initialStage));
              }}
            >
              {WORKFLOW_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FormRenderer
          definition={previewProjection.definition}
          fieldAccess={previewProjection.fieldAccess}
          onSubmit={() => undefined}
          submitLabel="Preview"
        />
      </div>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Form Builder</h1>
          <p className="text-sm text-muted-foreground">
            Design {definition.name} v{definition.version} · {definition.status}
          </p>
        </div>
        <div className="flex gap-2">
          {availableVersions.length > 0 && (
            <div>
              <label htmlFor="form-version" className="sr-only">
                Form version
              </label>
              <Select
                id="form-version"
                value={routeVersion ?? 'working'}
                onChange={(event) => selectVersion(event.target.value)}
              >
                <option value="working">Current working version</option>
                {availableVersions.map((item) => (
                  <option key={item.version} value={item.version}>
                    v{item.version} ({item.status})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={openPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Undo"
            aria-label="Undo"
            disabled={editorHistory.past.length === 0}
            onClick={undoEdit}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Redo"
            aria-label="Redo"
            disabled={editorHistory.future.length === 0}
            onClick={redoEdit}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Import form definition JSON"
            onChange={importJson}
          />
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
          <Button onClick={() => void saveDraft()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving
              ? 'Saving...'
              : editRevision > savedRevisionRef.current || !draftVersionId
                ? 'Save Draft'
                : 'Saved'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void publish()}
            disabled={
              saving || definition.status === 'published' || editRevision > savedRevisionRef.current
            }
          >
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      {definition.status === 'draft' && publishedBaseline && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Draft v{definition.version} compared with published v{publishedBaseline.version}
            <span className="ml-2 font-normal text-muted-foreground">
              {versionChanges.length} change(s)
            </span>
          </summary>
          {versionChanges.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No schema changes.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {versionChanges.map((change, index) => (
                <li key={`${change.kind}-${change.path}-${index}`}>
                  <span className="font-medium capitalize">{change.action}</span>{' '}
                  <span>
                    {change.kind} {change.path}
                  </span>
                  {change.details && (
                    <span className="text-muted-foreground"> ({change.details.join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PALETTE.map((item) => (
              <Button
                key={item.type}
                variant="outline"
                className="w-full justify-start"
                onClick={() => addField(item.type)}
              >
                <Copy className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Canvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {definition.sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  {section.description && (
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  )}
                </div>
                {section.fields.map((field, fieldIndex) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => setDraggedId(field.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveField(field.id)}
                    onClick={() => setSelectedId(field.id)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${selectedId === field.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{field.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {field.key} · {field.type}
                      </p>
                    </div>
                    {field.required && <span className="text-xs text-destructive">Required</span>}
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Move ${field.label} up`}
                        aria-label={`Move ${field.label} up`}
                        disabled={fieldIndex === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveFieldByOffset(field.id, -1);
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Move ${field.label} down`}
                        aria-label={`Move ${field.label} down`}
                        disabled={fieldIndex === section.fields.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveFieldByOffset(field.id, 1);
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedField ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Label</label>
                  <Input
                    value={selectedField.label}
                    onChange={(event) => updateField({ label: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Field Key</label>
                  <Input
                    value={selectedField.key}
                    disabled={publishedFieldIds.has(selectedField.id)}
                    onChange={(event) => updateField({ key: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Type</label>
                  <Select
                    value={selectedField.type}
                    onChange={(event) => {
                      const type = event.target.value as FieldType;
                      updateField({
                        type,
                        dataSource:
                          type === 'entity_lookup'
                            ? {
                                kind: 'entity',
                                entity: 'vehicles',
                                valueField: 'id',
                                labelField: 'plateNumber',
                              }
                            : undefined,
                        options: type === 'select' ? (selectedField.options ?? []) : undefined,
                        rowFields:
                          type === 'repeater' ? (selectedField.rowFields ?? []) : undefined,
                        minRows: type === 'repeater' ? (selectedField.minRows ?? 0) : undefined,
                      });
                    }}
                  >
                    {PALETTE.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {['text', 'textarea', 'number', 'date', 'time'].includes(selectedField.type) && (
                  <div>
                    <label htmlFor="field-placeholder" className="mb-1 block text-xs font-semibold">
                      Placeholder
                    </label>
                    <Input
                      id="field-placeholder"
                      value={selectedField.placeholder ?? ''}
                      onChange={(event) => updateField({ placeholder: event.target.value })}
                    />
                  </div>
                )}
                {selectedField.type !== 'notice' && selectedField.type !== 'repeater' && (
                  <div>
                    <label htmlFor="field-width" className="mb-1 block text-xs font-semibold">
                      Field width
                    </label>
                    <Select
                      id="field-width"
                      value={selectedField.width ?? 'half'}
                      onChange={(event) =>
                        updateField({ width: event.target.value as FormField['width'] })
                      }
                    >
                      <option value="half">Half</option>
                      <option value="full">Full</option>
                    </Select>
                  </div>
                )}
                {selectedField.type === 'select' && (
                  <div>
                    <label htmlFor="field-options" className="mb-1 block text-xs font-semibold">
                      Options
                    </label>
                    <textarea
                      id="field-options"
                      rows={5}
                      value={formatFieldOptions(selectedField.options)}
                      onChange={(event) =>
                        updateField({ options: parseFieldOptions(event.target.value) })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {selectedField.type === 'repeater' && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="repeater-min-rows"
                          className="mb-1 block text-xs font-semibold"
                        >
                          Minimum rows
                        </label>
                        <Input
                          id="repeater-min-rows"
                          type="number"
                          min={0}
                          value={selectedField.minRows ?? 0}
                          onChange={(event) =>
                            updateField({
                              minRows: event.target.value === '' ? 0 : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="repeater-max-rows"
                          className="mb-1 block text-xs font-semibold"
                        >
                          Maximum rows
                        </label>
                        <Input
                          id="repeater-max-rows"
                          type="number"
                          min={selectedField.minRows ?? 0}
                          value={selectedField.maxRows ?? ''}
                          onChange={(event) =>
                            updateField({
                              maxRows:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedField.rowFields?.map((rowField, index) => (
                        <div key={rowField.id} className="flex items-center gap-2">
                          <Input
                            aria-label={`Repeater field ${index + 1} label`}
                            value={rowField.label}
                            onChange={(event) =>
                              updateField({
                                rowFields: selectedField.rowFields?.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, label: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={`Remove ${rowField.label}`}
                            aria-label={`Remove repeater field ${rowField.label}`}
                            onClick={() =>
                              updateField({
                                rowFields: selectedField.rowFields?.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateField({
                          rowFields: [
                            ...(selectedField.rowFields ?? []),
                            {
                              id: `${selectedField.id}-row-${Date.now()}`,
                              key: `item_${(selectedField.rowFields?.length ?? 0) + 1}`,
                              type: 'text',
                              label: 'New row field',
                              section: selectedField.section,
                            },
                          ],
                        })
                      }
                    >
                      Add Row Field
                    </Button>
                  </div>
                )}
                {selectedField.type === 'lookup' && (
                  <div>
                    <label htmlFor="field-lov-source" className="mb-1 block text-xs font-semibold">
                      Reference Data list
                    </label>
                    <Select
                      id="field-lov-source"
                      value={
                        selectedField.dataSource?.kind === 'lov'
                          ? selectedField.dataSource.listCode
                          : ''
                      }
                      onChange={(event) =>
                        updateField({
                          dataSource: event.target.value
                            ? { kind: 'lov', listCode: event.target.value }
                            : undefined,
                        })
                      }
                    >
                      <option value="">Choose a list</option>
                      {lists.map((list) => (
                        <option key={list.code} value={list.code}>
                          {list.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {selectedField.type === 'entity_lookup' && (
                  <div>
                    <label
                      htmlFor="field-entity-source"
                      className="mb-1 block text-xs font-semibold"
                    >
                      Entity source
                    </label>
                    <Select
                      id="field-entity-source"
                      value={
                        selectedField.dataSource?.kind === 'entity'
                          ? selectedField.dataSource.entity
                          : 'vehicles'
                      }
                      onChange={(event) =>
                        updateField({
                          dataSource:
                            event.target.value === 'drivers'
                              ? {
                                  kind: 'entity',
                                  entity: 'drivers',
                                  valueField: 'id',
                                  labelField: 'name',
                                }
                              : {
                                  kind: 'entity',
                                  entity: 'vehicles',
                                  valueField: 'id',
                                  labelField: 'plateNumber',
                                },
                        })
                      }
                    >
                      <option value="vehicles">Active fleet vehicles</option>
                      <option value="drivers">Active drivers</option>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The submitted value is the selected record ID.
                    </p>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedField.required ?? false}
                    onChange={(event) => updateField({ required: event.target.checked })}
                  />
                  Required
                </label>
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedField.meta?.reportable ?? false}
                      onChange={(event) =>
                        updateField({
                          meta: { ...selectedField.meta, reportable: event.target.checked },
                        })
                      }
                    />
                    Expose in reports
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedField.meta?.pii ?? false}
                      onChange={(event) =>
                        updateField({ meta: { ...selectedField.meta, pii: event.target.checked } })
                      }
                    />
                    Contains personal data
                  </label>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Conditional Rules</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const source = fields.find(
                          (field) =>
                            field.id !== selectedId && !['notice', 'repeater'].includes(field.type),
                        );
                        if (!source) return;
                        updateRules([
                          ...(selectedField.rules ?? []),
                          {
                            when: { field: source.key, operator: 'exists' },
                            show: true,
                            required: false,
                            enabled: true,
                          },
                        ]);
                      }}
                    >
                      Add Rule
                    </Button>
                  </div>
                  {(selectedField.rules ?? []).map((rule, index) => {
                    const ruleId = `${selectedField.id}-rule-${index}`;
                    const setRule = (updates: Partial<FieldRule>) =>
                      updateRules(
                        (selectedField.rules ?? []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, ...updates } : item,
                        ),
                      );
                    return (
                      <div key={ruleId} className="space-y-3 rounded-md border border-border p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor={`${ruleId}-field`}
                              className="mb-1 block text-xs font-semibold"
                            >
                              When field
                            </label>
                            <Select
                              id={`${ruleId}-field`}
                              value={rule.when.field}
                              onChange={(event) =>
                                setRule({ when: { ...rule.when, field: event.target.value } })
                              }
                            >
                              {fields
                                .filter(
                                  (field) =>
                                    field.id !== selectedId &&
                                    !['notice', 'repeater'].includes(field.type),
                                )
                                .map((field) => (
                                  <option key={field.id} value={field.key}>
                                    {field.label}
                                  </option>
                                ))}
                            </Select>
                          </div>
                          <div>
                            <label
                              htmlFor={`${ruleId}-operator`}
                              className="mb-1 block text-xs font-semibold"
                            >
                              Operator
                            </label>
                            <Select
                              id={`${ruleId}-operator`}
                              value={rule.when.operator}
                              onChange={(event) =>
                                setRule({
                                  when: {
                                    ...rule.when,
                                    operator: event.target.value as RuleOperator,
                                  },
                                })
                              }
                            >
                              <option value="exists">Has a value</option>
                              <option value="eq">Equals</option>
                              <option value="neq">Does not equal</option>
                              <option value="in">Is one of</option>
                              <option value="not_in">Is not one of</option>
                            </Select>
                          </div>
                        </div>
                        {rule.when.operator !== 'exists' && (
                          <div>
                            <label
                              htmlFor={`${ruleId}-value`}
                              className="mb-1 block text-xs font-semibold"
                            >
                              Match value
                            </label>
                            <Input
                              id={`${ruleId}-value`}
                              value={
                                Array.isArray(rule.when.value)
                                  ? rule.when.value.join(', ')
                                  : String(rule.when.value ?? '')
                              }
                              onChange={(event) =>
                                setRule({
                                  when: {
                                    ...rule.when,
                                    value: ['in', 'not_in'].includes(rule.when.operator)
                                      ? event.target.value
                                          .split(',')
                                          .map((value) => value.trim())
                                          .filter(Boolean)
                                      : event.target.value,
                                  },
                                })
                              }
                              placeholder={
                                ['in', 'not_in'].includes(rule.when.operator)
                                  ? 'Separate values with commas'
                                  : 'Enter a value'
                              }
                            />
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.show !== false}
                            onChange={(event) => setRule({ show: event.target.checked })}
                          />
                          Show when matched
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.required ?? false}
                            onChange={(event) => setRule({ required: event.target.checked })}
                          />
                          Require when matched
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={(event) => setRule({ enabled: event.target.checked })}
                          />
                          Editable when matched
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            updateRules(
                              (selectedField.rules ?? []).filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove Rule
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() =>
                    setDefinition((current) => ({
                      ...current,
                      sections: current.sections.map((section) => ({
                        ...section,
                        fields: section.fields.filter((field) => field.id !== selectedId),
                      })),
                    }))
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Field
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a field to edit its properties.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow & Cut-off</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Stages</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const id = `stage_${Date.now()}`;
                  updateWorkflow({
                    stages: [
                      ...workflow.stages,
                      { id, label: 'New Stage', statusCategory: 'in_review' },
                    ],
                  });
                }}
              >
                Add Stage
              </Button>
            </div>
            <div>
              <label htmlFor="workflow-initial-stage" className="mb-1 block text-xs font-semibold">
                Initial stage
              </label>
              <Select
                id="workflow-initial-stage"
                value={workflow.initialStage}
                onChange={(event) => updateWorkflow({ initialStage: event.target.value })}
              >
                {workflow.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </div>
            {workflow.stages.map((stage, index) => (
              <div
                key={stage.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_auto] gap-2 items-end"
              >
                <div>
                  <label
                    htmlFor={`stage-label-${stage.id}`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Stage label
                  </label>
                  <Input
                    id={`stage-label-${stage.id}`}
                    value={stage.label}
                    onChange={(event) => updateStage(index, { label: event.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`stage-id-${stage.id}`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Stage key
                  </label>
                  <Input
                    id={`stage-id-${stage.id}`}
                    value={stage.id}
                    onChange={(event) => {
                      const oldId = stage.id;
                      const nextId = event.target.value;
                      updateStage(index, { id: nextId });
                      updateWorkflow({
                        initialStage:
                          workflow.initialStage === oldId ? nextId : workflow.initialStage,
                        transitions: workflow.transitions.map((item) => ({
                          ...item,
                          from: item.from === oldId ? nextId : item.from,
                          to: item.to === oldId ? nextId : item.to,
                        })),
                      });
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`stage-category-${stage.id}`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Report status
                  </label>
                  <Select
                    id={`stage-category-${stage.id}`}
                    value={stage.statusCategory}
                    onChange={(event) =>
                      updateStage(index, {
                        statusCategory: event.target.value as SystemStatusCategory,
                      })
                    }
                  >
                    {STATUS_CATEGORIES.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remove stage"
                  disabled={workflow.stages.length <= 1}
                  onClick={() => {
                    const remaining = workflow.stages.filter(
                      (_, stageIndex) => stageIndex !== index,
                    );
                    updateWorkflow({
                      stages: remaining,
                      initialStage:
                        workflow.initialStage === stage.id
                          ? remaining[0].id
                          : workflow.initialStage,
                      transitions: workflow.transitions.filter(
                        (item) => item.from !== stage.id && item.to !== stage.id,
                      ),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Transitions</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={workflow.stages.length < 2}
                onClick={() =>
                  updateWorkflow({
                    transitions: [
                      ...workflow.transitions,
                      { from: workflow.stages[0].id, to: workflow.stages[1].id, roles: [] },
                    ],
                  })
                }
              >
                Add Transition
              </Button>
            </div>
            {workflow.transitions.map((transition, index) => (
              <div
                key={`${transition.from}-${transition.to}-${index}`}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={`transition-from-${index}`}
                      className="mb-1 block text-xs font-semibold"
                    >
                      From
                    </label>
                    <Select
                      id={`transition-from-${index}`}
                      value={transition.from}
                      onChange={(event) => updateTransition(index, { from: event.target.value })}
                    >
                      {workflow.stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor={`transition-to-${index}`}
                      className="mb-1 block text-xs font-semibold"
                    >
                      To
                    </label>
                    <Select
                      id={`transition-to-${index}`}
                      value={transition.to}
                      onChange={(event) => updateTransition(index, { to: event.target.value })}
                    >
                      {workflow.stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold">Allowed roles</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {WORKFLOW_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={transition.roles.includes(role)}
                          onChange={(event) =>
                            updateTransition(index, {
                              roles: event.target.checked
                                ? [...transition.roles, role]
                                : transition.roles.filter((value) => value !== role),
                            })
                          }
                        />
                        {role.replaceAll('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor={`transition-required-${index}`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Required fields
                  </label>
                  <Select
                    id={`transition-required-${index}`}
                    multiple
                    value={transition.requiredFields ?? []}
                    onChange={(event) =>
                      updateTransition(index, {
                        requiredFields: Array.from(
                          event.currentTarget.selectedOptions,
                          (option) => option.value,
                        ),
                      })
                    }
                  >
                    {fields
                      .filter((field) => field.type !== 'notice')
                      .map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={transition.reasonRequired ?? false}
                    onChange={(event) =>
                      updateTransition(index, { reasonRequired: event.target.checked })
                    }
                  />
                  Require a reason
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() =>
                    updateWorkflow({
                      transitions: workflow.transitions.filter(
                        (_, transitionIndex) => transitionIndex !== index,
                      ),
                    })
                  }
                >
                  Remove Transition
                </Button>
              </div>
            ))}
          </section>
          <section className="space-y-3 xl:col-span-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48">
                <label htmlFor="permission-stage" className="mb-1 block text-xs font-semibold">
                  Stage field access
                </label>
                <Select
                  id="permission-stage"
                  value={selectedPermissionStage?.id ?? ''}
                  onChange={(event) => setPermissionStageId(event.target.value)}
                >
                  {workflow.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-48">
                <label htmlFor="permission-role" className="mb-1 block text-xs font-semibold">
                  Role
                </label>
                <Select
                  id="permission-role"
                  value={permissionRole}
                  onChange={(event) => setPermissionRole(event.target.value)}
                >
                  {WORKFLOW_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {permissionFields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between gap-3 border-b border-border/60 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{field.label}</span>
                  <Select
                    aria-label={`${field.label} access for ${permissionRole}`}
                    className="w-36"
                    value={
                      selectedPermissionStage?.fieldPermissions?.[field.key]?.[permissionRole] ?? ''
                    }
                    onChange={(event) =>
                      updateFieldPermission(
                        field.key,
                        event.target.value as '' | 'edit' | 'read' | 'hidden',
                      )
                    }
                  >
                    <option value="">No override</option>
                    <option value="edit">Editable</option>
                    <option value="read">Read only</option>
                    <option value="hidden">Hidden</option>
                  </Select>
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-3 xl:col-span-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Daily Cut-off</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="cutoff-time" className="mb-1 block text-xs font-semibold">
                  Cut-off time
                </label>
                <Input
                  id="cutoff-time"
                  type="time"
                  value={workflow.cutoff.time}
                  onChange={(event) =>
                    updateWorkflow({ cutoff: { ...workflow.cutoff, time: event.target.value } })
                  }
                />
              </div>
              <div>
                <label htmlFor="cutoff-timezone" className="mb-1 block text-xs font-semibold">
                  Timezone
                </label>
                <Input
                  id="cutoff-timezone"
                  value={workflow.cutoff.timezone}
                  onChange={(event) =>
                    updateWorkflow({ cutoff: { ...workflow.cutoff, timezone: event.target.value } })
                  }
                />
              </div>
              <div>
                <label htmlFor="cutoff-policy" className="mb-1 block text-xs font-semibold">
                  Late policy
                </label>
                <Select
                  id="cutoff-policy"
                  value={workflow.cutoff.latePolicy}
                  onChange={(event) =>
                    updateWorkflow({
                      cutoff: {
                        ...workflow.cutoff,
                        latePolicy: event.target.value as FormWorkflow['cutoff']['latePolicy'],
                      },
                    })
                  }
                >
                  <option value="flag">Flag late</option>
                  <option value="flag_and_exception_approval">
                    Flag and require exception approval
                  </option>
                </Select>
              </div>
              {workflow.cutoff.latePolicy === 'flag_and_exception_approval' && (
                <div>
                  <label
                    htmlFor="cutoff-exception-stage"
                    className="mb-1 block text-xs font-semibold"
                  >
                    Exception review stage
                  </label>
                  <Select
                    id="cutoff-exception-stage"
                    value={workflow.cutoff.exceptionStage ?? ''}
                    onChange={(event) =>
                      updateWorkflow({
                        cutoff: { ...workflow.cutoff, exceptionStage: event.target.value },
                      })
                    }
                  >
                    {workflow.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
