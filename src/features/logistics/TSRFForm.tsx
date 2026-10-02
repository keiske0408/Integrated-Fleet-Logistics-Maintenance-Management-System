import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock,
  MapPin,
  Users,
  Package,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Send,
} from 'lucide-react';

export interface RouteStop {
  stopOrder: number;
  locationName: string;
  address: string;
  waitingTimeMinutes: number;
  notes?: string;
}

export interface Passenger {
  name: string;
  department: string;
  role?: string;
}

export interface CargoItem {
  description: string;
  quantity: number;
  weightKg?: number;
  isFragile: boolean;
}

export interface TSRFFormData {
  projectName: string;
  department: string;
  origin: string;
  destination: string;
  departureDate: string;
  callTime: string;
  vehicleType: string;
  allocationType?: 'fleet_asset' | 'third_party_trucker';
  assignedVehicleId?: string;
  truckerName?: string;
  stops: RouteStop[];
  passengers: Passenger[];
  cargo: CargoItem[];
}

interface TSRFFormProps {
  onSubmit: (data: TSRFFormData) => void;
  isSubmitting?: boolean;
}

export function TSRFForm({ onSubmit, isSubmitting = false }: TSRFFormProps) {
  // 4:00 PM cutoff real-time detection
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const checkCutoff = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const hours = now.getHours();
      const minutes = now.getMinutes();
      setIsPastCutoff(hours > 16 || (hours === 16 && minutes > 0));
    };

    checkCutoff();
    const interval = setInterval(checkCutoff, 10000);
    return () => clearInterval(interval);
  }, []);

  // Form states
  const [projectName, setProjectName] = useState('Asset Retrieval and KE Biometric Project');
  const [department, setDepartment] = useState('IT Support');
  const [origin, setOrigin] = useState('MMG Warehouse');
  const [destination, setDestination] = useState('Kingston Excell');
  const [departureDate, setDepartureDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0],
  );
  const [callTime, setCallTime] = useState('08:00 AM');
  const [vehicleType, setVehicleType] = useState('commuter_van');

  // Multi-stop waypoints
  const [stops, setStops] = useState<RouteStop[]>([
    {
      stopOrder: 1,
      locationName: 'MMG Warehouse',
      address: 'Building 4, MMG Logistics Complex',
      waitingTimeMinutes: 15,
      notes: 'Initial cargo loading',
    },
    {
      stopOrder: 2,
      locationName: 'Kingston Excell Facility',
      address: 'Lot 12 Kingston Industrial Park',
      waitingTimeMinutes: 45,
      notes: 'Unloading biometric terminals',
    },
  ]);

  const [newStopLocation, setNewStopLocation] = useState('');
  const [newStopAddress, setNewStopAddress] = useState('');

  // Passenger Manifest
  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: 'Juan Dela Cruz', department: 'IT Support', role: 'Lead Technician' },
    { name: 'Maria Santos', department: 'Asset Management', role: 'Auditor' },
  ]);
  const [newPassName, setNewPassName] = useState('');
  const [newPassDept, setNewPassDept] = useState('');

  // Cargo Control
  const [cargo, setCargo] = useState<CargoItem[]>([
    {
      description: 'KE Biometric Scanners (Pack of 10)',
      quantity: 2,
      weightKg: 15,
      isFragile: true,
    },
  ]);
  const [newCargoDesc, setNewCargoDesc] = useState('');
  const [newCargoQty, setNewCargoQty] = useState(1);
  const [newCargoFragile, setNewCargoFragile] = useState(false);

  // Add stop
  const handleAddStop = () => {
    if (!newStopLocation || !newStopAddress) return;
    setStops([
      ...stops,
      {
        stopOrder: stops.length + 1,
        locationName: newStopLocation,
        address: newStopAddress,
        waitingTimeMinutes: 15,
      },
    ]);
    setNewStopLocation('');
    setNewStopAddress('');
  };

  // Add passenger
  const handleAddPassenger = () => {
    if (!newPassName) return;
    setPassengers([
      ...passengers,
      { name: newPassName, department: newPassDept || department, role: 'Passenger' },
    ]);
    setNewPassName('');
    setNewPassDept('');
  };

  // Add cargo
  const handleAddCargo = () => {
    if (!newCargoDesc) return;
    setCargo([
      ...cargo,
      { description: newCargoDesc, quantity: newCargoQty, isFragile: newCargoFragile },
    ]);
    setNewCargoDesc('');
    setNewCargoQty(1);
    setNewCargoFragile(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      projectName,
      department,
      origin,
      destination,
      departureDate,
      callTime,
      vehicleType,
      stops,
      passengers,
      cargo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* 4:00 PM Cutoff Alert Banner */}
      {isPastCutoff ? (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex items-start space-x-3 shadow-sm animate-fade-in">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-sm">
              Daily Cut-off Notice (Current Time: {currentTimeStr})
            </div>
            <p className="mt-1 text-destructive/90">
              Submissions after <strong>4:00 PM (16:00)</strong> are automatically flagged with{' '}
              <code className="bg-destructive/20 px-1 py-0.5 rounded font-mono">
                is_flagged_after_cutoff = true
              </code>{' '}
              and require supervisory exception review before dispatch scheduling.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Regular TSRF Intake Active (Daily Cut-off is 4:00 PM)</span>
          </div>
          <Badge variant="success">Normal Intake</Badge>
        </div>
      )}

      {/* Basic Trip Details */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>1. Transportation Service Request (TSRF) Intake</CardTitle>
          </div>
          <CardDescription>
            Specify the project, schedule, and vehicle allocation requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Project Name
              </label>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Requesting Department
              </label>
              <Input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Departure Date
              </label>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Expected Call Time
              </label>
              <Input
                type="text"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                required
                placeholder="e.g. 08:00 AM"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Vehicle Type / Allocation
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="commuter_van">Commuter Van (12–15 Seater)</option>
                <option value="truck_4w">4-Wheeler Closed Van Truck</option>
                <option value="truck_6w">6-Wheeler Forward Truck</option>
                <option value="truck_10w">10-Wheeler Heavy Cargo Truck</option>
                <option value="container_unit">Container Chassis Unit</option>
                <option value="3pl_lalamove">3PL: Lalamove Delivery Partner</option>
                <option value="3pl_transportify">3PL: Transportify On-Demand</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Stop Itinerary & Google Maps Mock Visualizer */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>2. Multi-Stop Route & Location Management</CardTitle>
                <CardDescription>
                  Track origins, destinations, and intermediate facilities
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Interactive Route Preview
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Primary Origin
              </label>
              <Input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Primary Destination
              </label>
              <Input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Waypoints List */}
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Waypoints & Stops Itinerary ({stops.length} stops)
            </div>
            {stops.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border text-sm shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {s.stopOrder}
                  </span>
                  <div>
                    <div className="font-medium text-foreground">{s.locationName}</div>
                    <div className="text-xs text-muted-foreground">{s.address}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <span>Wait: {s.waitingTimeMinutes} mins</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStops(stops.filter((_, i) => i !== idx))}
                    className="text-destructive hover:text-destructive h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add Waypoint Form */}
            <div className="pt-2 flex flex-col md:flex-row gap-2">
              <Input
                placeholder="Stop Name (e.g. Kingston Excell)"
                value={newStopLocation}
                onChange={(e) => setNewStopLocation(e.target.value)}
                className="flex-1 bg-card"
              />
              <Input
                placeholder="Street / Warehouse Address"
                value={newStopAddress}
                onChange={(e) => setNewStopAddress(e.target.value)}
                className="flex-1 bg-card"
              />
              <Button type="button" size="sm" onClick={handleAddStop} className="shrink-0">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Stop
              </Button>
            </div>
          </div>

          {/* Route Map Preview Mock */}
          <div className="rounded-lg border border-border bg-card/60 p-5 flex flex-col items-center justify-center min-h-[130px] text-center">
            <MapPin className="h-7 w-7 text-primary mb-2 opacity-80" />
            <div className="text-xs font-semibold text-foreground">
              Route: {origin} ➔ {stops.map((s) => s.locationName).join(' ➔ ')} ➔ {destination}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-mono">
              OpenStreetMap / Google Maps Routing Mode Active (Total Waypoints: {stops.length})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger Manifest & Cargo Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Passenger Manifest */}
        <Card className="shadow-md">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">3. Passenger Manifest</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mandatory recording of all passengers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="space-y-1.5">
              {passengers.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/40 border border-border"
                >
                  <div>
                    <span className="font-semibold text-foreground">{p.name}</span>{' '}
                    <span className="text-muted-foreground">({p.department})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPassengers(passengers.filter((_, i) => i !== idx))}
                    className="text-destructive h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Full Name"
                value={newPassName}
                onChange={(e) => setNewPassName(e.target.value)}
                className="flex-1 bg-card text-xs h-8"
              />
              <Input
                placeholder="Dept"
                value={newPassDept}
                onChange={(e) => setNewPassDept(e.target.value)}
                className="w-24 bg-card text-xs h-8"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddPassenger}
                className="h-8"
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cargo Control */}
        <Card className="shadow-md">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">4. Cargo & Equipment Control</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Loaded products and asset accountability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
              {cargo.map((item, idx) => (
                <li
                  key={`cargo-${idx}`}
                  className="flex items-center justify-between text-xs px-3 py-2 bg-card"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground">{item.description}</span>
                    <span className="text-muted-foreground font-mono">Qty: {item.quantity}</span>
                    {item.isFragile && <Badge variant="warning">Fragile</Badge>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCargo(cargo.filter((_, i) => i !== idx))}
                    className="text-destructive h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Cargo Item / Asset Description"
                value={newCargoDesc}
                onChange={(e) => setNewCargoDesc(e.target.value)}
                className="flex-1 bg-card text-xs h-8"
              />
              <Input
                type="number"
                min={1}
                value={newCargoQty}
                onChange={(e) => setNewCargoQty(parseInt(e.target.value, 10) || 1)}
                className="w-16 bg-card text-xs h-8 text-center"
              />
              <label className="flex items-center text-xs space-x-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newCargoFragile}
                  onChange={(e) => setNewCargoFragile(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-ring"
                />
                <span className="text-muted-foreground">Fragile</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddCargo}
                className="h-8"
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="lg" disabled={isSubmitting} className="shadow-md">
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Submitting...' : 'Submit Transportation Service Request (TSRF)'}
        </Button>
      </div>
    </form>
  );
}
