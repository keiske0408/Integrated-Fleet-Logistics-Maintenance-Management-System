import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fieldRegistry } from './registry';
import { getFieldState } from './rules';
import type { FormDefinition, FormField, FormValues } from './types';

interface FormRendererProps {
  definition: FormDefinition;
  initialValues?: FormValues;
  onSubmit: (values: FormValues) => void;
  submitLabel?: string;
}

function getInitialValues(definition: FormDefinition, initialValues: FormValues): FormValues {
  return definition.sections
    .flatMap((section) => section.fields)
    .reduce<FormValues>(
      (values, field) => {
        if (field.type !== 'notice')
          values[field.key] = initialValues[field.key] ?? field.defaultValue;
        return values;
      },
      { ...initialValues },
    );
}

function Field({
  field,
  value,
  values,
  onChange,
}: {
  field: FormField;
  value: FormValues[string];
  values: FormValues;
  onChange: (value: FormValues[string]) => void;
}) {
  const renderer = fieldRegistry[field.type];
  const state = getFieldState(field.rules, values);
  if (!state.visible) return null;
  if (field.type === 'repeater') {
    const rows = Array.isArray(value) ? value : [];
    const rowFields = field.rowFields ?? [];
    return (
      <div className="space-y-3 md:col-span-2">
        <div>
          <p className="text-sm font-semibold">{field.label}</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          >
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                className="text-xs text-destructive"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                Remove row
              </button>
            </div>
            {rowFields.map((rowField) => (
              <Field
                key={`${rowField.id}-${index}`}
                field={rowField}
                value={row[rowField.key]}
                values={row}
                onChange={(nextValue) =>
                  onChange(
                    rows.map((currentRow, rowIndex) =>
                      rowIndex === index
                        ? { ...currentRow, [rowField.key]: nextValue }
                        : currentRow,
                    ),
                  )
                }
              />
            ))}
          </div>
        ))}
        {rows.length < (field.maxRows ?? Number.POSITIVE_INFINITY) && (
          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => onChange([...rows, {}])}
          >
            Add {field.label.toLowerCase()} row
          </button>
        )}
        {field.required && rows.length < (field.minRows ?? 1) && (
          <p className="text-xs text-destructive">Add at least {field.minRows ?? 1} row.</p>
        )}
      </div>
    );
  }
  return (
    <div className={field.width === 'full' ? 'md:col-span-2' : ''}>
      {field.type !== 'notice' && (
        <label
          htmlFor={field.key}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {field.label}
        </label>
      )}
      {renderer({
        field: { ...field, required: field.required || state.required },
        value,
        onChange,
      })}
    </div>
  );
}

export function FormRenderer({
  definition,
  initialValues = {},
  onSubmit,
  submitLabel = 'Submit Request',
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(definition, initialValues),
  );
  const updateValue = (key: string, value: FormValues[string]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="mx-auto max-w-4xl space-y-6"
    >
      {definition.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <Field
                key={field.id}
                field={field}
                value={values[field.key]}
                values={values}
                onChange={(value) => updateValue(field.key, value)}
              />
            ))}
          </CardContent>
        </Card>
      ))}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
