import React from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { FieldType, FormField, FormValues } from './types';

export interface FieldRendererProps {
  field: FormField;
  value: FormValues[string];
  onChange: (value: FormValues[string]) => void;
  disabled?: boolean;
}

type FieldRenderer = (props: FieldRendererProps) => React.ReactNode;

const renderInput = ({ field, value, onChange, disabled }: FieldRendererProps, type: string) => (
  <Input
    id={field.key}
    type={type}
    value={typeof value === 'string' || typeof value === 'number' ? value : ''}
    placeholder={field.placeholder}
    required={field.required}
    disabled={disabled}
    onChange={(event) =>
      onChange(type === 'number' ? Number(event.target.value) : event.target.value)
    }
  />
);

export const fieldRegistry: Record<FieldType, FieldRenderer> = {
  text: (props) => renderInput(props, 'text'),
  number: (props) => renderInput(props, 'number'),
  date: (props) => renderInput(props, 'date'),
  time: (props) => renderInput(props, 'time'),
  textarea: ({ field, value, onChange, disabled }) => (
    <textarea
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      placeholder={field.placeholder}
      required={field.required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  ),
  select: ({ field, value, onChange, disabled }) => (
    <Select
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      required={field.required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select {field.label.toLowerCase()}</option>
      {(field.options ?? []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  ),
  lookup: ({ field, value, onChange, disabled }) => (
    <Select
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      required={field.required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select {field.label.toLowerCase()}</option>
      {(field.options ?? []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  ),
  checkbox: ({ field, value, onChange, disabled }) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        id={field.key}
        type="checkbox"
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {field.label}
    </label>
  ),
  notice: ({ field }) => (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
      {field.content}
    </div>
  ),
  repeater: () => null,
};
