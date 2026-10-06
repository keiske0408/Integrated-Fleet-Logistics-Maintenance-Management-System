import React, { useEffect, useState } from 'react';
import { Copy, Download, GripVertical, Eye, Save, Send, Trash2 } from 'lucide-react';
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
import type {
  FieldType,
  FormDefinition,
  FormField,
  FormWorkflow,
  SystemStatusCategory,
} from './types';
import type { FieldRule, RuleOperator } from './rules';

const PALETTE: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
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
  const [definition, setDefinition] = useState<FormDefinition>(cloneDefinition);
  const [workflow, setWorkflow] = useState<FormWorkflow>(() => structuredClone(TSRF_WORKFLOW));
  const [selectedId, setSelectedId] = useState(definition.sections[1]?.fields[0]?.id ?? '');
  const [preview, setPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [publishedFieldIds, setPublishedFieldIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/forms/${encodeURIComponent(definition.key)}`)
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Unable to load saved form versions.');
        return response.json();
      })
      .then((saved) => {
        if (cancelled || !saved) return;
        setDefinitionId(saved.id);
        const versions = [...saved.versions].sort((a, b) => b.version - a.version);
        const published = versions.find((version) => version.status === 'published');
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
        const selected = activeDraft ?? versions.find((version) => version.status === 'published');
        if (selected?.schema) {
          setDefinition({ ...selected.schema, version: selected.version, status: selected.status });
          setWorkflow(
            selected.workflow?.stages ? selected.workflow : structuredClone(TSRF_WORKFLOW),
          );
          setDraftVersionId(selected.status === 'draft' ? selected.id : null);
          setSelectedId(selected.schema.sections[1]?.fields[0]?.id ?? '');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(error instanceof Error ? error.message : 'Unable to load form definition.');
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, definition.key]);

  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);
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
      setDefinition({ ...draft, version: version.version, status: 'draft' });
      setMessage(`Draft v${version.version} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save draft.');
    } finally {
      setSaving(false);
    }
  };

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
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(draftVersionId)}/publish`,
        { method: 'POST' },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to publish form.');
      setDefinition({ ...definition, version: result.version, status: 'published' });
      setPublishedFieldIds(new Set(collectFieldIds(fields)));
      setDraftVersionId(null);
      setMessage(`Form v${result.version} published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish form.');
    } finally {
      setSaving(false);
    }
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

  if (preview)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Preview: {definition.name}</h1>
          <Button variant="outline" onClick={() => setPreview(false)}>
            <Eye className="mr-2 h-4 w-4" />
            Back to Design
          </Button>
        </div>
        <FormRenderer definition={definition} onSubmit={() => undefined} />
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
          <Button variant="outline" onClick={() => setPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button onClick={() => void saveDraft()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void publish()}
            disabled={saving || definition.status === 'published'}
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
                {section.fields.map((field) => (
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
                            : type === 'lookup'
                              ? undefined
                              : selectedField.dataSource,
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
