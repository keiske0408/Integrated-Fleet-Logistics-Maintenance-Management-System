import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOfflineQueue,
  enqueueOfflineMutation,
  removeOfflineMutation,
  clearOfflineQueue,
  syncOfflineQueue,
} from '../src/lib/offlineQueue';

describe('TICKET-112: Driver Mobile Quick-Log & Offline Queue', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    clearOfflineQueue();
  });

  it('should initialize with an empty queue', () => {
    expect(getOfflineQueue()).toEqual([]);
  });

  it('should enqueue an odometer mutation with unique ID and ISO timestamp', () => {
    const mutation = enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-123',
      endingKm: 45200,
      plateNumber: 'ABC-1234',
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.timestamp).toBeDefined();
    expect(mutation.type).toBe('UPDATE_ODOMETER');
    expect(mutation.endingKm).toBe(45200);

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(mutation.id);
  });

  it('should supersede previous pending odometer reading for the same vehicle', () => {
    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-123',
      endingKm: 45000,
      plateNumber: 'ABC-1234',
    });

    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-123',
      endingKm: 45150,
      plateNumber: 'ABC-1234',
    });

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].endingKm).toBe(45150);
  });

  it('should allow multiple different vehicles to have queued readings', () => {
    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-1',
      endingKm: 12000,
      plateNumber: 'ABC-111',
    });

    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-2',
      endingKm: 24000,
      plateNumber: 'XYZ-222',
    });

    const queue = getOfflineQueue();
    expect(queue.length).toBe(2);
  });

  it('should enqueue trip completion mutations independently', () => {
    enqueueOfflineMutation({
      type: 'COMPLETE_TRIP',
      tsrfId: 'tsrf-001',
      requestNumber: 'TSRF-2026-001',
      endingKm: 35050,
      assignedVehicleId: 'veh-1',
    });

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].type).toBe('COMPLETE_TRIP');
  });

  it('should remove a mutation by ID', () => {
    const item1 = enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-1',
      endingKm: 10000,
    });
    const item2 = enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-2',
      endingKm: 20000,
    });

    expect(getOfflineQueue().length).toBe(2);

    removeOfflineMutation(item1.id);

    const remaining = getOfflineQueue();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(item2.id);
  });

  it('should sync successfully queued requests with the server and empty the queue', async () => {
    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-1',
      endingKm: 55000,
    });
    enqueueOfflineMutation({
      type: 'COMPLETE_TRIP',
      tsrfId: 'tsrf-100',
      endingKm: 55000,
    });

    expect(getOfflineQueue().length).toBe(2);

    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    const result = await syncOfflineQueue(mockFetcher as unknown as typeof fetch);

    expect(result.total).toBe(2);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(getOfflineQueue().length).toBe(0);
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('should retain failed mutations in queue with error message recorded', async () => {
    enqueueOfflineMutation({
      type: 'UPDATE_ODOMETER',
      vehicleId: 'veh-fail',
      endingKm: 99999,
    });

    const mockFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database unavailable' }),
    } as Response);

    const result = await syncOfflineQueue(mockFetcher as unknown as typeof fetch);

    expect(result.total).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].error).toContain('Database unavailable');
  });
});
