import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Car,
  Send,
  Navigation,
  X,
  History,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { useOfflineQueue } from '@/lib/offlineQueue';
import type { VehicleItem } from '@/features/fleet/VehicleRegistryTable';

export interface AssignedTrip {
  id: string;
  requestNumber: string;
  department: string;
  projectName: string;
  origin: string;
  destination: string;
  departureDate: string;
  callTime: string;
  assignedVehicleId?: string;
  assignedDriver?: string;
  status: string;
  isFlaggedAfterCutoff?: boolean;
}

export function DriverQuickLogPage() {
  const { currentUser } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const {
    isOnline,
    queue,
    pendingCount,
    isSyncing,
    triggerSync,
    enqueueOdometer,
    enqueueCompleteTrip,
    removeItem,
    clearQueue,
  } = useOfflineQueue();

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [vehicleSearch, setVehicleSearch] = useState<string>('');
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Odometer editing state
  const [odometerInput, setOdometerInput] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState<boolean>(false);
  const [recentLogs, setRecentLogs] = useState<
    Array<{ id: string; plateNumber: string; km: number; time: string; offline: boolean }>
  >([]);

  // Trip completion modal state
  const [tripToComplete, setTripToComplete] = useState<AssignedTrip | null>(null);
  const [tripEndingKm, setTripEndingKm] = useState<number>(0);

  // Load vehicles & assigned trips
  const loadDriverData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, tRes] = await Promise.all([
        apiFetch('/api/vehicles').catch(() => null),
        apiFetch('/api/tsrf').catch(() => null),
      ]);

      if (vRes && vRes.ok) {
        const vData: VehicleItem[] = await vRes.json();
        setVehicles(vData);

        // Auto-select vehicle assigned to this driver or first active vehicle
        if (vData.length > 0) {
          const myVehicle = vData.find(
            (v) =>
              currentUser?.name &&
              v.assignedDriver &&
              v.assignedDriver.toLowerCase().includes(currentUser.name.toLowerCase()),
          );
          const initial = myVehicle ?? vData[0];
          setSelectedVehicleId(initial.id);
          setOdometerInput(initial.currentKm);
        }
      }

      if (tRes && tRes.ok) {
        const tData: AssignedTrip[] = await tRes.json();
        // Filter to trips that are active / dispatched / in progress
        const active = tData.filter((t) =>
          ['dispatched', 'in_progress', 'approved', 'dept_approved'].includes(t.status),
        );
        setTrips(active);
      }
    } catch {
      // In offline conditions, data can remain empty or use cached state
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadDriverData();
  }, [loadDriverData]);

  // Selected vehicle object
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );

  // When selected vehicle changes, sync the odometer input
  const handleSelectVehicle = (vehicle: VehicleItem) => {
    setSelectedVehicleId(vehicle.id);
    setOdometerInput(vehicle.currentKm);
  };

  // Filter vehicles by search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return vehicles;
    const term = vehicleSearch.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.plateNumber.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term) ||
        (v.assignedDriver && v.assignedDriver.toLowerCase().includes(term)),
    );
  }, [vehicles, vehicleSearch]);

  // Filter trips for selected vehicle
  const relevantTrips = useMemo(() => {
    if (!selectedVehicle) return trips;
    return trips.filter(
      (t) =>
        t.assignedVehicleId === selectedVehicle.id ||
        (selectedVehicle.assignedDriver &&
          t.assignedDriver &&
          t.assignedDriver.toLowerCase() === selectedVehicle.assignedDriver.toLowerCase()),
    );
  }, [trips, selectedVehicle]);

  // Differential and PMS metrics
  const kmDelta = selectedVehicle ? odometerInput - selectedVehicle.currentKm : 0;
  const kmSinceLastPms = selectedVehicle ? odometerInput - (selectedVehicle.lastPmsKm || 0) : 0;
  const pmsThreshold = selectedVehicle?.pmsIntervalKm || 5000;
  const pmsProgressPct = Math.min(100, Math.max(0, (kmSinceLastPms / pmsThreshold) * 100));
  const isPmsDue = kmSinceLastPms >= pmsThreshold;

  // Keypad & increment helpers
  const handleAddKm = (delta: number) => {
    setOdometerInput((prev) => Math.max(0, prev + delta));
  };

  const handleKeypadDigit = (digit: string) => {
    const currentStr = String(odometerInput);
    if (currentStr === '0') {
      setOdometerInput(Number(digit));
    } else {
      const nextStr = `${currentStr}${digit}`;
      if (nextStr.length <= 7) {
        setOdometerInput(Number(nextStr));
      }
    }
  };

  const handleKeypadBackspace = () => {
    const currentStr = String(odometerInput);
    if (currentStr.length <= 1) {
      setOdometerInput(0);
    } else {
      setOdometerInput(Number(currentStr.slice(0, -1)));
    }
  };

  const handleKeypadClear = () => {
    if (selectedVehicle) {
      setOdometerInput(selectedVehicle.currentKm);
    } else {
      setOdometerInput(0);
    }
  };

  // Save / Log Mileage Handler (with automatic offline fallback)
  const handleSubmitMileage = async () => {
    if (!selectedVehicle) {
      toastError('Please select a vehicle first.');
      return;
    }

    if (odometerInput <= 0) {
      toastError('Please enter a valid odometer reading greater than 0.');
      return;
    }

    if (odometerInput < selectedVehicle.currentKm) {
      const confirmed = window.confirm(
        `Warning: Entered reading (${odometerInput.toLocaleString()} KM) is lower than current record (${selectedVehicle.currentKm.toLocaleString()} KM).\nAre you sure you want to log an odometer rollback/correction?`,
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    const logEntry = {
      id: `log_${Date.now()}`,
      plateNumber: selectedVehicle.plateNumber,
      km: odometerInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      offline: !isOnline,
    };

    if (isOnline) {
      try {
        const res = await apiFetch(
          `/api/vehicles/${encodeURIComponent(selectedVehicle.id)}/mileage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endingKm: odometerInput }),
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server error saving mileage');
        }

        const updated: VehicleItem = await res.json();
        // Update local vehicles list
        setVehicles((prev) =>
          prev.map((v) => (v.id === selectedVehicle.id ? { ...v, ...updated } : v)),
        );

        setRecentLogs((prev) => [logEntry, ...prev.slice(0, 4)]);
        toastSuccess(`Odometer updated to ${odometerInput.toLocaleString()} KM (Live Synced).`);
      } catch (err: unknown) {
        // Enqueue offline if server returned network failure
        enqueueOdometer(selectedVehicle.id, odometerInput, selectedVehicle.plateNumber);
        logEntry.offline = true;
        setRecentLogs((prev) => [logEntry, ...prev.slice(0, 4)]);
        // Optimistically update vehicle in memory
        setVehicles((prev) =>
          prev.map((v) => (v.id === selectedVehicle.id ? { ...v, currentKm: odometerInput } : v)),
        );
        toastWarning(
          `Network issue: Reading queued locally (${odometerInput.toLocaleString()} KM). Will auto-sync when online.`,
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Offline mode: queue locally directly
      enqueueOdometer(selectedVehicle.id, odometerInput, selectedVehicle.plateNumber);
      setRecentLogs((prev) => [logEntry, ...prev.slice(0, 4)]);
      // Optimistically update vehicle in memory
      setVehicles((prev) =>
        prev.map((v) => (v.id === selectedVehicle.id ? { ...v, currentKm: odometerInput } : v)),
      );
      setIsSubmitting(false);
      toastSuccess(
        `Odometer queued locally (${odometerInput.toLocaleString()} KM). Auto-sync pending.`,
      );
    }
  };

  // Complete Trip Handler
  const handleConfirmCompleteTrip = async () => {
    if (!tripToComplete) return;

    if (tripEndingKm <= 0) {
      toastError('Please enter a valid ending odometer reading.');
      return;
    }

    setIsSubmitting(true);

    if (isOnline) {
      try {
        const res = await apiFetch(
          `/api/tsrf/${encodeURIComponent(tripToComplete.id)}/complete-trip`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endingKm: tripEndingKm,
              assignedVehicleId: selectedVehicle?.id,
            }),
          },
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to complete trip');
        }

        // Update local trips
        setTrips((prev) => prev.filter((t) => t.id !== tripToComplete.id));
        if (selectedVehicle) {
          setVehicles((prev) =>
            prev.map((v) => (v.id === selectedVehicle.id ? { ...v, currentKm: tripEndingKm } : v)),
          );
        }
        toastSuccess(`Trip ${tripToComplete.requestNumber} completed and ending KM logged.`);
      } catch (err: unknown) {
        // Enqueue offline
        enqueueCompleteTrip(
          tripToComplete.id,
          tripEndingKm,
          selectedVehicle?.id,
          tripToComplete.requestNumber,
        );
        setTrips((prev) => prev.filter((t) => t.id !== tripToComplete.id));
        toastWarning(
          `Offline: Trip completion for ${tripToComplete.requestNumber} saved to queue.`,
        );
      } finally {
        setIsSubmitting(false);
        setTripToComplete(null);
      }
    } else {
      // Offline queue
      enqueueCompleteTrip(
        tripToComplete.id,
        tripEndingKm,
        selectedVehicle?.id,
        tripToComplete.requestNumber,
      );
      setTrips((prev) => prev.filter((t) => t.id !== tripToComplete.id));
      setIsSubmitting(false);
      setTripToComplete(null);
      toastSuccess(`Trip completion for ${tripToComplete.requestNumber} queued offline.`);
    }
  };

  // Manual trigger sync with feedback
  const handleManualSync = async () => {
    const res = await triggerSync();
    if (res) {
      if (res.synced > 0) {
        toastSuccess(`Successfully synced ${res.synced} offline action(s)!`);
        void loadDriverData();
      } else if (res.failed > 0) {
        toastError(`Sync completed with ${res.failed} error(s). Check connection.`);
      } else {
        toastSuccess('Queue is already up to date.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in px-2 sm:px-4">
      {/* ─── Top Bar: Driver Identity & Connectivity Status ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card/80 backdrop-blur-md border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Driver Quick-Log</h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                In-Cab PWA
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{currentUser?.name || 'Driver Console'}</span>
              <span>•</span>
              <span>{currentUser?.department || 'Fleet Operations'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <Wifi className="h-3.5 w-3.5" />
                <span>Online</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline Mode</span>
              </>
            )}
          </div>

          {/* Pending Sync Queue Button */}
          <Button
            type="button"
            variant={pendingCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowQueueDrawer(true)}
            className="relative h-9 text-xs gap-1.5 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Queue</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-500 text-black px-1.5 py-0.2 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Offline Banner Alert ─── */}
      {!isOnline && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200 text-xs flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">Offline Field Queue Active</p>
            <p className="text-amber-200/80 mt-0.5">
              Cellular connectivity is currently unavailable. All odometer readings and trip
              completions are securely saved to local storage on this device and will automatically
              sync once a signal is restored.
            </p>
          </div>
          {pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="shrink-0 text-xs h-7 border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
            >
              {isSyncing ? 'Syncing...' : 'Try Sync'}
            </Button>
          )}
        </div>
      )}

      {/* ─── Main Grid: Vehicle Selector & Odometer Pad ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Assigned Vehicle Details & Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 bg-muted/20 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span>Assigned Vehicle</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select vehicle to log in-cab readings
                  </CardDescription>
                </div>
                {selectedVehicle && (
                  <Badge
                    variant={
                      selectedVehicle.status === 'active'
                        ? 'default'
                        : selectedVehicle.status === 'pms_due'
                          ? 'destructive'
                          : 'outline'
                    }
                    className="capitalize text-[10px]"
                  >
                    {selectedVehicle.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              {/* Vehicle Quick Switch Dropdown / Filter */}
              <div>
                <Input
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Search plate or vehicle model..."
                  className="h-8 text-xs bg-muted/30"
                />
              </div>

              {/* Vehicle Select Cards List */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Loading vehicle fleet...</span>
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No vehicles found matching search.
                  </div>
                ) : (
                  filteredVehicles.map((v) => {
                    const isSelected = v.id === selectedVehicleId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVehicle(v)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                            : 'border-border bg-card/60 hover:bg-muted/40 hover:border-border'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs tracking-wider text-foreground">
                              {v.plateNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {v.model}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Driver: {v.assignedDriver || 'Unassigned'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-foreground">
                            {v.currentKm.toLocaleString()} KM
                          </span>
                          {v.computedPmsStatus === 'pms_due' && (
                            <p className="text-[10px] text-destructive font-medium">PMS Due</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Active Selected Vehicle Snapshot & PMS Progress */}
              {selectedVehicle && (
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="rounded-xl bg-muted/40 p-3 border border-border/60 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">5,000 KM PMS Cycle:</span>
                      <span
                        className={`font-semibold ${
                          isPmsDue ? 'text-destructive' : 'text-foreground'
                        }`}
                      >
                        {kmSinceLastPms.toLocaleString()} / {pmsThreshold.toLocaleString()} KM
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isPmsDue
                            ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                            : pmsProgressPct > 80
                              ? 'bg-amber-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${pmsProgressPct}%` }}
                      />
                    </div>

                    {isPmsDue ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Threshold exceeded. Vehicle requires preventive service.</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        {(pmsThreshold - kmSinceLastPms).toLocaleString()} KM remaining until next
                        maintenance cycle.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Mileage Logs Widget */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Recent In-Cab Logs</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0 space-y-2">
              {recentLogs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center">
                  No readings logged this session.
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{log.plateNumber}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{log.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{log.km.toLocaleString()} KM</span>
                      {log.offline ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          Queued
                        </span>
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Digital Odometer Keypad & Trip Actions (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* ─── Digital Odometer Input Display ─── */}
          <Card className="border-border shadow-md bg-gradient-to-br from-card via-card to-card/70 overflow-hidden">
            <CardContent className="p-5 space-y-5">
              <div className="text-center space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Odometer Reading
                </span>
                {/* Huge High-Contrast Display */}
                <div className="flex items-baseline justify-center gap-2 py-2">
                  <span className="font-mono text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
                    {odometerInput.toLocaleString()}
                  </span>
                  <span className="text-lg font-bold text-primary">KM</span>
                </div>

                {/* Differential badge */}
                {selectedVehicle && (
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Base: {selectedVehicle.currentKm.toLocaleString()} KM
                    </span>
                    <span>•</span>
                    <span
                      className={`font-semibold ${
                        kmDelta > 0
                          ? 'text-emerald-400'
                          : kmDelta < 0
                            ? 'text-amber-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {kmDelta >= 0
                        ? `+${kmDelta.toLocaleString()} KM`
                        : `${kmDelta.toLocaleString()} KM`}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Stepper Increment Pills */}
              <div className="grid grid-cols-5 gap-2">
                {[5, 10, 25, 50, 100].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleAddKm(inc)}
                    className="py-2 rounded-xl border border-border bg-muted/40 hover:bg-primary/20 hover:border-primary/50 text-xs font-bold transition-all text-foreground active:scale-95 shadow-2xs"
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              {/* Large Touch Keypad (1-9, C, 0, Backspace) */}
              <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadDigit(digit)}
                    className="h-14 rounded-2xl bg-card border border-border/80 text-xl font-bold hover:bg-muted/60 active:bg-primary/20 active:border-primary/50 text-foreground transition-all flex items-center justify-center shadow-xs select-none"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-14 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm font-bold text-destructive hover:bg-destructive/20 active:scale-95 transition-all flex items-center justify-center select-none"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadDigit('0')}
                  className="h-14 rounded-2xl bg-card border border-border/80 text-xl font-bold hover:bg-muted/60 active:bg-primary/20 active:border-primary/50 text-foreground transition-all flex items-center justify-center shadow-xs select-none"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-14 rounded-2xl bg-muted/60 border border-border text-sm font-bold text-foreground hover:bg-muted active:scale-95 transition-all flex items-center justify-center select-none"
                  title="Backspace"
                >
                  ⌫
                </button>
              </div>

              {/* Submit CTA Button */}
              <Button
                type="button"
                onClick={handleSubmitMileage}
                disabled={isSubmitting || !selectedVehicle}
                className="w-full h-14 rounded-2xl text-base font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99] transition-all"
              >
                <Send className="h-5 w-5" />
                <span>
                  {isSubmitting
                    ? 'Saving Reading...'
                    : `Log Odometer Reading (${odometerInput.toLocaleString()} KM)`}
                </span>
              </Button>
            </CardContent>
          </Card>

          {/* ─── Assigned Trips / TSRF Dispatch Section ─── */}
          <Card className="border-border shadow-sm">
            <CardHeader className="p-4 pb-3 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-primary" />
                    <span>Active Dispatched Trips</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assigned travel service requests ready for completion
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {relevantTrips.length} Active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {relevantTrips.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                  <p>No active TSRF trips dispatched for this vehicle.</p>
                  <p className="text-[11px]">
                    Approved service requests will appear here for return trip logging.
                  </p>
                </div>
              ) : (
                relevantTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-primary">{trip.requestNumber}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {trip.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span>{trip.origin}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{trip.destination}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div>
                        <span>Dept: </span>
                        <span className="text-foreground">{trip.department}</span>
                      </div>
                      <div>
                        <span>Call Time: </span>
                        <span className="text-foreground">{trip.callTime || 'TBD'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Date:{' '}
                        {trip.departureDate
                          ? new Date(trip.departureDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 text-xs font-medium"
                        onClick={() => {
                          setTripToComplete(trip);
                          setTripEndingKm(odometerInput);
                        }}
                      >
                        Complete Trip & Log KM
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Complete Trip Dialog ─── */}
      {tripToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Complete Trip</h3>
                <p className="text-xs text-muted-foreground">{tripToComplete.requestNumber}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTripToComplete(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="font-semibold text-foreground">
                  {tripToComplete.origin} ➔ {tripToComplete.destination}
                </p>
                <p className="text-muted-foreground">
                  Department: {tripToComplete.department} • Project: {tripToComplete.projectName}
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ending Odometer (KM)</label>
                <Input
                  type="number"
                  value={tripEndingKm}
                  onChange={(e) => setTripEndingKm(Number(e.target.value))}
                  className="h-10 text-base font-bold"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enter final vehicle odometer reading upon returning from trip.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTripToComplete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmCompleteTrip}
                disabled={isSubmitting || tripEndingKm <= 0}
              >
                Confirm Completion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Offline Queue Modal / Drawer ─── */}
      {showQueueDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                <h3 className="font-bold text-base text-foreground">Offline Sync Queue</h3>
                <Badge variant="secondary" className="text-xs">
                  {queue.length} items
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowQueueDrawer(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 py-1">
              {queue.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-medium text-foreground">Queue is completely synchronized</p>
                  <p>All in-cab readings and completed trips have been uploaded to the server.</p>
                </div>
              ) : (
                queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {item.type === 'UPDATE_ODOMETER'
                            ? `Odometer: ${item.plateNumber || item.vehicleId}`
                            : `Trip: ${item.requestNumber || item.tsrfId}`}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.endingKm.toLocaleString()} KM
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Recorded at {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                      {item.error && (
                        <p className="text-[10px] text-destructive mt-0.5">{item.error}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                      title="Remove from queue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearQueue}
                disabled={queue.length === 0}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                Clear Queue
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQueueDrawer(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing || queue.length === 0}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
