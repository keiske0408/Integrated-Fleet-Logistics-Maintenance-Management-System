import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import type {
  LovList,
  LovAttribute,
  LovItem,
  LovListFormData,
  LovItemFormData,
  LovItemStatus,
} from './types';

async function lovRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/lov${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Reference data request failed.');
  return result as T;
}

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
  syncError: string | null;
  getList: (code: string) => LovList | undefined;
  getAttributes: (listCode: string) => LovAttribute[];
  getItems: (listCode: string) => LovItem[];
  getActiveItems: (listCode: string) => LovItem[];

  addList: (data: LovListFormData) => Promise<void>;
  updateList: (id: string, updates: Partial<LovList>) => Promise<void>;

  addAttribute: (listCode: string, attr: Omit<LovAttribute, 'id' | 'listCode'>) => Promise<void>;
  updateAttribute: (id: string, updates: Partial<LovAttribute>) => Promise<void>;
  deleteAttribute: (id: string) => Promise<void>;

  addItem: (listCode: string, data: LovItemFormData) => Promise<void>;
  updateItem: (id: string, updates: Partial<LovItemFormData>) => Promise<void>;
  deactivateItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

const LovContext = createContext<LovContextValue | null>(null);

export function LovProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [lists, setLists] = useState<LovList[]>(SEED_LISTS);
  const [attributes, setAttributes] = useState<LovAttribute[]>(SEED_ATTRIBUTES);
  const [items, setItems] = useState<LovItem[]>(SEED_ITEMS);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const serverLists = await lovRequest<Array<LovList>>('/lists');
        const collections = await Promise.all(
          serverLists.map(async (list) => {
            const [metadata, serverItems] = await Promise.all([
              lovRequest<
                LovList & {
                  attributes: Array<Omit<LovAttribute, 'listCode'> & { options: string[] }>;
                }
              >(`/lists/${encodeURIComponent(list.code)}`),
              lovRequest<Array<Omit<LovItem, 'listCode'> & { attrs: LovItem['attrs'] }>>(
                `/lists/${encodeURIComponent(list.code)}/items`,
              ),
            ]);
            return {
              list: metadata,
              attributes: metadata.attributes.map((attribute) => ({
                ...attribute,
                listCode: list.code,
              })),
              items: serverItems.map((item) => ({ ...item, listCode: list.code })),
            };
          }),
        );
        if (cancelled) return;
        setLists(
          collections.map(({ list }) => ({
            id: list.id,
            code: list.code,
            name: list.name,
            description: list.description,
            isSystem: list.isSystem,
            supportsHierarchy: list.supportsHierarchy,
            status: list.status,
          })),
        );
        setAttributes(collections.flatMap(({ attributes: listAttributes }) => listAttributes));
        setItems(collections.flatMap(({ items: listItems }) => listItems));
        setApiAvailable(true);
        setSyncError(null);
      } catch (error) {
        if (!cancelled) {
          setApiAvailable(false);
          setSyncError(
            error instanceof Error
              ? error.message
              : 'Reference data API unavailable; using local seed data.',
          );
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

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

  const request = useCallback(
    async <T,>(path: string, method: string, body?: unknown): Promise<T | null> => {
      try {
        return await lovRequest<T>(path, {
          method,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reference data request failed.';
        setSyncError(message);
        return null;
      }
    },
    [],
  );

  // ── List CRUD ─────────────────────────────────────────────────────────────

  const addList = useCallback(
    async (data: LovListFormData) => {
      if (apiAvailable) {
        const list = await request<LovList>('/lists', 'POST', data);
        if (!list) return;
        setLists((prev) => [...prev, list]);
        setSyncError(null);
        return;
      }
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
    },
    [apiAvailable, request],
  );

  const updateList = useCallback(
    async (id: string, updates: Partial<LovList>) => {
      if (apiAvailable) {
        const list = await request<LovList>(`/lists/${encodeURIComponent(id)}`, 'PUT', updates);
        if (!list) return;
        setLists((prev) => prev.map((current) => (current.id === id ? list : current)));
        setSyncError(null);
        return;
      }
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    },
    [apiAvailable, request],
  );

  // ── Attribute CRUD ────────────────────────────────────────────────────────

  const addAttribute = useCallback(
    async (listCode: string, attr: Omit<LovAttribute, 'id' | 'listCode'>) => {
      if (apiAvailable) {
        const saved = await request<Omit<LovAttribute, 'listCode'>>(
          `/lists/${encodeURIComponent(listCode)}/attributes`,
          'POST',
          attr,
        );
        if (!saved) return;
        setAttributes((prev) => [...prev, { ...saved, listCode }]);
        setSyncError(null);
        return;
      }
      const newAttr: LovAttribute = {
        ...attr,
        id: `lov-a-${Date.now()}`,
        listCode,
      };
      setAttributes((prev) => [...prev, newAttr]);
    },
    [apiAvailable, request],
  );

  const updateAttribute = useCallback(
    async (id: string, updates: Partial<LovAttribute>) => {
      if (apiAvailable) {
        const saved = await request<Omit<LovAttribute, 'listCode'>>(
          `/attributes/${encodeURIComponent(id)}`,
          'PUT',
          updates,
        );
        if (!saved) return;
        setAttributes((prev) =>
          prev.map((attribute) =>
            attribute.id === id ? { ...saved, listCode: attribute.listCode } : attribute,
          ),
        );
        setSyncError(null);
        return;
      }
      setAttributes((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    },
    [apiAvailable, request],
  );

  const deleteAttribute = useCallback(
    async (id: string) => {
      if (apiAvailable && !(await request(`/attributes/${encodeURIComponent(id)}`, 'DELETE')))
        return;
      setAttributes((prev) => prev.filter((a) => a.id !== id));
      setSyncError(null);
    },
    [apiAvailable, request],
  );

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  const addItem = useCallback(
    async (listCode: string, data: LovItemFormData) => {
      if (apiAvailable) {
        const saved = await request<Omit<LovItem, 'listCode'>>(
          `/lists/${encodeURIComponent(listCode)}/items`,
          'POST',
          data,
        );
        if (!saved) return;
        setItems((prev) => [...prev, { ...saved, listCode }]);
        setSyncError(null);
        return;
      }
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
    },
    [apiAvailable, request],
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<LovItemFormData>) => {
      if (apiAvailable) {
        const saved = await request<Omit<LovItem, 'listCode'>>(
          `/items/${encodeURIComponent(id)}`,
          'PUT',
          updates,
        );
        if (!saved) return;
        const existing = items.find((item) => item.id === id);
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...saved, listCode: existing?.listCode ?? item.listCode } : item,
          ),
        );
        setSyncError(null);
        return;
      }
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
    },
    [apiAvailable, items, request],
  );

  const deactivateItem = useCallback(
    async (id: string) => {
      if (apiAvailable) {
        if (!(await request(`/items/${encodeURIComponent(id)}`, 'DELETE'))) return;
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'inactive' } : item)),
        );
        setSyncError(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'inactive' as LovItemStatus } : item,
        ),
      );
    },
    [apiAvailable, request],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (apiAvailable) {
        if (!(await request(`/items/${encodeURIComponent(id)}`, 'DELETE'))) return;
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'inactive' } : item)),
        );
        setSyncError(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'inactive' as LovItemStatus } : item,
        ),
      );
    },
    [apiAvailable, request],
  );

  return (
    <LovContext.Provider
      value={{
        lists,
        syncError,
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
