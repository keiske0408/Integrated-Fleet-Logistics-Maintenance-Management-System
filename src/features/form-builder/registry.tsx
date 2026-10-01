import React from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { FieldType, FormField, FormValues } from './types';

export interface FieldRendererProps {
  field: FormField;
  value: FormValues[string];
  onChange: (value: FormValues[string]) => void;
}

type FieldRenderer = (props: FieldRendererProps) => React.ReactNode;

const renderInput = ({ field, value, onChange }: FieldRendererProps, type: string) => (
  <Input
    id={field.key}
    type={type}
    value={typeof value === 'string' || typeof value === 'number' ? value : ''}
    placeholder={field.placeholder}
    required={field.required}
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
  textarea: ({ field, value, onChange }) => (
    <textarea
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      placeholder={field.placeholder}
      required={field.required}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  ),
  select: ({ field, value, onChange }) => (
    <Select
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      required={field.required}
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
  lookup: ({ field, value, onChange }) => (
    <Select
      id={field.key}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      required={field.required}
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
  notice: ({ field }) => (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
      {field.content}
    </div>
  ),
  repeater: () => null,
};
