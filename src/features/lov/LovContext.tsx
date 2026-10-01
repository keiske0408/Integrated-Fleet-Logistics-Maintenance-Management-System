import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  LovList,
  LovAttribute,
  LovItem,
  LovListFormData,
  LovItemFormData,
  LovItemStatus,
} from './types';

// ─── Seed Data: Lists ─────────────────────────────────────────────────────────

const SEED_LISTS: LovList[] = [
  {
    id: 'lov-l1',
    code: 'DEPARTMENTS',
    name: 'Departments',
    description: 'Organizational departments',
    isSystem: true,
    supportsHierarchy: false,
    status: 'active',
  },
  {
    id: 'lov-l2',
    code: 'VEHICLE_TYPES',
    name: 'Vehicle Types',
    description: 'Fleet vehicle categories and types',
    isSystem: true,
    supportsHierarchy: false,
    status: 'active',
  },
  {
    id: 'lov-l3',
    code: 'MAINTENANCE_CATEGORIES',
    name: 'Maintenance',
    description: 'Maintenance service categories',
    isSystem: true,
    supportsHierarchy: false,
    status: 'active',
  },
  {
    id: 'lov-l4',
    code: 'VENDORS',
    name: 'Vendors',
    description: 'Service providers and repair shops',
    isSystem: true,
    supportsHierarchy: false,
    status: 'active',
  },
];

// ─── Seed Data: Attributes ────────────────────────────────────────────────────

const SEED_ATTRIBUTES: LovAttribute[] = [
  // Departments
  {
    id: 'lov-a1',
    listCode: 'DEPARTMENTS',
    key: 'head',
    label: 'Department Head',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 0,
    options: [],
  },
  // Vehicle Types
  {
    id: 'lov-a2',
    listCode: 'VEHICLE_TYPES',
    key: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    showInGrid: true,
    sortOrder: 0,
    options: ['light', 'medium', 'heavy', 'special'],
  },
  {
    id: 'lov-a3',
    listCode: 'VEHICLE_TYPES',
    key: 'pms_interval_km',
    label: 'PMS Interval (km)',
    type: 'number',
    required: true,
    showInGrid: true,
    sortOrder: 1,
    options: [],
  },
  // Maintenance Categories
  {
    id: 'lov-a4',
    listCode: 'MAINTENANCE_CATEGORIES',
    key: 'description',
    label: 'Description',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 0,
    options: [],
  },
  // Vendors
  {
    id: 'lov-a5',
    listCode: 'VENDORS',
    key: 'contact_person',
    label: 'Contact Person',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 0,
    options: [],
  },
  {
    id: 'lov-a6',
    listCode: 'VENDORS',
    key: 'phone',
    label: 'Phone',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 1,
    options: [],
  },
  {
    id: 'lov-a7',
    listCode: 'VENDORS',
    key: 'specialization',
    label: 'Specialization',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 2,
    options: [],
  },
];

// ─── Seed Data: Items ─────────────────────────────────────────────────────────

