import React, { useEffect, useState } from 'react';
import { Copy, Download, GripVertical, Eye, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormRenderer } from './FormRenderer';
import { TSRF_V1 } from './seed';
import { useLov } from '@/features/lov';
import { validateFormDefinition } from './validation';
import type { FieldType, FormDefinition, FormField } from './types';
import type { FieldRule, RuleOperator } from './rules';

const PALETTE: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'lookup', label: 'LOV Lookup' },
  { type: 'notice', label: 'Notice' },
];

function cloneDefinition(): FormDefinition {
  return structuredClone(TSRF_V1);
}

export function FormBuilderPage() {
  const [definition, setDefinition] = useState<FormDefinition>(cloneDefinition);
  const [selectedId, setSelectedId] = useState(definition.sections[1]?.fields[0]?.id ?? '');
  const [preview, setPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { lists } = useLov();
  const fields = definition.sections.flatMap((section) => section.fields);
  const selectedField = fields.find((field) => field.id === selectedId);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/forms/${encodeURIComponent(definition.key)}`)
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Unable to load saved form versions.');
        return response.json();
      })
      .then((saved) => {
        if (cancelled || !saved) return;
        setDefinitionId(saved.id);
        const versions = [...saved.versions].sort((a, b) => b.version - a.version);
        const activeDraft = versions.find((version) => version.status === 'draft');
        const selected = activeDraft ?? versions.find((version) => version.status === 'published');
        if (selected?.schema) {
          setDefinition({ ...selected.schema, version: selected.version, status: selected.status });
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
  }, []);

  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const draft = { ...definition, status: 'draft' as const };
      let response: Response;
      if (!definitionId) {
        response = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: draft.key, name: draft.name, schema: draft }),
        });
      } else if (draftVersionId) {
        response = await fetch(`/api/forms/versions/${encodeURIComponent(draftVersionId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft }),
        });
      } else {
        response = await fetch(`/api/forms/${encodeURIComponent(definitionId)}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft }),
        });
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save draft.');
      setDefinitionId(result.id ?? definitionId);
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
    const errors = validateFormDefinition(definition, new Set(lists.map((list) => list.code)));
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
      const response = await fetch(
        `/api/forms/versions/${encodeURIComponent(draftVersionId)}/publish`,
        { method: 'POST' },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to publish form.');
      setDefinition({ ...definition, version: result.version, status: 'published' });
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
  const addField = (type: FieldType) => {
    const field: FormField = {
      id: `field-${Date.now()}`,
      key: `new_field_${fields.length + 1}`,
      type,
      label: `New ${type} field`,
      section: 'trip-details',
      required: false,
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
                    onChange={(event) => updateField({ key: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Type</label>
                  <Select
                    value={selectedField.type}
                    onChange={(event) => updateField({ type: event.target.value as FieldType })}
                  >
                    {PALETTE.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedField.required ?? false}
                    onChange={(event) => updateField({ required: event.target.checked })}
                  />
                  Required
                </label>
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
    </div>
  );
}
