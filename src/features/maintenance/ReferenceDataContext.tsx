import React from 'react';
import { LovProvider, useLov } from '@/features/lov';
import type { LovItem } from '@/features/lov';

// ─── Backward-Compatible Reference Data Types ─────────────────────────────────
// These types match the original interfaces so existing consumers keep working.

export interface Department {
  id: string;
  code: string;
  name: string;
  head: string;
  isActive: boolean;
}

export interface VehicleType {
  id: string;
  code: string;
  label: string;
  category: 'light' | 'medium' | 'heavy' | 'special';
  pmsIntervalKm: number;
  isActive: boolean;
}

export interface MaintenanceCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  specialization: string;
  isActive: boolean;
}

// ─── Mappers: LOV items → legacy types ────────────────────────────────────────

function toDepartment(item: LovItem): Department {
  return {
    id: item.id,
    code: item.code,
    name: item.label,
    head: (item.attrs.head as string) || '',
    isActive: item.status === 'active',
  };
}

function toVehicleType(item: LovItem): VehicleType {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    category: (item.attrs.category as VehicleType['category']) || 'medium',
    pmsIntervalKm: (item.attrs.pms_interval_km as number) || 5000,
    isActive: item.status === 'active',
  };
}

function toMaintenanceCategory(item: LovItem): MaintenanceCategory {
  return {
    id: item.id,
    code: item.code,
    name: item.label,
    description: (item.attrs.description as string) || '',
    isActive: item.status === 'active',
  };
}

function toVendor(item: LovItem): Vendor {
  return {
    id: item.id,
    name: item.label,
    contactPerson: (item.attrs.contact_person as string) || '',
    phone: (item.attrs.phone as string) || '',
    specialization: (item.attrs.specialization as string) || '',
    isActive: item.status === 'active',
  };
}

// ─── Provider (passthrough — LovProvider owns the state) ──────────────────────

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  return <LovProvider>{children}</LovProvider>;
}

// ─── Hook: backward-compatible adapter over useLov() ──────────────────────────

interface ReferenceDataContextValue {
  departments: Department[];
  vehicleTypes: VehicleType[];
  maintenanceCategories: MaintenanceCategory[];
  vendors: Vendor[];
  addDepartment: (d: Omit<Department, 'id'>) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  addVehicleType: (v: Omit<VehicleType, 'id'>) => void;
  updateVehicleType: (id: string, updates: Partial<VehicleType>) => void;
  deleteVehicleType: (id: string) => void;
  addMaintenanceCategory: (m: Omit<MaintenanceCategory, 'id'>) => void;
  updateMaintenanceCategory: (id: string, updates: Partial<MaintenanceCategory>) => void;
  deleteMaintenanceCategory: (id: string) => void;
  addVendor: (v: Omit<Vendor, 'id'>) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
}

export function useReferenceData(): ReferenceDataContextValue {
  const { getItems, addItem, updateItem, deleteItem } = useLov();

  const departments = getItems('DEPARTMENTS').map(toDepartment);
  const vehicleTypes = getItems('VEHICLE_TYPES').map(toVehicleType);
  const maintenanceCategories = getItems('MAINTENANCE_CATEGORIES').map(toMaintenanceCategory);
  const vendors = getItems('VENDORS').map(toVendor);

  return {
    departments,
    vehicleTypes,
    maintenanceCategories,
    vendors,
    addDepartment: (d) =>
      addItem('DEPARTMENTS', {
        code: d.code,
        label: d.name,
        status: d.isActive ? 'active' : 'inactive',
        attrs: { head: d.head },
      }),
    updateDepartment: (id, u) =>
      updateItem(id, {
        ...(u.code !== undefined && { code: u.code }),
        ...(u.name !== undefined && { label: u.name }),
        ...(u.isActive !== undefined && {
          status: u.isActive ? ('active' as const) : ('inactive' as const),
        }),
        attrs: { head: u.head ?? departments.find((d) => d.id === id)?.head ?? '' },
      }),
    deleteDepartment: (id) => deleteItem(id),
    addVehicleType: (v) =>
      addItem('VEHICLE_TYPES', {
        code: v.code,
        label: v.label,
        status: v.isActive ? 'active' : 'inactive',
        attrs: { category: v.category, pms_interval_km: v.pmsIntervalKm },
      }),
    updateVehicleType: (id, u) => {
      const existing = vehicleTypes.find((v) => v.id === id);
      updateItem(id, {
        ...(u.code !== undefined && { code: u.code }),
        ...(u.label !== undefined && { label: u.label }),
        ...(u.isActive !== undefined && {
          status: u.isActive ? ('active' as const) : ('inactive' as const),
        }),
        attrs: {
          category: u.category ?? existing?.category ?? 'medium',
          pms_interval_km: u.pmsIntervalKm ?? existing?.pmsIntervalKm ?? 5000,
        },
      });
    },
    deleteVehicleType: (id) => deleteItem(id),
    addMaintenanceCategory: (m) =>
      addItem('MAINTENANCE_CATEGORIES', {
        code: m.code,
        label: m.name,
        status: m.isActive ? 'active' : 'inactive',
        attrs: { description: m.description },
      }),
    updateMaintenanceCategory: (id, u) =>
      updateItem(id, {
        ...(u.code !== undefined && { code: u.code }),
        ...(u.name !== undefined && { label: u.name }),
        ...(u.isActive !== undefined && {
          status: u.isActive ? ('active' as const) : ('inactive' as const),
        }),
        attrs: {
          description:
            u.description ?? maintenanceCategories.find((m) => m.id === id)?.description ?? '',
        },
      }),
    deleteMaintenanceCategory: (id) => deleteItem(id),
    addVendor: (v) =>
      addItem('VENDORS', {
        code: v.name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .slice(0, 20),
        label: v.name,
        status: v.isActive ? 'active' : 'inactive',
        attrs: {
          contact_person: v.contactPerson,
          phone: v.phone,
          specialization: v.specialization,
        },
      }),
    updateVendor: (id, u) => {
      const existing = vendors.find((v) => v.id === id);
      updateItem(id, {
        ...(u.name !== undefined && { label: u.name }),
        ...(u.isActive !== undefined && {
          status: u.isActive ? ('active' as const) : ('inactive' as const),
        }),
        attrs: {
          contact_person: u.contactPerson ?? existing?.contactPerson ?? '',
          phone: u.phone ?? existing?.phone ?? '',
          specialization: u.specialization ?? existing?.specialization ?? '',
        },
      });
    },
    deleteVendor: (id) => deleteItem(id),
  };
}
