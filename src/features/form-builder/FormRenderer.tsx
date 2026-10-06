import React, { useEffect, useState } from 'react';
import { useLov } from '@/features/lov';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fieldRegistry } from './registry';
import { getFieldState } from './rules';
import { validateFormValues } from './validation';
import type { FormDefinition, FormField, FormValues } from './types';

interface FormRendererProps {
  definition: FormDefinition;
  initialValues?: FormValues;
  onSubmit: (values: FormValues) => void | Promise<void>;
  submitLabel?: string;
  fieldAccess?: Record<string, 'read' | 'edit'>;
  submitChangedFieldsOnly?: boolean;
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

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function collectEditableFormChanges(
  fields: FormField[],
  initialValues: FormValues,
  values: FormValues,
  fieldAccess: Record<string, 'read' | 'edit'>,
  prefix = '',
): FormValues {
  const changes: FormValues = {};
  fields.forEach((field) => {
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    const initialValue = initialValues[field.key];
    const value = values[field.key];
    if (field.type === 'repeater') {
      const initialRows = Array.isArray(initialValue) ? initialValue : [];
      const rows = Array.isArray(value) ? value : [];
      if (initialRows.length !== rows.length) {
        if (fieldAccess[path] === 'edit' && !valuesEqual(initialRows, rows))
          changes[field.key] = value;
        return;
      }
      const rowChanges = rows.map((row, index) => {
        const initialRow = initialRows[index];
        const rowValues =
          typeof row === 'object' && row !== null && !Array.isArray(row) ? (row as FormValues) : {};
        const initialRowValues =
          typeof initialRow === 'object' && initialRow !== null && !Array.isArray(initialRow)
            ? (initialRow as FormValues)
            : {};
        return collectEditableFormChanges(
          field.rowFields ?? [],
          initialRowValues,
          rowValues,
          fieldAccess,
          path,
        );
      });
      if (rowChanges.some((row) => Object.keys(row).length > 0)) changes[field.key] = rowChanges;
      return;
    }
    if (
      fieldAccess[path] === 'edit' &&
      Object.prototype.hasOwnProperty.call(values, field.key) &&
      !valuesEqual(initialValue, value)
    ) {
      changes[field.key] = value;
    }
  });
  return changes;
}

function Field({
  field,
  value,
  values,
  onChange,
  fieldAccess,
  path,
}: {
  field: FormField;
  value: FormValues[string];
  values: FormValues;
  onChange: (value: FormValues[string]) => void;
  fieldAccess?: Record<string, 'read' | 'edit'>;
  path: string;
}) {
  const renderer = fieldRegistry[field.type];
  const state = getFieldState(field.rules, values);
  const canEditStructure = fieldAccess ? fieldAccess[path] === 'edit' : true;
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
                disabled={!canEditStructure}
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
                fieldAccess={fieldAccess}
                path={`${path}.${rowField.key}`}
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
        {canEditStructure && rows.length < (field.maxRows ?? Number.POSITIVE_INFINITY) && (
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
        disabled: !state.enabled || (fieldAccess !== undefined && !canEditStructure),
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
  fieldAccess,
  submitChangedFieldsOnly = false,
}: FormRendererProps) {
  const { getActiveItems } = useLov();
  const { currentUser } = useAuth();
  const [vehicleOptions, setVehicleOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [initialValuesSnapshot] = useState(() => getInitialValues(definition, initialValues));
  const [values, setValues] = useState<FormValues>(initialValuesSnapshot);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const hasVehicleLookup = definition.sections.some((section) =>
      section.fields.some(
        (field) => field.dataSource?.kind === 'entity' && field.dataSource.entity === 'vehicles',
      ),
    );
    if (!hasVehicleLookup) return;
    let cancelled = false;
    apiFetch('/api/vehicles')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load fleet vehicles.');
        return response.json();
      })
      .then(
        (vehicles: Array<{ id: string; plateNumber: string; model: string; status: string }>) => {
          if (cancelled) return;
          setVehicleOptions(
            vehicles
              .filter((vehicle) => vehicle.status === 'active')
              .map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.plateNumber} · ${vehicle.model}`,
              })),
          );
        },
      )
      .catch((error: unknown) => {
        if (!cancelled)
          setValidationErrors([
            error instanceof Error ? error.message : 'Unable to load fleet vehicles.',
          ]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, definition]);
  const updateValue = (key: string, value: FormValues[string]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const resolvedDefinition: FormDefinition = {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.dataSource?.kind === 'entity' && field.dataSource.entity === 'vehicles') {
          return { ...field, options: vehicleOptions };
        }
        if (!field.dataSource || field.dataSource.kind !== 'lov' || field.type !== 'lookup')
          return field;
        const options = getActiveItems(field.dataSource.listCode).map((item) => ({
          value: item.code,
          label: item.label,
        }));
        return { ...field, options: options.length > 0 ? options : field.options };
      }),
    })),
  };
  const submitForm = async () => {
    const errors = validateFormValues(definition, values);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setSubmitting(true);
    try {
      const submittedValues = submitChangedFieldsOnly
        ? collectEditableFormChanges(
            definition.sections.flatMap((section) => section.fields),
            initialValuesSnapshot,
            values,
            fieldAccess ?? {},
          )
        : values;
      await onSubmit(submittedValues);
      setValidationErrors([]);
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Submission failed.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm();
      }}
      className="mx-auto max-w-4xl space-y-6"
    >
      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      {resolvedDefinition.sections.map((section) => (
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
                fieldAccess={fieldAccess}
                path={field.key}
                onChange={(value) => updateValue(field.key, value)}
              />
            ))}
          </CardContent>
        </Card>
      ))}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : submitLabel}
      </Button>
    </form>
  );
}