const SEED_ITEMS: LovItem[] = [
  // Departments
  {
    id: 'lov-d1',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'FLEET',
    label: 'Fleet Operations',
    sortOrder: 0,
    status: 'active',
    attrs: { head: 'Marco Reyes' },
  },
  {
    id: 'lov-d2',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'LOG',
    label: 'Logistics & Dispatch',
    sortOrder: 1,
    status: 'active',
    attrs: { head: 'Roberto Santos' },
  },
  {
    id: 'lov-d3',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'FIN',
    label: 'Finance & Accounting',
    sortOrder: 2,
    status: 'active',
    attrs: { head: 'Sandra Cruz' },
  },
  {
    id: 'lov-d4',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'PROC',
    label: 'Procurement',
    sortOrder: 3,
    status: 'active',
    attrs: { head: 'Jose Lim' },
  },
  {
    id: 'lov-d5',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'HR',
    label: 'Human Resources',
    sortOrder: 4,
    status: 'active',
    attrs: { head: 'Ana Santos' },
  },
  {
    id: 'lov-d6',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'IT',
    label: 'Information Technology',
    sortOrder: 5,
    status: 'active',
    attrs: { head: 'Bryan Tan' },
  },
  {
    id: 'lov-d7',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'ADMIN',
    label: 'Administration',
    sortOrder: 6,
    status: 'active',
    attrs: { head: 'Maria Garcia' },
  },
  {
    id: 'lov-d8',
    listCode: 'DEPARTMENTS',
    parentId: null,
    code: 'OPS',
    label: 'Field Operations',
    sortOrder: 7,
    status: 'active',
    attrs: { head: 'Carlos Villanueva' },
  },

  // Vehicle Types
  {
    id: 'lov-vt1',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'VAN',
    label: 'Commuter Van',
    sortOrder: 0,
    status: 'active',
    attrs: { category: 'light', pms_interval_km: 5000 },
  },
  {
    id: 'lov-vt2',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'PICKUP',
    label: 'Pickup Truck',
    sortOrder: 1,
    status: 'active',
    attrs: { category: 'light', pms_interval_km: 5000 },
  },
  {
    id: 'lov-vt3',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'ELF',
    label: 'Isuzu Elf (4-Wheeler)',
    sortOrder: 2,
    status: 'active',
    attrs: { category: 'medium', pms_interval_km: 5000 },
  },
  {
    id: 'lov-vt4',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'TRUCK6W',
    label: '6-Wheeler Truck',
    sortOrder: 3,
    status: 'active',
    attrs: { category: 'heavy', pms_interval_km: 5000 },
  },
  {
    id: 'lov-vt5',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'TRUCK10W',
    label: '10-Wheeler Truck',
    sortOrder: 4,
    status: 'active',
    attrs: { category: 'heavy', pms_interval_km: 5000 },
  },
  {
    id: 'lov-vt6',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'TRAILER',
    label: 'Trailer / Articulated',
    sortOrder: 5,
    status: 'active',
    attrs: { category: 'heavy', pms_interval_km: 10000 },
  },
  {
    id: 'lov-vt7',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'CRANE',
    label: 'Crane / Heavy Equipment',
    sortOrder: 6,
    status: 'active',
    attrs: { category: 'special', pms_interval_km: 250 },
  },
  {
    id: 'lov-vt8',
    listCode: 'VEHICLE_TYPES',
    parentId: null,
    code: 'FORKLIFT',
    label: 'Forklift',
    sortOrder: 7,
    status: 'active',
    attrs: { category: 'special', pms_interval_km: 250 },
  },

  // Maintenance Categories
  {
    id: 'lov-mc1',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'PMS',
    label: 'Preventive Maintenance Service',
    sortOrder: 0,
    status: 'active',
    attrs: { description: 'Scheduled 5,000 KM oil change, filter replacement' },
  },
  {
    id: 'lov-mc2',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'BRAKE',
    label: 'Brake System Repair',
    sortOrder: 1,
    status: 'active',
    attrs: { description: 'Brake pad/disc replacement, hydraulic system' },
  },
  {
    id: 'lov-mc3',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'ENGINE',
    label: 'Engine Overhaul',
    sortOrder: 2,
    status: 'active',
    attrs: { description: 'Major engine repair and component replacement' },
  },
  {
    id: 'lov-mc4',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'TIRES',
    label: 'Tire Replacement',
    sortOrder: 3,
    status: 'active',
    attrs: { description: 'Tire replacement and rotation service' },
  },
  {
    id: 'lov-mc5',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'ELECTRIC',
    label: 'Electrical System',
    sortOrder: 4,
    status: 'active',
    attrs: { description: 'Battery, alternator, wiring, lights repair' },
  },
  {
    id: 'lov-mc6',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'BODY',
    label: 'Body & Collision Repair',
    sortOrder: 5,
    status: 'active',
    attrs: { description: 'Dent removal, painting, structural repair' },
  },
  {
    id: 'lov-mc7',
    listCode: 'MAINTENANCE_CATEGORIES',
    parentId: null,
    code: 'AIRCON',
    label: 'Air Conditioning',
    sortOrder: 6,
    status: 'active',
    attrs: { description: 'A/C compressor, refrigerant, blower repair' },
  },

  // Vendors
  {
    id: 'lov-ven1',
    listCode: 'VENDORS',
    parentId: null,
    code: 'PRO_AUTO',
    label: 'Pro Auto Service Center',
    sortOrder: 0,
    status: 'active',
    attrs: {
      contact_person: 'Arturo Dela Vega',
      phone: '09171234567',
      specialization: 'General PMS & Engine',
    },
  },
  {
    id: 'lov-ven2',
    listCode: 'VENDORS',
    parentId: null,
    code: 'SPEEDY_BRAKE',
    label: 'Speedy Brake & Tire Shop',
    sortOrder: 1,
    status: 'active',
    attrs: {
      contact_person: 'Leo Maravilla',
      phone: '09281234567',
      specialization: 'Brakes & Tires',
    },
  },
  {
    id: 'lov-ven3',
    listCode: 'VENDORS',
    parentId: null,
    code: 'HULMA_WORKSHOP',
    label: 'Hulma In-House Workshop',
    sortOrder: 2,
    status: 'active',
    attrs: { contact_person: 'Fleet Team', phone: 'Internal', specialization: 'All categories' },
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface LovContextValue {
  lists: LovList[];
  getList: (code: string) => LovList | undefined;
  getAttributes: (listCode: string) => LovAttribute[];
  getItems: (listCode: string) => LovItem[];
  getActiveItems: (listCode: string) => LovItem[];

  addList: (data: LovListFormData) => void;
  updateList: (id: string, updates: Partial<LovList>) => void;

  addAttribute: (listCode: string, attr: Omit<LovAttribute, 'id' | 'listCode'>) => void;
  updateAttribute: (id: string, updates: Partial<LovAttribute>) => void;
  deleteAttribute: (id: string) => void;

  addItem: (listCode: string, data: LovItemFormData) => void;
  updateItem: (id: string, updates: Partial<LovItemFormData>) => void;
  deactivateItem: (id: string) => void;
  deleteItem: (id: string) => void;
}

const LovContext = createContext<LovContextValue | null>(null);

export function LovProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<LovList[]>(SEED_LISTS);
  const [attributes, setAttributes] = useState<LovAttribute[]>(SEED_ATTRIBUTES);
  const [items, setItems] = useState<LovItem[]>(SEED_ITEMS);

  const getList = useCallback((code: string) => lists.find((l) => l.code === code), [lists]);

  const getAttributes = useCallback(
    (listCode: string) =>
      attributes.filter((a) => a.listCode === listCode).sort((a, b) => a.sortOrder - b.sortOrder),
    [attributes],
  );

  const getItems = useCallback(
    (listCode: string) =>
      items.filter((i) => i.listCode === listCode).sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const getActiveItems = useCallback(
    (listCode: string) => getItems(listCode).filter((i) => i.status === 'active'),
    [getItems],
  );

  // ── List CRUD ─────────────────────────────────────────────────────────────

  const addList = useCallback((data: LovListFormData) => {
    const newList: LovList = {
      id: `lov-l-${Date.now()}`,
      code: data.code,
      name: data.name,
      description: data.description,
      isSystem: false,
      supportsHierarchy: data.supportsHierarchy,
      status: 'active',
    };
    setLists((prev) => [...prev, newList]);
  }, []);

  const updateList = useCallback((id: string, updates: Partial<LovList>) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  }, []);

  // ── Attribute CRUD ────────────────────────────────────────────────────────

  const addAttribute = useCallback(
    (listCode: string, attr: Omit<LovAttribute, 'id' | 'listCode'>) => {
      const newAttr: LovAttribute = {
        ...attr,
        id: `lov-a-${Date.now()}`,
        listCode,
      };
      setAttributes((prev) => [...prev, newAttr]);
    },
    [],
  );

  const updateAttribute = useCallback((id: string, updates: Partial<LovAttribute>) => {
    setAttributes((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const deleteAttribute = useCallback((id: string) => {
    setAttributes((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  const addItem = useCallback((listCode: string, data: LovItemFormData) => {
    const newItem: LovItem = {
      id: `lov-i-${Date.now()}`,
      listCode,
      parentId: null,
      code: data.code,
      label: data.label,
      sortOrder: 0,
      status: data.status,
      attrs: data.attrs,
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<LovItemFormData>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          ...(updates.code !== undefined && { code: updates.code }),
          ...(updates.label !== undefined && { label: updates.label }),
          ...(updates.status !== undefined && { status: updates.status }),
          ...(updates.attrs !== undefined && { attrs: updates.attrs }),
        };
      }),
    );
  }, []);

  const deactivateItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'inactive' as LovItemStatus } : item,
      ),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'inactive' as LovItemStatus } : item,
      ),
    );
  }, []);

  return (
    <LovContext.Provider
      value={{
        lists,
        getList,
        getAttributes,
        getItems,
        getActiveItems,
        addList,
        updateList,
        addAttribute,
        updateAttribute,
        deleteAttribute,
        addItem,
        updateItem,
        deactivateItem,
        deleteItem,
      }}
    >
      {children}
    </LovContext.Provider>
  );
}

export function useLov(): LovContextValue {
  const ctx = useContext(LovContext);
  if (!ctx) throw new Error('useLov must be used inside LovProvider');
  return ctx;
}
