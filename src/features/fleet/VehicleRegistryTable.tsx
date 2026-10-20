import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Gauge,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Plus,
  Car,
  Search,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';

export interface VehicleItem {
  id: string;
  plateNumber: string;
  model: string;
  vehicleType: string;
  assignedDriver?: string | null;
  currentKm: number;
  lastPmsKm: number;
  pmsIntervalKm: number;
  status: 'active' | 'pms_due' | 'in_maintenance' | 'decommissioned';
  computedPmsStatus?: 'active' | 'pms_approaching' | 'pms_due';
}

interface VehicleRegistryTableProps {
  vehicles: VehicleItem[];
  onLogMileage: (vehicleId: string, newKm: number) => void;
  onRequestRepair: (vehicle: VehicleItem) => void;
  onSchedulePms: (vehicle: VehicleItem) => void;
}

export function VehicleRegistryTable({
  vehicles,
  onLogMileage,
  onRequestRepair,
  onSchedulePms,
}: VehicleRegistryTableProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mileageInput, setMileageInput] = useState<number>(0);

  // ─── Filtering, Sorting & Pagination State ──────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'plate_asc' | 'plate_desc' | 'km_desc' | 'km_asc' | 'pms_urgency'
  >('plate_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract distinct vehicle types for filter
  const vehicleTypes = useMemo(() => {
    const types = new Set<string>();
    vehicles.forEach((v) => {
      if (v.vehicleType) types.add(v.vehicleType);
    });
    return Array.from(types).sort();
  }, [vehicles]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    sortBy !== 'plate_asc';

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSortBy('plate_asc');
    setCurrentPage(1);
  };

  // Reset to page 1 whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, sortBy]);

  // Filtered & Sorted Vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter((v) => {
        // Search filter: plate, model, driver
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchPlate = v.plateNumber?.toLowerCase().includes(q);
          const matchModel = v.model?.toLowerCase().includes(q);
          const matchDriver = v.assignedDriver?.toLowerCase().includes(q);
          if (!matchPlate && !matchModel && !matchDriver) return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const nextPmsKm = v.lastPmsKm + v.pmsIntervalKm;
          const kmSinceLastPms = v.currentKm - v.lastPmsKm;
          const isDue = v.status === 'pms_due' || v.currentKm >= nextPmsKm;
          const isApproaching = !isDue && kmSinceLastPms >= v.pmsIntervalKm - 500;

          if (statusFilter === 'pms_due' && !isDue) return false;
          if (statusFilter === 'pms_approaching' && !isApproaching) return false;
          if (statusFilter === 'active' && (isDue || v.status !== 'active')) return false;
          if (statusFilter === 'in_maintenance' && v.status !== 'in_maintenance') return false;
          if (statusFilter === 'decommissioned' && v.status !== 'decommissioned') return false;
        }

        // Vehicle type filter
        if (typeFilter !== 'all' && v.vehicleType !== typeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'plate_asc') return a.plateNumber.localeCompare(b.plateNumber);
        if (sortBy === 'plate_desc') return b.plateNumber.localeCompare(a.plateNumber);
        if (sortBy === 'km_desc') return b.currentKm - a.currentKm;
        if (sortBy === 'km_asc') return a.currentKm - b.currentKm;
        if (sortBy === 'pms_urgency') {
          const pctA = (a.currentKm - a.lastPmsKm) / a.pmsIntervalKm;
          const pctB = (b.currentKm - b.lastPmsKm) / b.pmsIntervalKm;
          return pctB - pctA;
        }
        return 0;
      });
  }, [vehicles, searchQuery, statusFilter, typeFilter, sortBy]);

  // Paginated Slice
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVehicles.slice(startIndex, startIndex + pageSize);
  }, [filteredVehicles, currentPage, pageSize]);

  const handleOpenMileage = (v: VehicleItem) => {
    if (selectedVehicleId === v.id) {
      setSelectedVehicleId(null);
    } else {
      setSelectedVehicleId(v.id);
      setMileageInput(v.currentKm + 50);
    }
  };

  const handleSaveMileage = () => {
    if (selectedVehicleId && mileageInput) {
      onLogMileage(selectedVehicleId, mileageInput);
      setSelectedVehicleId(null);
    }
  };

  return (
    <Card className="max-w-5xl mx-auto shadow-md">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Gauge className="h-5 w-5 text-primary" />
              <CardTitle>Central Vehicle Registry & Kilometer Monitoring</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Real-time digital inventory, odometer KM tracking, and automated 5,000 KM PMS interval
              calculator
            </CardDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs w-max">
            5,000 KM Standard Interval
          </Badge>
        </div>
      </CardHeader>

      {/* ─── Search, Filter & Sort Toolbar ─────────────────────────────────── */}
      <div className="p-4 bg-muted/20 border-b border-border/40 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plate, model, or driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Filters & Sorting Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by vehicle status"
              className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Units</option>
              <option value="pms_due">PMS Overdue</option>
              <option value="pms_approaching">Approaching PMS</option>
              <option value="in_maintenance">In Maintenance</option>
            </select>

            {/* Vehicle Type Select */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by vehicle type"
              className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
            >
              <option value="all">All Vehicle Types</option>
              {vehicleTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    'plate_asc' | 'plate_desc' | 'km_desc' | 'km_asc' | 'pms_urgency',
                )
              }
              aria-label="Sort vehicles"
              className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
            >
              <option value="plate_asc">Sort: Plate (A → Z)</option>
              <option value="plate_desc">Sort: Plate (Z → A)</option>
              <option value="km_desc">Sort: Highest Odometer</option>
              <option value="km_asc">Sort: Lowest Odometer</option>
              <option value="pms_urgency">Sort: PMS Urgency</option>
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground px-2.5"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Status / Count Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Showing <strong className="text-foreground">{filteredVehicles.length}</strong> of{' '}
            <strong className="text-foreground">{vehicles.length}</strong> registered units
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                Filtered
              </span>
            )}
          </span>
          {vehicles.filter((v) => v.computedPmsStatus === 'pms_due').length > 0 && (
            <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {vehicles.filter((v) => v.computedPmsStatus === 'pms_due').length} units need PMS
            </span>
          )}
        </div>
      </div>

      <CardContent className="pt-6">
        {vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
            <div className="rounded-2xl bg-primary/10 p-4 mb-3 text-primary">
              <Car className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Vehicles in Registry</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No vehicle units have been added or synchronized yet. All registered fleet assets will
              appear here.
            </p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
            <div className="rounded-2xl bg-muted/30 p-4 mb-3 text-muted-foreground">
              <Filter className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Matching Vehicles</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No fleet vehicles matched your search query or active filter settings.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-4 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Vehicle / Unit</th>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Current KM</th>
                    <th className="py-3 px-4">PMS Interval Usage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedVehicles.map((v) => {
                    const nextPmsKm = v.lastPmsKm + v.pmsIntervalKm;
                    const kmSinceLastPms = v.currentKm - v.lastPmsKm;
                    const progressPct = Math.min(
                      100,
                      Math.round((kmSinceLastPms / v.pmsIntervalKm) * 100),
                    );

                    const isDue = v.status === 'pms_due' || v.currentKm >= nextPmsKm;
                    const isApproaching = !isDue && kmSinceLastPms >= v.pmsIntervalKm - 500;

                    return (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-foreground">{v.plateNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {v.model} • {v.vehicleType}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-foreground/80">
                          {v.assignedDriver || (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium">
                          {v.currentKm.toLocaleString()} KM
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="w-48 space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground font-mono">
                              <span>{kmSinceLastPms.toLocaleString()} / 5,000 KM</span>
                              <span>Due: {nextPmsKm.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isDue
                                    ? 'bg-destructive'
                                    : isApproaching
                                      ? 'bg-amber-500'
                                      : 'bg-primary'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {v.status === 'in_maintenance' ? (
                            <Badge variant="secondary">In Maintenance</Badge>
                          ) : isDue ? (
                            <Badge
                              variant="destructive"
                              className="flex items-center space-x-1 w-max"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" /> Overdue
                            </Badge>
                          ) : isApproaching ? (
                            <Badge variant="warning">Approaching</Badge>
                          ) : (
                            <Badge variant="success" className="flex items-center space-x-1 w-max">
                              <CheckCircle className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => handleOpenMileage(v)}>
                            <Navigation className="h-3.5 w-3.5 mr-1" /> Log KM
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => onSchedulePms(v)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> PMS
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onRequestRepair(v)}
                          >
                            <Wrench className="h-3.5 w-3.5 mr-1" /> Repair
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (Visible only on small screens) */}
            <div className="md:hidden space-y-3.5">
              {paginatedVehicles.map((v) => {
                const nextPmsKm = v.lastPmsKm + v.pmsIntervalKm;
                const kmSinceLastPms = v.currentKm - v.lastPmsKm;
                const progressPct = Math.min(
                  100,
                  Math.round((kmSinceLastPms / v.pmsIntervalKm) * 100),
                );

                const isDue = v.status === 'pms_due' || v.currentKm >= nextPmsKm;
                const isApproaching = !isDue && kmSinceLastPms >= v.pmsIntervalKm - 500;

                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl border border-border bg-card/60 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-base text-foreground tracking-tight">
                          {v.plateNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.model} • {v.vehicleType}
                        </div>
                      </div>
                      <div>
                        {v.status === 'in_maintenance' ? (
                          <Badge variant="secondary">In Maintenance</Badge>
                        ) : isDue ? (
                          <Badge variant="destructive" className="flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Overdue
                          </Badge>
                        ) : isApproaching ? (
                          <Badge variant="warning">Approaching</Badge>
                        ) : (
                          <Badge variant="success" className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-border/50">
                      <div>
                        <span className="text-muted-foreground block">Driver:</span>
                        <span className="font-medium text-foreground">
                          {v.assignedDriver || (
                            <span className="italic text-muted-foreground">Unassigned</span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Odometer:</span>
                        <span className="font-mono font-medium text-foreground">
                          {v.currentKm.toLocaleString()} KM
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>PMS Interval ({kmSinceLastPms.toLocaleString()} / 5,000 KM)</span>
                        <span>Due: {nextPmsKm.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isDue ? 'bg-destructive' : isApproaching ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleOpenMileage(v)}
                      >
                        <Navigation className="h-3 w-3 mr-1" /> KM
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => onSchedulePms(v)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> PMS
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => onRequestRepair(v)}
                      >
                        <Wrench className="h-3 w-3 mr-1" /> Repair
                      </Button>
                    </div>

                    {/* Mobile Inline Quick Log Mileage Panel */}
                    {selectedVehicleId === v.id && (
                      <div className="mt-3 p-3 rounded-lg border border-primary/40 bg-primary/10 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-semibold text-primary">
                          <span>Log Odometer ({v.plateNumber})</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Current: {v.currentKm.toLocaleString()} KM
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={mileageInput}
                            onChange={(e) => setMileageInput(parseInt(e.target.value, 10) || 0)}
                            className="h-8 bg-background font-mono text-xs flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            onClick={handleSaveMileage}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            onClick={() => setSelectedVehicleId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {filteredVehicles.length > 0 && (
              <div className="pt-4 border-t border-border/40 mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredVehicles.length}
                  itemsPerPage={pageSize}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  itemsPerPageOptions={[5, 10, 25, 50]}
                />
              </div>
            )}
          </>
        )}

        {/* Desktop Quick Log Mileage Panel */}
        {selectedVehicleId && (
          <div className="hidden md:flex mt-5 p-4 rounded-xl border border-primary/30 bg-primary/5 flex-col md:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center space-x-3">
              <Navigation className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Update Vehicle Odometer Reading
                </div>
                <div className="text-xs text-muted-foreground">
                  Input returning KM. If mileage &gt;= 5,000 KM threshold, PMS is automatically
                  flagged.
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={mileageInput}
                onChange={(e) => setMileageInput(parseInt(e.target.value, 10) || 0)}
                className="w-32 bg-background font-mono"
              />
              <Button size="sm" onClick={handleSaveMileage}>
                Save Reading
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedVehicleId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
