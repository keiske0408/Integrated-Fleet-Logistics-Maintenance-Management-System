import React, { useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';
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

function DateFieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const strValue = typeof value === 'string' ? value : '';

  const handleOpenPicker = () => {
    if (disabled) return;
    try {
      inputRef.current?.showPicker?.();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        ref={inputRef}
        id={field.key}
        type="date"
        value={strValue}
        required={field.required}
        disabled={disabled}
        onClick={handleOpenPicker}
        onChange={(event) => onChange(event.target.value)}
        className="w-full pr-10 cursor-pointer [color-scheme:dark] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
        <Calendar className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}

function TimeFieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const strValue = typeof value === 'string' ? value : '';

  // Convert 12h format ("08:00 AM") to 24h format ("08:00") for native time inputs
  const to24h = (timeStr: string) => {
    if (!timeStr) return '';
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    const [, hStr, mStr, meridiem] = match;
    let h = parseInt(hStr, 10);
    if (meridiem) {
      if (meridiem.toUpperCase() === 'PM' && h < 12) h += 12;
      if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${mStr}`;
  };

  // Convert 24h format ("08:00") to 12h format ("08:00 AM")
  const to12h = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return time24;
    const meridiem = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${mStr || '00'} ${meridiem}`;
  };

  const handleOpenPicker = () => {
    if (disabled) return;
    try {
      inputRef.current?.showPicker?.();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        ref={inputRef}
        id={field.key}
        type="time"
        value={to24h(strValue)}
        required={field.required}
        disabled={disabled}
        onClick={handleOpenPicker}
        onChange={(event) => onChange(to12h(event.target.value))}
        className="w-full pr-10 cursor-pointer [color-scheme:dark] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
        <Clock className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}

export const fieldRegistry: Record<FieldType, FieldRenderer> = {
  text: (props) => renderInput(props, 'text'),
  number: (props) => renderInput(props, 'number'),
  date: (props) => <DateFieldRenderer {...props} />,
  time: (props) => <TimeFieldRenderer {...props} />,
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
  entity_lookup: ({ field, value, onChange, disabled }) => (
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
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        id={field.key}
        type="checkbox"
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="rounded border-input text-primary focus:ring-ring"
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
