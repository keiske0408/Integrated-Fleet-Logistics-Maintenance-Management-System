import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from './api';

export interface OdometerMutation {
  id: string;
  type: 'UPDATE_ODOMETER';
  vehicleId: string;
  plateNumber?: string;
  endingKm: number;
  timestamp: string;
  synced?: boolean;
  error?: string;
}

export interface CompleteTripMutation {
  id: string;
  type: 'COMPLETE_TRIP';
  tsrfId: string;
  requestNumber?: string;
  endingKm: number;
  assignedVehicleId?: string;
  timestamp: string;
  synced?: boolean;
  error?: string;
}

export type OfflineMutation = OdometerMutation | CompleteTripMutation;

export interface OfflineSyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

const STORAGE_KEY = 'hulma_fleet_offline_queue_v1';
const LISTENERS = new Set<(queue: OfflineMutation[]) => void>();
const MEMORY_STORAGE = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Ignore security/restricted access errors
    }
  }
  return MEMORY_STORAGE.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota/security errors
    }
  }
  MEMORY_STORAGE.set(key, value);
}

function notifyListeners(queue: OfflineMutation[]) {
  LISTENERS.forEach((listener) => {
    try {
      listener(queue);
    } catch {
      // Ignore listener error
    }
  });
}

export function getOfflineQueue(): OfflineMutation[] {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineMutation[]): void {
  try {
    setStorageItem(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners(queue);
  } catch {
    // Storage quota or serialization issue
  }
}

export function enqueueOfflineMutation(
  mutation:
    Omit<OdometerMutation, 'id' | 'timestamp'> | Omit<CompleteTripMutation, 'id' | 'timestamp'>,
): OfflineMutation {
  const queue = getOfflineQueue();
  const id = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();
  const fullMutation: OfflineMutation = {
    ...mutation,
    id,
    timestamp,
  } as OfflineMutation;

  // If there's an existing pending odometer update for the same vehicle, supersede it with the newer reading
  let nextQueue: OfflineMutation[];
  if (fullMutation.type === 'UPDATE_ODOMETER') {
    const filtered = queue.filter(
      (item) => !(item.type === 'UPDATE_ODOMETER' && item.vehicleId === fullMutation.vehicleId),
    );
    nextQueue = [...filtered, fullMutation];
  } else {
    nextQueue = [...queue, fullMutation];
  }

  saveOfflineQueue(nextQueue);
  return fullMutation;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineQueue();
  const nextQueue = queue.filter((item) => item.id !== id);
  saveOfflineQueue(nextQueue);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

export async function syncOfflineQueue(
  fetcher: typeof apiFetch = apiFetch,
): Promise<OfflineSyncResult> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];
  const remaining: OfflineMutation[] = [];

  for (const mutation of queue) {
    try {
      if (mutation.type === 'UPDATE_ODOMETER') {
        const res = await fetcher(
          `/api/vehicles/${encodeURIComponent(mutation.vehicleId)}/mileage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endingKm: mutation.endingKm }),
          },
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        synced++;
      } else if (mutation.type === 'COMPLETE_TRIP') {
        const res = await fetcher(
          `/api/tsrf/${encodeURIComponent(mutation.tsrfId)}/complete-trip`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endingKm: mutation.endingKm,
              assignedVehicleId: mutation.assignedVehicleId,
            }),
          },
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        synced++;
      }
    } catch (err: unknown) {
      failed++;
      const errorMessage = (err as Error).message || 'Network sync failed';
      errors.push({ id: mutation.id, error: errorMessage });
      remaining.push({ ...mutation, error: errorMessage });
    }
  }

  saveOfflineQueue(remaining);

  return {
    total: queue.length,
    synced,
    failed,
    errors,
  };
}

export function subscribeToOfflineQueue(callback: (queue: OfflineMutation[]) => void): () => void {
  LISTENERS.add(callback);
  return () => {
    LISTENERS.delete(callback);
  };
}

/**
 * React hook for managing network connectivity and offline mutation queue.
 */
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queue, setQueue] = useState<OfflineMutation[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<OfflineSyncResult | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when transitioning back online
      void triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToOfflineQueue((updatedQueue) => {
      setQueue(updatedQueue);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setLastSyncResult(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const enqueueOdometer = useCallback(
    (vehicleId: string, endingKm: number, plateNumber?: string) => {
      return enqueueOfflineMutation({
        type: 'UPDATE_ODOMETER',
        vehicleId,
        endingKm,
        plateNumber,
      });
    },
    [],
  );

  const enqueueCompleteTrip = useCallback(
    (tsrfId: string, endingKm: number, assignedVehicleId?: string, requestNumber?: string) => {
      return enqueueOfflineMutation({
        type: 'COMPLETE_TRIP',
        tsrfId,
        endingKm,
        assignedVehicleId,
        requestNumber,
      });
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    removeOfflineMutation(id);
  }, []);

  const clearQueue = useCallback(() => {
    clearOfflineQueue();
  }, []);

  return {
    isOnline,
    queue,
    pendingCount: queue.length,
    isSyncing,
    lastSyncResult,
    triggerSync,
    enqueueOdometer,
    enqueueCompleteTrip,
    removeItem,
    clearQueue,
  };
}
