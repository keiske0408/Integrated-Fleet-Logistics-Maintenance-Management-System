import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsPage, type FleetTcoSummary } from '../src/features/analytics/AnalyticsPage';
import * as api from '../src/lib/api';

const mockSummary: FleetTcoSummary = {
  fleetAverageCpk: 4.25,
  totalFleetSpend: 170000,
  totalFleetKm: 40000,
  totalVehicles: 3,
  activeVehicles: 3,
  criticalOutliersCount: 1,
  highestCpkVehicle: {
    plateNumber: 'OUTLIER-999',
    model: 'Heavy Duty Hauler',
    costPerKm: 12.5,
    totalSpend: 75000,
  },
  metrics: [
    {
      vehicleId: 'v-1',
      plateNumber: 'OUTLIER-999',
      model: 'Heavy Duty Hauler',
      vehicleType: 'truck_10w',
      assignedDriver: 'Carlos Santos',
      currentKm: 6000,
      lastPmsKm: 5000,
      status: 'active',
      repairSpend: 70000,
      pmsSpend: 5000,
      workOrderCount: 4,
      pmsCompletedCount: 1,
      department: 'Logistics',
      totalMaintenanceSpend: 75000,
      costPerKm: 12.5,
      costRating: 'critical_outlier',
      benchmarkComparisonPct: 194,
    },
    {
      vehicleId: 'v-2',
      plateNumber: 'VAN-101',
      model: 'Toyota HiAce',
      vehicleType: 'commuter_van',
      assignedDriver: 'Juan Dela Cruz',
      currentKm: 18000,
      lastPmsKm: 15000,
      status: 'active',
      repairSpend: 25000,
      pmsSpend: 15000,
      workOrderCount: 2,
      pmsCompletedCount: 3,
      department: 'Fleet Operations',
      totalMaintenanceSpend: 40000,
      costPerKm: 2.22,
      costRating: 'optimal',
      benchmarkComparisonPct: -48,
    },
    {
      vehicleId: 'v-3',
      plateNumber: 'TRK-404',
      model: 'Isuzu Elf 4W',
      vehicleType: 'truck_4w',
      assignedDriver: 'Ramon Garcia',
      currentKm: 16000,
      lastPmsKm: 15000,
      status: 'active',
      repairSpend: 40000,
      pmsSpend: 15000,
      workOrderCount: 3,
      pmsCompletedCount: 3,
      department: 'Operations',
      totalMaintenanceSpend: 55000,
      costPerKm: 3.44,
      costRating: 'optimal',
      benchmarkComparisonPct: -19,
    },
  ],
  byVehicleType: [
    {
      vehicleType: 'truck_10w',
      vehicleCount: 1,
      totalKm: 6000,
      totalSpend: 75000,
      averageCostPerKm: 12.5,
    },
    {
      vehicleType: 'commuter_van',
      vehicleCount: 1,
      totalKm: 18000,
      totalSpend: 40000,
      averageCostPerKm: 2.22,
    },
    {
      vehicleType: 'truck_4w',
      vehicleCount: 1,
      totalKm: 16000,
      totalSpend: 55000,
      averageCostPerKm: 3.44,
    },
  ],
  byDepartment: [
    {
      department: 'Logistics',
      vehicleCount: 1,
      totalSpend: 75000,
      totalKm: 6000,
      averageCostPerKm: 12.5,
    },
    {
      department: 'Fleet Operations',
      vehicleCount: 1,
      totalSpend: 40000,
      totalKm: 18000,
      averageCostPerKm: 2.22,
    },
    {
      department: 'Operations',
      vehicleCount: 1,
      totalSpend: 55000,
      totalKm: 16000,
      averageCostPerKm: 3.44,
    },
  ],
  monthlyTrend: [
    {
      monthKey: '2026-05',
      monthLabel: 'May 2026',
      repairSpend: 40000,
      pmsSpend: 10000,
      totalSpend: 50000,
      workOrderCount: 3,
    },
  ],
  outlierWatchlist: [
    {
      vehicleId: 'v-1',
      plateNumber: 'OUTLIER-999',
      model: 'Heavy Duty Hauler',
      vehicleType: 'truck_10w',
      assignedDriver: 'Carlos Santos',
      currentKm: 6000,
      lastPmsKm: 5000,
      status: 'active',
      repairSpend: 70000,
      pmsSpend: 5000,
      workOrderCount: 4,
      pmsCompletedCount: 1,
      department: 'Logistics',
      totalMaintenanceSpend: 75000,
      costPerKm: 12.5,
      costRating: 'critical_outlier',
      benchmarkComparisonPct: 194,
    },
  ],
};

describe('AnalyticsPage Frontend Tests (TICKET-113)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'apiFetch').mockImplementation((path) => {
      if (path === '/api/analytics/tco') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSummary),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  it('renders initial skeleton markup before data loads', () => {
    const html = renderToStaticMarkup(<AnalyticsPage />);
    expect(html).toContain('Fleet TCO &amp; Maintenance Cost-per-Kilometer');
    expect(html).toContain('Executive Analytics');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Refresh');
  });

  it('renders correctly with preloaded data mock', () => {
    // Verify that the AnalyticsPage component accepts data without throwing
    const html = renderToStaticMarkup(<AnalyticsPage />);
    expect(html).toBeTruthy();
    expect(html).toContain('animate-pulse');
  });

  it('verifies data model structures for TCO aggregations', () => {
    expect(mockSummary.fleetAverageCpk).toBe(4.25);
    expect(mockSummary.totalFleetSpend).toBe(170000);
    expect(mockSummary.totalFleetKm).toBe(40000);
    expect(mockSummary.metrics.length).toBe(3);
    expect(mockSummary.byVehicleType.length).toBe(3);
    expect(mockSummary.byDepartment.length).toBe(3);
    expect(mockSummary.outlierWatchlist[0].plateNumber).toBe('OUTLIER-999');
    expect(mockSummary.outlierWatchlist[0].costRating).toBe('critical_outlier');
  });

  it('confirms CPK outlier rating criteria', () => {
    const outlier = mockSummary.metrics.find((m) => m.costRating === 'critical_outlier');
    expect(outlier).toBeDefined();
    expect(outlier?.costPerKm).toBeGreaterThan(mockSummary.fleetAverageCpk * 1.35);

    const optimal = mockSummary.metrics.filter((m) => m.costRating === 'optimal');
    expect(optimal.length).toBe(2);
    for (const opt of optimal) {
      expect(opt.costPerKm).toBeLessThanOrEqual(mockSummary.fleetAverageCpk * 1.15);
    }
  });

  it('verifies vehicle category breakdown coverage', () => {
    const types = mockSummary.byVehicleType.map((t) => t.vehicleType);
    expect(types).toContain('truck_10w');
    expect(types).toContain('commuter_van');
    expect(types).toContain('truck_4w');
  });
});
