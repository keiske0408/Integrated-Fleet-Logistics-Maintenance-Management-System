import React from 'react';
import type { FormDefinition, FormField, FormValues } from './types';

interface FormPrintViewProps {
  definition: FormDefinition;
  values: FormValues;
  submissionNumber: string;
  labelSnapshots: Record<string, { code: string; label: string }>;
  status?: string;
  stage?: string;
  isLate?: boolean;
  createdAt?: string;
  currentAssignee?: { name: string; role: string } | null;
  currentResponsibleRoles?: string[];
}

function displayStatus(value: string | undefined): string {
  if (!value) return 'Not available';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatPrintableFieldValue(
  field: FormField,
  value: unknown,
  path: string,
  snapshots: FormPrintViewProps['labelSnapshots'],
) {
  if (value === undefined || value === null || value === '') return ' ';
  const snapshot = snapshots[path];
  if (snapshot) return snapshot.label;
  const option = field.options?.find((candidate) => candidate.value === String(value));
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return field.type === 'notice' ? (field.content ?? '') : ' ';
}

function PrintField({
  field,
  values,
  path,
  labelSnapshots,
}: {
  field: FormField;
  values: FormValues;
  path: string;
  labelSnapshots: FormPrintViewProps['labelSnapshots'];
}) {
  const value = values[field.key];
  if (field.type === 'notice') {
    return <div className="form-print-notice">{field.content}</div>;
  }
  if (field.type === 'repeater') {
    const rows = Array.isArray(value) ? value : [];
    const rowFields = field.rowFields ?? [];
    return (
      <section className="form-print-repeater" key={path}>
        <h3>{field.label}</h3>
        <table>
          <thead>
            <tr>
              {rowFields.map((rowField) => (
                <th key={rowField.key}>{rowField.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {rowFields.map((rowField) => (
                  <td key={rowField.key}>
                    {formatPrintableFieldValue(
                      rowField,
                      row[rowField.key],
                      `${path}[${index}].${rowField.key}`,
                      labelSnapshots,
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(rowFields.length, 1)}>No entries</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    );
  }
  return (
    <div className="form-print-field" key={path}>
      <span>{field.label}</span>
      <strong>{formatPrintableFieldValue(field, value, path, labelSnapshots)}</strong>
    </div>
  );
}

export function FormPrintView({
  definition,
  values,
  submissionNumber,
  labelSnapshots,
  status,
  stage,
  isLate,
  createdAt,
  currentAssignee,
  currentResponsibleRoles = [],
}: FormPrintViewProps) {
  const responsibility = currentAssignee
    ? `${currentAssignee.name} (${displayStatus(currentAssignee.role)})`
    : currentResponsibleRoles.length
      ? `${currentResponsibleRoles.map(displayStatus).join(', ')} queue`
      : 'No active assignee';
  return (
    <main className="form-print-sheet" aria-label="Printable form">
      <header className="form-print-header">
        <div>
          <p>FLEET LOGISTICS</p>
          <h1>{definition.name}</h1>
        </div>
        <div className="form-print-number">
          <span>TSRF No.</span>
          <strong>{submissionNumber}</strong>
        </div>
      </header>
      <section className="form-print-metadata" aria-label="Request status">
        <div>
          <span>Status</span>
          <strong>{displayStatus(status)}</strong>
        </div>
        <div>
          <span>Workflow stage</span>
          <strong>{displayStatus(stage)}</strong>
        </div>
        <div>
          <span>Current responsibility</span>
          <strong>{responsibility}</strong>
        </div>
        <div>
          <span>Submitted</span>
          <strong>{createdAt ? new Date(createdAt).toLocaleString() : ' '}</strong>
        </div>
        <div>
          <span>Cut-off</span>
          <strong>{isLate === undefined ? ' ' : isLate ? 'Late' : 'On time'}</strong>
        </div>
      </section>
      {definition.sections.map((section) => (
        <section className="form-print-section" key={section.id}>
          <h2>{section.title}</h2>
          {section.description && <p className="form-print-description">{section.description}</p>}
          <div className="form-print-fields">
            {section.fields.map((field) => (
              <PrintField
                key={field.id}
                field={field}
                values={values}
                path={field.key}
                labelSnapshots={labelSnapshots}
              />
            ))}
          </div>
        </section>
      ))}
      <footer className="form-print-footer">
        Generated from {definition.name} v{definition.version}
      </footer>
    </main>
  );
}
