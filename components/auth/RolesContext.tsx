import React, { createContext, useContext, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Permission =
  | 'view:dashboard'
  | 'view:fleet'
  | 'view:tsrf'
  | 'view:procurement'
  | 'view:maintenance_ref'
  | 'view:users'
  | 'view:roles'
  | 'view:reports'
  | 'create:tsrf'
  | 'approve:tsrf'
  | 'create:vehicle'
  | 'update:vehicle_km'
  | 'schedule:pms'
  | 'create:work_order'
  | 'approve:work_order'
  | 'create:pr'
  | 'approve:pr'
  | 'manage:users'
  | 'manage:roles'
  | 'manage:reference_data';

export const ALL_PERMISSIONS: Permission[] = [
  'view:dashboard', 'view:fleet', 'view:tsrf', 'view:procurement',
  'view:maintenance_ref', 'view:users', 'view:roles', 'view:reports',
  'create:tsrf', 'approve:tsrf', 'create:vehicle', 'update:vehicle_km',
  'schedule:pms', 'create:work_order', 'approve:work_order',
  'create:pr', 'approve:pr', 'manage:users', 'manage:roles', 'manage:reference_data',
];

// Kept for AuthContext import compatibility
export const ROLE_PERMISSIONS_MAP: Record<string, Permission[]> = {};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Page Access',
    permissions: [
      'view:dashboard', 'view:fleet', 'view:tsrf', 'view:procurement',
      'view:maintenance_ref', 'view:users', 'view:roles', 'view:reports',
    ],
  },
  {
    label: 'TSRF & Logistics',
    permissions: ['create:tsrf', 'approve:tsrf'],
  },
  {
    label: 'Fleet & PMS',
    permissions: ['create:vehicle', 'update:vehicle_km', 'schedule:pms'],
  },
  {
    label: 'Maintenance & Work Orders',
    permissions: ['create:work_order', 'approve:work_order'],
  },
  {
    label: 'Procurement',
    permissions: ['create:pr', 'approve:pr'],
  },
  {
    label: 'Administration',
    permissions: ['manage:users', 'manage:roles', 'manage:reference_data'],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'view:dashboard': 'View Dashboard',
  'view:fleet': 'View Fleet Module',
  'view:tsrf': 'View TSRF Module',
  'view:procurement': 'View Procurement Module',
  'view:maintenance_ref': 'View Reference Data',
  'view:users': 'View User Management',
  'view:roles': 'View Roles Management',
  'view:reports': 'View Reports',
  'create:tsrf': 'Create TSRFs',
  'approve:tsrf': 'Approve TSRFs',
  'create:vehicle': 'Add Vehicles',
  'update:vehicle_km': 'Update Odometer',
  'schedule:pms': 'Schedule PMS',
  'create:work_order': 'Create Work Orders',
  'approve:work_order': 'Approve Work Orders',
  'create:pr': 'Create Purchase Requisitions',
  'approve:pr': 'Approve Purchase Requisitions',
  'manage:users': 'Manage Users',
  'manage:roles': 'Manage Roles',
  'manage:reference_data': 'Manage Reference Data',
};

// ─── Role Definition ────────────────────────────────────────────────────────────

export interface RoleDefinition {
  id: string;
  key: string;           // unique string key used in User.role
  label: string;
  description: string;
  color: string;         // Tailwind classes for badge
  permissions: Permission[];
  isSystem: boolean;     // system roles cannot be deleted
  createdAt: string;
}

// ─── Default Roles ─────────────────────────────────────────────────────────────

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'role-1',
    key: 'system_admin',
    label: 'System Administrator',
    description: 'Full access to all modules and administration settings.',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-2',
    key: 'fleet_manager',
    label: 'Fleet & Logistics Manager',
    description: 'Manages vehicles, PMS scheduling, work orders, and procurement.',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    permissions: [
      'view:dashboard', 'view:fleet', 'view:tsrf', 'view:procurement', 'view:reports',
      'approve:tsrf', 'create:vehicle', 'update:vehicle_km', 'schedule:pms',
      'create:work_order', 'approve:work_order', 'create:pr',
    ],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-3',
    key: 'logistics_manager',
    label: 'Logistics Manager',
    description: 'Handles TSRF approvals, dispatch scheduling and km logging.',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    permissions: [
      'view:dashboard', 'view:fleet', 'view:tsrf', 'view:reports',
      'create:tsrf', 'approve:tsrf', 'update:vehicle_km', 'schedule:pms',
    ],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-4',
    key: 'finance_manager',
    label: 'Finance Manager',
    description: 'Reviews and approves Purchase Requisitions from all departments.',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    permissions: ['view:dashboard', 'view:procurement', 'view:reports', 'approve:pr'],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-5',
    key: 'procurement_officer',
    label: 'Procurement Officer',
    description: 'Creates PRs and tracks vendor procurement fulfillment.',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    permissions: [
      'view:dashboard', 'view:procurement', 'view:fleet', 'view:reports',
      'create:pr', 'approve:work_order',
    ],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-6',
    key: 'department_requester',
    label: 'Department Requester',
    description: 'Submits Transportation Service Request Forms (TSRF) only.',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    permissions: ['view:dashboard', 'view:tsrf', 'create:tsrf'],
    isSystem: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'role-7',
    key: 'driver',
    label: 'Driver',
    description: 'Views fleet assignments and updates odometer readings.',
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    permissions: ['view:dashboard', 'view:fleet', 'update:vehicle_km'],
    isSystem: true,
    createdAt: '2026-01-01',
  },
];

// ─── Context ───────────────────────────────────────────────────────────────────

interface RolesContextValue {
  roles: RoleDefinition[];
  addRole: (role: Omit<RoleDefinition, 'id' | 'createdAt'>) => void;
  updateRole: (id: string, updates: Partial<RoleDefinition>) => void;
  deleteRole: (id: string) => void;
  getRoleByKey: (key: string) => RoleDefinition | undefined;
}

const RolesContext = createContext<RolesContextValue | null>(null);

export function RolesProvider({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);

  const addRole = (role: Omit<RoleDefinition, 'id' | 'createdAt'>) => {
    setRoles((prev) => [
      ...prev,
      { ...role, id: `role-${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] },
    ]);
  };

  const updateRole = (id: string, updates: Partial<RoleDefinition>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRole = (id: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const getRoleByKey = (key: string) => roles.find((r) => r.key === key);

  return (
    <RolesContext.Provider value={{ roles, addRole, updateRole, deleteRole, getRoleByKey }}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles(): RolesContextValue {
  const ctx = useContext(RolesContext);
  if (!ctx) throw new Error('useRoles must be used inside RolesProvider');
  return ctx;
}
