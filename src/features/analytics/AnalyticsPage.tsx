import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Download,
  Search,
  RotateCw,
  Gauge,
  DollarSign,
  Truck,
  Building,
  Calendar,
  Wrench,
  ChevronRight,
  Info,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface VehicleTcoMetric {
  vehicleId: string;
  plateNumber: string;
  model: string;
  vehicleType: string;
  assignedDriver: string | null;
  currentKm: number;
  lastPmsKm: number;
  status: string;
  repairSpend: number;
  pmsSpend: number;
  workOrderCount: number;
  pmsCompletedCount: number;
  department?: string | null;
  totalMaintenanceSpend: number;
  costPerKm: number;
  costRating: 'optimal' | 'elevated' | 'critical_outlier';
  benchmarkComparisonPct: number;
}

export interface TypeAggregation {
  vehicleType: string;
  vehicleCount: number;
  totalKm: number;
  totalSpend: number;
  averageCostPerKm: number;
}

export interface DepartmentAggregation {
  department: string;
  vehicleCount: number;
  totalSpend: number;
  totalKm: number;
  averageCostPerKm: number;
}

export interface MonthlySpendTrend {
  monthKey: string;
  monthLabel: string;
  repairSpend: number;
  pmsSpend: number;
  totalSpend: number;
  workOrderCount: number;
}

export interface FleetTcoSummary {
  fleetAverageCpk: number;
  totalFleetSpend: number;
  totalFleetKm: number;
  totalVehicles: number;
  activeVehicles: number;
  criticalOutliersCount: number;
  highestCpkVehicle: {
    plateNumber: string;
    model: string;
    costPerKm: number;
    totalSpend: number;
  } | null;
  metrics: VehicleTcoMetric[];
  byVehicleType: TypeAggregation[];
  byDepartment: DepartmentAggregation[];
  monthlyTrend: MonthlySpendTrend[];
  outlierWatchlist: VehicleTcoMetric[];
}

export interface VehicleDetailResponse {
  vehicle: {
    id: string;
    plateNumber: string;
    model: string;
    vehicleType: string;
    currentKm: number;
    lastPmsKm: number;
    assignedDriver: string | null;
    status: string;
  };
  costSummary: {
    currentKm: number;
    totalRepairSpend: number;
    totalPmsSpend: number;
    totalMaintenanceSpend: number;
    costPerKm: number;
    workOrderCount: number;
    completedPmsCount: number;
  };
  workOrders: Array<{
    id: string;
    workOrderNumber: string;
    description: string;
    status: string;
    cost: number;
    prNumber: string | null;
    prStatus: string | null;
    createdAt: string;
  }>;
  pmsHistory: Array<{
    id: string;
    pmsKm: number;
    status: string;
    notes: string | null;
    completedAt: string | null;
  }>;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  commuter_van: 'Commuter Van',
  truck_4w: '4W Truck',
  truck_6w: '6W Forward Truck',
  truck_10w: '10W Heavy Truck',
  container_unit: 'Container Unit',
  '3pl_provider': '3PL Partner Fleet',
};

