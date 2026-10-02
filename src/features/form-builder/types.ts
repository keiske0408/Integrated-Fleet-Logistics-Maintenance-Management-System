export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'lookup'
  | 'checkbox'
  | 'notice'
  | 'repeater';

export interface FormField {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  section: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: FormValue;
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

export type SystemStatusCategory =
  | 'draft'
  | 'in_review'
  | 'returned'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type StageFieldPermission = 'edit' | 'read' | 'hidden';

export interface WorkflowStage {
  id: string;
  label: string;
  statusCategory: SystemStatusCategory;
  fieldPermissions?: Record<string, Record<string, StageFieldPermission>>;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  roles: string[];
  requiredFields?: string[];
  reasonRequired?: boolean;
  action?: string;
}

export interface FormWorkflow {
  initialStage: string;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  cutoff: {
    time: string;
    timezone: string;
    latePolicy: 'flag' | 'flag_and_exception_approval';
    exceptionStage?: string;
  };
}

export type FormValue = string | number | boolean | FormValues[] | undefined;
export type FormValues = Record<string, FormValue>;
