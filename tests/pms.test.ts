import { describe, it, expect } from 'vitest';
import {
  calculateNextPmsDueKm,
  isPmsOverdue,
  DEFAULT_MANUFACTURER_PMS_INTERVAL_KM,
} from '../src/domain/pms';

describe('Domain Rule 1: PMS Due Mileage Calculation', () => {
  it('should calculate next PMS due mileage using default 5,000 km interval', () => {
    const lastPmsKm = 10000;
    const nextDueKm = calculateNextPmsDueKm(lastPmsKm);

    expect(nextDueKm).toBe(15000);
    expect(DEFAULT_MANUFACTURER_PMS_INTERVAL_KM).toBe(5000);
  });

  it('should support per-vehicle manufacturer interval overrides (e.g. heavy trucks at 10,000 km)', () => {
    const lastPmsKm = 20000;
    const truckIntervalKm = 10000;
    const nextDueKm = calculateNextPmsDueKm(lastPmsKm, truckIntervalKm);

    expect(nextDueKm).toBe(30000);
  });

  it('should flag vehicle as PMS due when current KM reaches or exceeds interval threshold', () => {
    const vehicleState = {
      currentKm: 15000,
      lastCompletedPmsKm: 10000,
      intervalKm: 5000,
    };

    expect(isPmsOverdue(vehicleState)).toBe(true);

    const vehicleOverdueState = {
      currentKm: 15450,
      lastCompletedPmsKm: 10000,
      intervalKm: 5000,
    };

    expect(isPmsOverdue(vehicleOverdueState)).toBe(true);
  });

  it('should not flag vehicle when current KM is below next due interval threshold', () => {
    const vehicleState = {
      currentKm: 14200,
      lastCompletedPmsKm: 10000,
      intervalKm: 5000,
    };

    expect(isPmsOverdue(vehicleState)).toBe(false);
  });
});
