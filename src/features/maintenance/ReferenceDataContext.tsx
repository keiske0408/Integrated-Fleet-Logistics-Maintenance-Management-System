import React, { createContext, useContext, useState } from 'react';

// ─── Reference Data Types ─────────────────────────────────────────────────────

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

// ─── Default Seed Data ────────────────────────────────────────────────────────

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'd-1', code: 'FLEET', name: 'Fleet Operations', head: 'Marco Reyes', isActive: true },
  { id: 'd-2', code: 'LOG', name: 'Logistics & Dispatch', head: 'Roberto Santos', isActive: true },
  { id: 'd-3', code: 'FIN', name: 'Finance & Accounting', head: 'Sandra Cruz', isActive: true },
  { id: 'd-4', code: 'PROC', name: 'Procurement', head: 'Jose Lim', isActive: true },
  { id: 'd-5', code: 'HR', name: 'Human Resources', head: 'Ana Santos', isActive: true },
  { id: 'd-6', code: 'IT', name: 'Information Technology', head: 'Bryan Tan', isActive: true },
  { id: 'd-7', code: 'ADMIN', name: 'Administration', head: 'Maria Garcia', isActive: true },
  { id: 'd-8', code: 'OPS', name: 'Field Operations', head: 'Carlos Villanueva', isActive: true },
];

const DEFAULT_VEHICLE_TYPES: VehicleType[] = [
  { id: 'vt-1', code: 'VAN', label: 'Commuter Van', category: 'light', pmsIntervalKm: 5000, isActive: true },
  { id: 'vt-2', code: 'PICKUP', label: 'Pickup Truck', category: 'light', pmsIntervalKm: 5000, isActive: true },
  { id: 'vt-3', code: 'ELF', label: 'Isuzu Elf (4-Wheeler)', category: 'medium', pmsIntervalKm: 5000, isActive: true },
  { id: 'vt-4', code: 'TRUCK6W', label: '6-Wheeler Truck', category: 'heavy', pmsIntervalKm: 5000, isActive: true },
  { id: 'vt-5', code: 'TRUCK10W', label: '10-Wheeler Truck', category: 'heavy', pmsIntervalKm: 5000, isActive: true },
  { id: 'vt-6', code: 'TRAILER', label: 'Trailer / Articulated', category: 'heavy', pmsIntervalKm: 10000, isActive: true },
  { id: 'vt-7', code: 'CRANE', label: 'Crane / Heavy Equipment', category: 'special', pmsIntervalKm: 250, isActive: true },
  { id: 'vt-8', code: 'FORKLIFT', label: 'Forklift', category: 'special', pmsIntervalKm: 250, isActive: true },
];

const DEFAULT_MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  { id: 'mc-1', code: 'PMS', name: 'Preventive Maintenance Service', description: 'Scheduled 5,000 KM oil change, filter replacement', isActive: true },
  { id: 'mc-2', code: 'BRAKE', name: 'Brake System Repair', description: 'Brake pad/disc replacement, hydraulic system', isActive: true },
  { id: 'mc-3', code: 'ENGINE', name: 'Engine Overhaul', description: 'Major engine repair and component replacement', isActive: true },
  { id: 'mc-4', code: 'TIRES', name: 'Tire Replacement', description: 'Tire replacement and rotation service', isActive: true },
  { id: 'mc-5', code: 'ELECTRIC', name: 'Electrical System', description: 'Battery, alternator, wiring, lights repair', isActive: true },
  { id: 'mc-6', code: 'BODY', name: 'Body & Collision Repair', description: 'Dent removal, painting, structural repair', isActive: true },
  { id: 'mc-7', code: 'AIRCON', name: 'Air Conditioning', description: 'A/C compressor, refrigerant, blower repair', isActive: true },
];

const DEFAULT_VENDORS: Vendor[] = [
  { id: 'ven-1', name: 'Pro Auto Service Center', contactPerson: 'Arturo Dela Vega', phone: '09171234567', specialization: 'General PMS & Engine', isActive: true },
  { id: 'ven-2', name: 'Speedy Brake & Tire Shop', contactPerson: 'Leo Maravilla', phone: '09281234567', specialization: 'Brakes & Tires', isActive: true },
  { id: 'ven-3', name: 'Hulma In-House Workshop', contactPerson: 'Fleet Team', phone: 'Internal', specialization: 'All categories', isActive: true },
];

// ─── Context ──────────────────────────────────────────────────────────────────

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

const ReferenceDataContext = createContext<ReferenceDataContextValue | null>(null);

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(DEFAULT_VEHICLE_TYPES);
  const [maintenanceCategories, setMaintenanceCategories] = useState<MaintenanceCategory[]>(DEFAULT_MAINTENANCE_CATEGORIES);
  const [vendors, setVendors] = useState<Vendor[]>(DEFAULT_VENDORS);

  const mkAdd = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (item: Omit<T, 'id'>) =>
      setter((prev) => [...prev, { ...item, id: `ref-${Date.now()}` } as T]);

  const mkUpdate = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string, updates: Partial<T>) =>
      setter((prev) => prev.map((x) => (x.id === id ? { ...x, ...updates } : x)));

  const mkDelete = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string) =>
      setter((prev) => prev.filter((x) => x.id !== id));

  return (
    <ReferenceDataContext.Provider
      value={{
        departments, vehicleTypes, maintenanceCategories, vendors,
        addDepartment: mkAdd(setDepartments),
        updateDepartment: mkUpdate(setDepartments),
        deleteDepartment: mkDelete(setDepartments),
        addVehicleType: mkAdd(setVehicleTypes),
        updateVehicleType: mkUpdate(setVehicleTypes),
        deleteVehicleType: mkDelete(setVehicleTypes),
        addMaintenanceCategory: mkAdd(setMaintenanceCategories),
        updateMaintenanceCategory: mkUpdate(setMaintenanceCategories),
        deleteMaintenanceCategory: mkDelete(setMaintenanceCategories),
        addVendor: mkAdd(setVendors),
        updateVendor: mkUpdate(setVendors),
        deleteVendor: mkDelete(setVendors),
      }}
    >
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData(): ReferenceDataContextValue {
  const ctx = useContext(ReferenceDataContext);
  if (!ctx) throw new Error('useReferenceData must be used inside ReferenceDataProvider');
  return ctx;
}