export function AnalyticsPage() {
  const [data, setData] = useState<FleetTcoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [sortBy, setSortBy] = useState<'cpk_desc' | 'cpk_asc' | 'spend_desc' | 'km_desc' | 'plate'>(
    'cpk_desc',
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Vehicle Drilldown Modal
  const [drilldownVehicleId, setDrilldownVehicleId] = useState<string | null>(null);
  const [drilldownDetail, setDrilldownDetail] = useState<VehicleDetailResponse | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Fetch summary
  const fetchTcoData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/tco');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const summary: FleetTcoSummary = await res.json();
      setData(summary);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load TCO analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTcoData();
  }, [fetchTcoData]);

  // Fetch drilldown detail when modal opens
  const handleOpenDrilldown = useCallback(async (vehicleId: string) => {
    setDrilldownVehicleId(vehicleId);
    setDrilldownLoading(true);
    setDrilldownDetail(null);
    try {
      const res = await apiFetch(`/api/analytics/vehicles/${encodeURIComponent(vehicleId)}`);
      if (res.ok) {
        const detail: VehicleDetailResponse = await res.json();
        setDrilldownDetail(detail);
      }
    } catch {
      // Graceful fallback
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  // Filtered & Sorted vehicle list
  const filteredMetrics = useMemo(() => {
    if (!data?.metrics) return [];
    let list = [...data.metrics];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.plateNumber.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q) ||
          (m.assignedDriver && m.assignedDriver.toLowerCase().includes(q)) ||
          (m.department && m.department.toLowerCase().includes(q)),
      );
    }

    if (selectedType !== 'all') {
      list = list.filter((m) => m.vehicleType === selectedType);
    }

    if (selectedRating !== 'all') {
      list = list.filter((m) => m.costRating === selectedRating);
    }

    list.sort((a, b) => {
      if (sortBy === 'cpk_desc') return b.costPerKm - a.costPerKm;
      if (sortBy === 'cpk_asc') return a.costPerKm - b.costPerKm;
      if (sortBy === 'spend_desc') return b.totalMaintenanceSpend - a.totalMaintenanceSpend;
      if (sortBy === 'km_desc') return b.currentKm - a.currentKm;
      return a.plateNumber.localeCompare(b.plateNumber);
    });

    return list;
  }, [data, searchQuery, selectedType, selectedRating, sortBy]);

  // Paginated vehicles
  const paginatedMetrics = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMetrics.slice(start, start + pageSize);
  }, [filteredMetrics, currentPage, pageSize]);

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    if (!data?.metrics) return;
    const headers = [
      'Plate Number',
      'Model',
      'Vehicle Type',
      'Department',
      'Assigned Driver',
      'Current KM',
      'Total Maintenance Spend (PHP)',
      'Repair Spend (PHP)',
      'PMS Spend (PHP)',
      'Work Orders Count',
      'Completed PMS Count',
      'Cost per KM (PHP/KM)',
      'Cost Rating',
      'Benchmark Comparison (%)',
    ];

    const rows = data.metrics.map((m) => [
      m.plateNumber,
      `"${m.model.replace(/"/g, '""')}"`,
      VEHICLE_TYPE_LABELS[m.vehicleType] || m.vehicleType,
      `"${(m.department || 'Fleet Operations').replace(/"/g, '""')}"`,
      `"${(m.assignedDriver || 'Unassigned').replace(/"/g, '""')}"`,
      m.currentKm,
      m.totalMaintenanceSpend,
      m.repairSpend,
      m.pmsSpend,
      m.workOrderCount,
      m.pmsCompletedCount,
      m.costPerKm.toFixed(2),
      m.costRating,
      `${m.benchmarkComparisonPct}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fleet_tco_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Export Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Fleet TCO & Maintenance Cost-per-Kilometer
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              Executive Analytics
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total Cost of Ownership (TCO) benchmarks, repair spend aggregations, and high-cost
            vehicle outlier detection.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTcoData}
            disabled={loading}
            className="gap-2"
          >
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            disabled={!data || data.metrics.length === 0}
            className="gap-2 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-card border border-border p-4" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !data && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTcoData}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Fleet Average CPK */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Fleet Avg. Cost / KM
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  ₱{data.fleetAverageCpk.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground font-medium">/ km</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                Aggregated across {data.totalFleetKm.toLocaleString()} recorded KM
              </p>
            </div>

            {/* KPI 2: Total Maintenance Spend */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Fleet Spend
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  ₱{data.totalFleetSpend.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Approved PRs & completed PMS overhauls
              </p>
            </div>

            {/* KPI 3: Total Tracked Distance */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Tracked Distance
                </span>
                <Gauge className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {data.totalFleetKm.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground font-medium">KM</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {data.activeVehicles} active units / {data.totalVehicles} total registered
              </p>
            </div>

            {/* KPI 4: Critical Outlier Alert ("Money Pits") */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex items-center justify-between text-muted-foreground mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  High Cost Outliers
                </span>
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                  {data.criticalOutliersCount}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Units flagged</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                {data.criticalOutliersCount > 0 ? (
                  <span className="text-amber-600 font-medium">
                    Exceeds 135% of fleet benchmark
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">
                    All units within normal range
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Outlier Watchlist Banner ("Fleet Money Pits") */}
          {data.outlierWatchlist.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      High-Cost Vehicle Watchlist (Top Maintenance Outliers)
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      These vehicles generate disproportionate repair costs relative to their
                      operating mileage. Recommended for mechanical overhaul or fleet renewal
                      review.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-700 dark:text-amber-300"
                >
                  {data.outlierWatchlist.length} Monitored
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {data.outlierWatchlist.map((item) => (
                  <div
                    key={item.vehicleId}
                    className="p-3.5 rounded-lg border border-amber-500/20 bg-background/80 flex flex-col justify-between hover:border-amber-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {item.plateNumber}
                        </span>
                        <Badge
                          variant="destructive"
                          className="text-[10px] uppercase font-bold tracking-wider"
                        >
                          ₱{item.costPerKm.toFixed(2)} / km
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.model}</p>
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Total Spend:</span>
                          <span className="font-semibold text-foreground">
                            ₱{item.totalMaintenanceSpend.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Recorded Odometer:</span>
                          <span className="font-semibold text-foreground">
                            {item.currentKm.toLocaleString()} KM
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Benchmark Gap:</span>
                          <span className="font-bold text-amber-600 flex items-center">
                            <ArrowUpRight className="h-3 w-3 inline mr-0.5" />+
                            {item.benchmarkComparisonPct}% vs avg
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDrilldown(item.vehicleId)}
                      className="mt-3 text-xs justify-between h-8 text-primary hover:bg-primary/10"
                    >
                      <span>Inspect Repair History</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Benchmark & Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card 1: Benchmark by Vehicle Type */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    CPK by Vehicle Category
                  </h3>
                  <span className="text-xs text-muted-foreground">PHP / KM</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Compare operational efficiency and cost intensity across chassis types.
                </p>

                <div className="space-y-3.5">
                  {data.byVehicleType.map((type) => {
                    const maxCpk = Math.max(
                      ...data.byVehicleType.map((t) => t.averageCostPerKm),
                      data.fleetAverageCpk * 1.5,
                      1,
                    );
                    const widthPct = Math.min(
                      100,
                      Math.max(8, (type.averageCostPerKm / maxCpk) * 100),
                    );

                    return (
                      <div key={type.vehicleType} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {VEHICLE_TYPE_LABELS[type.vehicleType] || type.vehicleType}
                          </span>
                          <span className="font-bold text-foreground">
                            ₱{type.averageCostPerKm.toFixed(2)} / km
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              type.averageCostPerKm > data.fleetAverageCpk * 1.25
                                ? 'bg-amber-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{type.vehicleCount} vehicles</span>
                          <span>₱{type.totalSpend.toLocaleString()} spend</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: 6-Month Maintenance Spend Trend */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    Monthly Maintenance Spend Trend
                  </h3>
                  <span className="text-xs text-muted-foreground">Last 6 Months</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Monthly breakdown of approved repair PRs and routine PMS expenditures.
                </p>

                <div className="space-y-3">
                  {data.monthlyTrend.map((m) => {
                    const maxMonthSpend = Math.max(
                      ...data.monthlyTrend.map((item) => item.totalSpend),
                      50000,
                    );
                    const pct = Math.min(100, Math.max(4, (m.totalSpend / maxMonthSpend) * 100));

                    return (
                      <div key={m.monthKey} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-foreground">{m.monthLabel}</span>
                          <span className="font-bold text-foreground">
                            ₱{m.totalSpend.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{m.workOrderCount} work orders</span>
                          <span>
                            {m.pmsSpend > 0 ? `PMS: ₱${m.pmsSpend.toLocaleString()}` : '0 PMS'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 3: Department Cost Allocation */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    Spend by Department
                  </h3>
                  <span className="text-xs text-muted-foreground">Cost Allocation</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Fleet maintenance spend attributed to requesting operational business units.
                </p>

                <div className="space-y-3">
                  {data.byDepartment.map((dept) => {
                    const totalAllSpend = Math.max(data.totalFleetSpend, 1);
                    const sharePct = Math.round((dept.totalSpend / totalAllSpend) * 100);

                    return (
                      <div
                        key={dept.department}
                        className="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1.5"
                      >
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-foreground">{dept.department}</span>
                          <span className="text-foreground">
                            ₱{dept.totalSpend.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{dept.vehicleCount} assigned units</span>
                          <span>{sharePct}% of total budget</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Master Vehicle TCO Table Section */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            {/* Header & Controls */}
            <div className="p-5 border-b border-border/70 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Vehicle Total Cost of Ownership Register
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Individual vehicle lifecycle costs, total distance driven, and
                    cost-per-kilometer ratings.
                  </p>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Showing {filteredMetrics.length} of {data.metrics.length} vehicles
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search plate, model, driver..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                {/* Vehicle Type Filter */}
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Vehicle Types</option>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Rating Filter */}
                <select
                  value={selectedRating}
                  onChange={(e) => {
                    setSelectedRating(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Efficiency Ratings</option>
                  <option value="optimal">Optimal (Within Benchmark)</option>
                  <option value="elevated">Elevated (115% - 135%)</option>
                  <option value="critical_outlier">Critical Outlier (&gt; 135%)</option>
                </select>

                {/* Sort selector */}
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(
                      e.target.value as 'cpk_desc' | 'cpk_asc' | 'spend_desc' | 'km_desc' | 'plate',
                    );
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="cpk_desc">Highest Cost / KM First</option>
                  <option value="cpk_asc">Lowest Cost / KM First</option>
                  <option value="spend_desc">Highest Total Spend First</option>
                  <option value="km_desc">Highest Mileage First</option>
                  <option value="plate">Plate Number (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Empty State */}
            {filteredMetrics.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Wrench className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                <h4 className="text-sm font-semibold text-foreground">No vehicles match filters</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Try clearing search terms or selecting a different vehicle category.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('all');
                    setSelectedRating('all');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Vehicle Unit</th>
                        <th className="py-3 px-4">Type / Department</th>
                        <th className="py-3 px-4 text-right">Current KM</th>
                        <th className="py-3 px-4 text-right">Total Maintenance Spend</th>
                        <th className="py-3 px-4 text-center">Work Orders / PMS</th>
                        <th className="py-3 px-4 text-right">Cost / KM</th>
                        <th className="py-3 px-4 text-center">Efficiency Rating</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedMetrics.map((row) => (
                        <tr key={row.vehicleId} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-foreground">
                              {row.plateNumber}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {row.model}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">
                              {VEHICLE_TYPE_LABELS[row.vehicleType] || row.vehicleType}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {row.department || 'Fleet Operations'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-foreground">
                            {row.currentKm.toLocaleString()} KM
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground">
                            ₱{row.totalMaintenanceSpend.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground">
                            {row.workOrderCount} WOs · {row.pmsCompletedCount} PMS
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-sm text-foreground">
                              ₱{row.costPerKm.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {row.benchmarkComparisonPct > 0 ? (
                                <span className="text-amber-600 font-semibold">
                                  +{row.benchmarkComparisonPct}% vs avg
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">
                                  {row.benchmarkComparisonPct}% vs avg
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {row.costRating === 'optimal' && (
                              <Badge
                                variant="success"
                                className="text-[10px] uppercase font-bold tracking-wider"
                              >
                                Optimal
                              </Badge>
                            )}
                            {row.costRating === 'elevated' && (
                              <Badge
                                variant="warning"
                                className="text-[10px] uppercase font-bold tracking-wider"
                              >
                                Elevated
                              </Badge>
                            )}
                            {row.costRating === 'critical_outlier' && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] uppercase font-bold tracking-wider"
                              >
                                Critical Outlier
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDrilldown(row.vehicleId)}
                              className="h-8 text-xs text-primary hover:bg-primary/10"
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Touch Cards View (screens < 768px) */}
                <div className="md:hidden divide-y divide-border">
                  {paginatedMetrics.map((row) => (
                    <div key={row.vehicleId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-sm text-foreground">
                            {row.plateNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">{row.model}</div>
                        </div>
                        {row.costRating === 'optimal' && (
                          <Badge variant="success" className="text-[10px] uppercase font-bold">
                            Optimal
                          </Badge>
                        )}
                        {row.costRating === 'elevated' && (
                          <Badge variant="warning" className="text-[10px] uppercase font-bold">
                            Elevated
                          </Badge>
                        )}
                        {row.costRating === 'critical_outlier' && (
                          <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                            Outlier
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Cost / KM</span>
                          <span className="font-bold text-foreground text-sm font-mono">
                            ₱{row.costPerKm.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Total Spend
                          </span>
                          <span className="font-bold text-foreground text-sm">
                            ₱{row.totalMaintenanceSpend.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Current KM
                          </span>
                          <span className="font-medium text-foreground">
                            {row.currentKm.toLocaleString()} KM
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Work Orders
                          </span>
                          <span className="font-medium text-foreground">
                            {row.workOrderCount} repairs
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDrilldown(row.vehicleId)}
                        className="w-full text-xs h-8 justify-center gap-1.5"
                      >
                        <span>Inspect Maintenance Timeline</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-border bg-card">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredMetrics.length}
                    itemsPerPage={pageSize}
                    itemsPerPageOptions={[5, 10, 25, 50]}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(newSize: number) => {
                      setPageSize(newSize);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Drilldown Modal: Vehicle Maintenance Timeline & Cost Breakdown */}
      <Dialog
        open={Boolean(drilldownVehicleId)}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldownVehicleId(null);
            setDrilldownDetail(null);
          }
        }}
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span>
              Vehicle Maintenance Lifecycle & TCO:{' '}
              <span className="font-mono text-primary">
                {drilldownDetail?.vehicle.plateNumber || 'Loading...'}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>
            {drilldownDetail?.vehicle.model} ·{' '}
            {VEHICLE_TYPE_LABELS[drilldownDetail?.vehicle.vehicleType || ''] ||
              drilldownDetail?.vehicle.vehicleType}
          </DialogDescription>
        </DialogHeader>

        {drilldownLoading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading vehicle expenditure records...
          </div>
        )}

        {drilldownDetail && (
          <div className="space-y-5 pt-2">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground block">Current KM</span>
                <span className="text-base font-bold text-foreground">
                  {drilldownDetail.costSummary.currentKm.toLocaleString()} KM
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Cost / KM</span>
                <span className="text-base font-bold text-foreground font-mono">
                  ₱{drilldownDetail.costSummary.costPerKm.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Total Spend</span>
                <span className="text-base font-bold text-foreground">
                  ₱{drilldownDetail.costSummary.totalMaintenanceSpend.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Repairs / PMS</span>
                <span className="text-base font-bold text-foreground">
                  {drilldownDetail.costSummary.workOrderCount} /{' '}
                  {drilldownDetail.costSummary.completedPmsCount}
                </span>
              </div>
            </div>

            {/* Work Orders List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Repair Work Orders ({drilldownDetail.workOrders.length})</span>
                <span>Amount (PHP)</span>
              </h4>
              {drilldownDetail.workOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  No repair work orders recorded for this unit.
                </p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card text-xs">
                  {drilldownDetail.workOrders.map((wo) => (
                    <div key={wo.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{wo.workOrderNumber}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {wo.status}
                          </Badge>
                          {wo.prNumber && (
                            <span className="text-[11px] text-muted-foreground">
                              Linked: {wo.prNumber} ({wo.prStatus})
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{wo.description}</p>
                      </div>
                      <span className="font-bold text-foreground text-sm font-mono shrink-0">
                        ₱{wo.cost.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PMS History */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Preventive Maintenance (PMS) History ({drilldownDetail.pmsHistory.length})
              </h4>
              {drilldownDetail.pmsHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  No PMS intervals recorded yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {drilldownDetail.pmsHistory.map((pms) => (
                    <div
                      key={pms.id}
                      className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-foreground">
                          {pms.pmsKm.toLocaleString()} KM
                        </span>
                        <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                          {pms.notes || 'Routine 5,000 KM service'}
                        </span>
                      </div>
                      <Badge
                        variant={pms.status === 'completed' ? 'success' : 'outline'}
                        className="text-[10px] uppercase"
                      >
                        {pms.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
export default AnalyticsPage;
