export type FieldType =
  'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'lookup' | 'notice' | 'repeater';

export interface FormField {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  section: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  options?: Array<{ value: string; label: string }>;
  dataSource?: { kind: 'lov'; listCode: string };
  content?: string;
  width?: 'full' | 'half';
  rules?: import('./rules').FieldRule[];
  rowFields?: FormField[];
  minRows?: number;
  maxRows?: number;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormDefinition {
  key: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  sections: FormSection[];
}

export type FormValue = string | number | boolean | FormValues[] | undefined;
export type FormValues = Record<string, FormValue>;
