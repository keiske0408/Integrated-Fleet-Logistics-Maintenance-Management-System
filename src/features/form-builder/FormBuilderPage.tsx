import React, { useState } from 'react';
import { Copy, Download, GripVertical, Eye, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormRenderer } from './FormRenderer';
import { TSRF_V1 } from './seed';
import type { FieldType, FormDefinition, FormField } from './types';

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
  const fields = definition.sections.flatMap((section) => section.fields);
  const selectedField = fields.find((field) => field.id === selectedId);

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
            Design {definition.name} v{definition.version}.
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
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
        </div>
      </div>
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
