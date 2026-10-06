// ─── LOV (List-of-Values) Engine Types ────────────────────────────────────────

export type LovListStatus = 'active' | 'archived';
export type LovItemStatus = 'active' | 'inactive';
export type LovAttributeType = 'text' | 'number' | 'boolean' | 'select';

export interface LovList {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  supportsHierarchy: boolean;
  status: LovListStatus;
}

export interface LovAttribute {
  id: string;
  listCode: string;
  key: string;
  label: string;
  type: LovAttributeType;
  required: boolean;
  showInGrid: boolean;
  sortOrder: number;
  options: string[];
}

export interface LovItem {
  id: string;
  listCode: string;
  parentId: string | null;
  code: string;
  label: string;
  sortOrder: number;
  status: LovItemStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  attrs: Record<string, string | number | boolean>;
  approvalUserId?: string | null;
}

export interface LovItemFormData {
  code: string;
  label: string;
  status: LovItemStatus;
  attrs: Record<string, string | number | boolean>;
  approvalUserId?: string | null;
}

export interface LovListFormData {
  code: string;
  name: string;
  description: string;
  supportsHierarchy: boolean;
}
