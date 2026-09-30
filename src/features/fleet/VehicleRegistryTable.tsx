import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gauge, Wrench, AlertTriangle, CheckCircle, Navigation, Plus } from 'lucide-react';

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

  const handleOpenMileage = (v: VehicleItem) => {
    setSelectedVehicleId(v.id);
    setMileageInput(v.currentKm + 50);
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
              Real-time digital inventory, odometer KM tracking, and automated 5,000 KM PMS interval calculator
            </CardDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            5,000 KM Standard Interval
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-lg border border-border">
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
              {vehicles.map((v) => {
                const nextPmsKm = v.lastPmsKm + v.pmsIntervalKm;
                const kmSinceLastPms = v.currentKm - v.lastPmsKm;
                const progressPct = Math.min(100, Math.round((kmSinceLastPms / v.pmsIntervalKm) * 100));

                const isDue = v.status === 'pms_due' || v.currentKm >= nextPmsKm;
                const isApproaching = !isDue && kmSinceLastPms >= v.pmsIntervalKm - 500;

                return (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{v.plateNumber}</div>
                      <div className="text-xs text-muted-foreground">{v.model} • {v.vehicleType}</div>
                    </td>

                    <td className="py-3.5 px-4 text-foreground/80">
                      {v.assignedDriver || <span className="text-muted-foreground italic">Unassigned</span>}
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
                        <Badge variant="destructive" className="flex items-center space-x-1 w-max">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenMileage(v)}
                      >
                        <Navigation className="h-3.5 w-3.5 mr-1" /> Log KM
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSchedulePms(v)}
                      >
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

        {/* Quick Log Mileage Panel */}
        {selectedVehicleId && (
          <div className="mt-5 p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center space-x-3">
              <Navigation className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Update Vehicle Odometer Reading
                </div>
                <div className="text-xs text-muted-foreground">
                  Input returning KM. If mileage &gt;= 5,000 KM threshold, PMS is automatically flagged.
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedVehicleId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
