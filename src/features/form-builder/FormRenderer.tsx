import React, { useEffect, useState } from 'react';
import { useLov } from '@/features/lov';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Package,
  Send,
  Plus,
  Trash2,
  FileText,
  Info,
} from 'lucide-react';
import { fieldRegistry } from './registry';
import { getFieldState } from './rules';
import { validateFormValues } from './validation';
import type { FormDefinition, FormField, FormValues } from './types';

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'intake-notice': Clock,
  'trip-details': Calendar,
  route: MapPin,
  passengers: Users,
  cargo: Package,
};

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
      <div className="col-span-full space-y-4 pt-2">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              {field.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {rows.length} {rows.length === 1 ? 'entry recorded' : 'entries recorded'}
            </p>
          </div>
          {canEditStructure && rows.length < (field.maxRows ?? Number.POSITIVE_INFINITY) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...rows, {}])}
              className="h-7 text-xs text-primary hover:text-primary gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add {field.label.replace(/s$/, '')}</span>
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3.5 transition-all hover:border-border"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md">
                  #{index + 1}
                </span>
                {canEditStructure && (
                  <button
                    type="button"
                    className="p-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
                    onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            </div>
          ))}
        </div>
        {field.required && rows.length < (field.minRows ?? 1) && (
          <p className="text-xs text-destructive">Add at least {field.minRows ?? 1} row.</p>
        )}
      </div>
    );
  }
  return (
    <div className={field.width === 'full' || field.type === 'notice' ? 'col-span-full' : ''}>
      {field.type !== 'notice' && (
        <label
          htmlFor={field.key}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {field.label}
          {(field.required || state.required) && <span className="text-destructive ml-1">*</span>}
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
  const { error: toastError, warning: toastWarning } = useToast();
  const [vehicleOptions, setVehicleOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [driverOptions, setDriverOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [initialValuesSnapshot] = useState(() => getInitialValues(definition, initialValues));
  const [values, setValues] = useState<FormValues>(initialValuesSnapshot);
  const [, setValidationErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hasVehicleLookup = definition.sections.some((section) =>
      section.fields.some(
        (field) => field.dataSource?.kind === 'entity' && field.dataSource.entity === 'vehicles',
      ),
    );
    const hasDriverLookup = definition.sections.some((section) =>
      section.fields.some(
        (field) => field.dataSource?.kind === 'entity' && field.dataSource.entity === 'drivers',
      ),
    );
    if (!hasVehicleLookup && !hasDriverLookup) return;
    let cancelled = false;
    if (hasVehicleLookup) {
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
          if (!cancelled) {
            const message =
              error instanceof Error ? error.message : 'Unable to load fleet vehicles.';
            toastWarning(message);
          }
        });
    }
    if (hasDriverLookup) {
      apiFetch('/api/users/drivers')
        .then(async (response) => {
          if (!response.ok) throw new Error('Unable to load active drivers.');
          return response.json();
        })
        .then((drivers: Array<{ id: string; name: string }>) => {
          if (!cancelled)
            setDriverOptions(drivers.map((driver) => ({ value: driver.id, label: driver.name })));
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            const message =
              error instanceof Error ? error.message : 'Unable to load active drivers.';
            toastWarning(message);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, definition, toastWarning]);

  const updateValue = (key: string, value: FormValues[string]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const resolvedDefinition: FormDefinition = {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.dataSource?.kind === 'entity') {
          return {
            ...field,
            options: field.dataSource.entity === 'drivers' ? driverOptions : vehicleOptions,
          };
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
    if (errors.length > 0) {
      toastError(errors[0] || 'Please complete all required fields.');
      return;
    }
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
      const message = error instanceof Error ? error.message : 'Submission failed.';
      setValidationErrors([message]);
      toastError(message);
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
      className="w-full space-y-6"
    >
      {resolvedDefinition.sections.map((section) => {
        const SectionIcon = SECTION_ICONS[section.id] || FileText;
        const isNoticeOnly = section.fields.every((f) => f.type === 'notice');

        if (isNoticeOnly) {
          return (
            <div
              key={section.id}
              className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-bold text-foreground tracking-tight">
                  {section.title}
                </h4>
                {section.fields.map((field) => (
                  <p key={field.id} className="text-xs text-muted-foreground leading-relaxed">
                    {field.content}
                  </p>
                ))}
              </div>
            </div>
          );
        }

        return (
          <Card
            key={section.id}
            className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs hover:border-border transition-all overflow-hidden"
          >
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <SectionIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    {section.title}
                  </CardTitle>
                  {section.description && (
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      {section.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 grid grid-cols-1 gap-5 md:grid-cols-2">
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
        );
      })}

      {/* Action / Submit Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>Verify schedule, stops, and passenger/cargo manifest before submitting.</span>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto h-10 px-6 font-semibold shadow-sm gap-2"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <span>Submitting Request...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>{submitLabel}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
