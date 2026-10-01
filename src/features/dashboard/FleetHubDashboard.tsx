import React, { useState } from 'react';
import type { TSRFFormData } from '@/features/logistics/TSRFForm';
import { FormRenderer, serializeTsrfValues, TSRF_V1 } from '@/features/form-builder';
import { VehicleRegistryTable, VehicleItem } from '@/features/fleet/VehicleRegistryTable';
import {
  PRGatingDashboard,
  PurchaseRequisitionItem,
  RepairWorkOrderItem,
} from '@/features/procurement/PRGatingDashboard';
import { IncidentReportModal } from '@/features/fleet/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { Truck, Shield, Calendar, Wrench, Bell, UserCheck } from 'lucide-react';

export function FleetHubDashboard() {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'procurement' | 'tsrf'>('vehicles');
  const [currentRole, setCurrentRole] = useState<
    'department_requester' | 'fleet_team' | 'finance' | 'procurement' | 'admin'
  >('admin');

  // Vehicles state
  const [vehicles, setVehicles] = useState<VehicleItem[]>([
    {
      id: 'v-1',
      plateNumber: 'ABC-1234',
      model: 'Toyota HiAce Commuter Van',
      vehicleType: 'commuter_van',
      assignedDriver: 'Juan Dela Cruz',
      currentKm: 4200,
      lastPmsKm: 0,
      pmsIntervalKm: 5000,
      status: 'active',
      computedPmsStatus: 'active',
    },
    {
      id: 'v-2',
      plateNumber: 'XYZ-9876',
      model: 'Isuzu Elf 6W Forward Truck',
      vehicleType: 'truck_6w',
      assignedDriver: 'Roberto Santos',
      currentKm: 5120,
      lastPmsKm: 0,
      pmsIntervalKm: 5000,
      status: 'pms_due',
      computedPmsStatus: 'pms_due',
    },
    {
      id: 'v-3',
      plateNumber: 'NCR-5566',
      model: 'Hino 10-Wheeler Cargo Carrier',
      vehicleType: 'truck_10w',
      assignedDriver: 'Mario Reyes',
      currentKm: 9800,
      lastPmsKm: 5000,
      pmsIntervalKm: 5000,
      status: 'active',
      computedPmsStatus: 'pms_approaching',
    },
  ]);

  // PRs state
  const [prs, setPrs] = useState<PurchaseRequisitionItem[]>([
    {
      id: 'pr-1',
      prNumber: 'PR-2026-1042',
      department: 'Fleet Operations',
      amount: 18500,
      status: 'pending',
      purpose: 'Complete overhaul of braking pads and disc rotors for XYZ-9876',
    },
    {
      id: 'pr-2',
      prNumber: 'PR-2026-1011',
      department: 'Logistics',
      amount: 6200,
      status: 'approved',
      purpose: 'Engine oil change, air/fuel filter renewal for ABC-1234',
      approvedBy: 'Finance Head',
    },
  ]);

  // Work Orders state
  const [workOrders, setWorkOrders] = useState<RepairWorkOrderItem[]>([
    {
      id: 'wo-1',
      workOrderNumber: 'WO-2026-0041',
      vehicleId: 'v-2',
      vehiclePlate: 'XYZ-9876',
      description: 'Severe brake squeal & overdue 5,000 km PMS skipped',
      status: 'pending',
      linkedPrId: 'pr-1',
      hasPmsCompliance: false,
      incidentReportFiled: false,
      procurementFulfillmentStatus: 'pending_pr_approval',
    },
  ]);

  // Incident Modal state
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [selectedIncidentVehicle, setSelectedIncidentVehicle] = useState<VehicleItem | null>(null);

  // Notification message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handlers
  const handleLogMileage = (vehicleId: string, newKm: number) => {
    setVehicles(
      vehicles.map((v) => {
        if (v.id === vehicleId) {
          const nextDue = v.lastPmsKm + v.pmsIntervalKm;
          const isDue = newKm >= nextDue;
          return {
            ...v,
            currentKm: newKm,
            status: isDue ? 'pms_due' : v.status,
            computedPmsStatus: isDue
              ? 'pms_due'
              : newKm >= nextDue - 500
                ? 'pms_approaching'
                : 'active',
          };
        }
        return v;
      }),
    );
    showToast(`Odometer updated to ${newKm.toLocaleString()} KM.`);
  };

  const handleSchedulePms = (vehicle: VehicleItem) => {
    showToast(`PMS Service Order drafted for ${vehicle.plateNumber} at ${vehicle.currentKm} KM.`);
  };

  const handleRequestRepair = (vehicle: VehicleItem) => {
    const isOverdue =
      vehicle.status === 'pms_due' ||
      vehicle.currentKm >= vehicle.lastPmsKm + vehicle.pmsIntervalKm;
    if (isOverdue) {
      setSelectedIncidentVehicle(vehicle);
      setIncidentModalOpen(true);
      return;
    }

    const newWo: RepairWorkOrderItem = {
      id: `wo-${Date.now()}`,
      workOrderNumber: `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plateNumber,
      description: 'Scheduled preventative overhaul',
      status: 'pending',
      hasPmsCompliance: true,
      incidentReportFiled: false,
      procurementFulfillmentStatus: 'pending_pr_approval',
    };
    setWorkOrders([newWo, ...workOrders]);
    showToast(`Repair work order ${newWo.workOrderNumber} drafted in Pending PR status.`);
  };

  const handleIncidentSubmit = (data: { reportedBy: string; reason: string }) => {
    if (!selectedIncidentVehicle) return;

    const newWo: RepairWorkOrderItem = {
      id: `wo-${Date.now()}`,
      workOrderNumber: `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleId: selectedIncidentVehicle.id,
      vehiclePlate: selectedIncidentVehicle.plateNumber,
      description: `Repair authorized following incident report: ${data.reason}`,
      status: 'pending',
      hasPmsCompliance: false,
      incidentReportFiled: true,
      procurementFulfillmentStatus: 'pending_pr_approval',
    };
    setWorkOrders([newWo, ...workOrders]);
    setIncidentModalOpen(false);
    showToast(
      `Incident Report filed by ${data.reportedBy}. Repair Work Order unlocked for PR review.`,
    );
  };

  const handleApprovePr = (prId: string) => {
    setPrs(
      prs.map((p) =>
        p.id === prId ? { ...p, status: 'approved', approvedBy: 'Finance Head (You)' } : p,
      ),
    );
    showToast('Purchase Requisition approved! Centralized PR Gatekeeper is now unlocked.');
  };

  const handleUnlockWorkOrder = (workOrderId: string, prId: string) => {
    const pr = prs.find((p) => p.id === prId);
    if (!pr || pr.status !== 'approved') {
      showToast('Blocked by PR Gatekeeper: Linked PR is not approved.');
      return;
    }

    setWorkOrders(
      workOrders.map((wo) =>
        wo.id === workOrderId
          ? {
              ...wo,
              status: 'approved',
              procurementFulfillmentStatus: 'pr_approved',
            }
          : wo,
      ),
    );
    showToast('Work Order unlocked! Procurement is notified for vendor coordination.');
  };

  const handleUpdateFulfillment = (
    workOrderId: string,
    status: 'in_maintenance' | 'work_completed' | 'vehicle_operational',
  ) => {
    const targetWo = workOrders.find((w) => w.id === workOrderId);
    setWorkOrders(
      workOrders.map((wo) =>
        wo.id === workOrderId ? { ...wo, procurementFulfillmentStatus: status } : wo,
      ),
    );

    if (status === 'vehicle_operational' && targetWo) {
      setVehicles(
        vehicles.map((v) =>
          v.id === targetWo.vehicleId ? { ...v, status: 'active', lastPmsKm: v.currentKm } : v,
        ),
      );
      showToast(`Vehicle ${targetWo.vehiclePlate} restored to Operational Fleet!`);
    } else {
      showToast(`Procurement fulfillment status updated to ${status}.`);
    }
  };

  const handleCreatePr = (department: string, purpose: string, amount: number) => {
    const newPr: PurchaseRequisitionItem = {
      id: `pr-${Date.now()}`,
      prNumber: `PR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      department,
      purpose,
      amount,
      status: 'pending',
    };
    setPrs([newPr, ...prs]);
    showToast(`Purchase Requisition ${newPr.prNumber} drafted.`);
  };

  const handleTsrfSubmit = (data: TSRFFormData) => {
    showToast(`TSRF Request created for "${data.projectName}" with ${data.stops.length} stops.`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans transition-colors">
      {/* Top Navbar */}
      <header className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Hulma Integrated Fleet Logistics & Maintenance Management
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enterprise Fleet Visibility • Automated 5,000 KM PMS • Approved PR Gatekeeper • TSRF
                Dispatch
              </p>
            </div>
          </div>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center space-x-2.5 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm text-xs">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground font-medium">Role:</span>
          <select
            value={currentRole}
            onChange={(e) =>
              setCurrentRole(
                e.target.value as
                  'department_requester' | 'fleet_team' | 'finance' | 'procurement' | 'admin',
              )
            }
            className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer"
          >
            <option value="admin">System Admin</option>
            <option value="department_requester">Requester (IT / Dept)</option>
            <option value="fleet_team">Logistics & Fleet Manager</option>
            <option value="finance">Finance Manager</option>
            <option value="procurement">Procurement Team</option>
          </select>
          <Badge variant="secondary" className="capitalize text-[11px] font-mono">
            {currentRole.replace('_', ' ')}
          </Badge>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-popover text-popover-foreground text-xs rounded-xl shadow-2xl flex items-center space-x-2.5 border border-border animate-slide-up">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-5xl mx-auto mb-6 flex space-x-2 border-b border-border">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center space-x-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'vehicles'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>Module B: Fleet & 5,000 KM Monitoring</span>
        </button>

        <button
          onClick={() => setActiveTab('procurement')}
          className={`flex items-center space-x-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'procurement'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Module C: PR Gatekeeper & Procurement</span>
        </button>

        <button
          onClick={() => setActiveTab('tsrf')}
          className={`flex items-center space-x-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'tsrf'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Module A: TSRF Logistics Intake & Routing</span>
        </button>
      </div>

      {/* Tab Panels */}
      <main className="max-w-5xl mx-auto">
        {activeTab === 'vehicles' && (
          <VehicleRegistryTable
            vehicles={vehicles}
            onLogMileage={handleLogMileage}
            onSchedulePms={handleSchedulePms}
            onRequestRepair={handleRequestRepair}
          />
        )}

        {activeTab === 'procurement' && (
          <PRGatingDashboard
            prs={prs}
            workOrders={workOrders}
            onApprovePr={handleApprovePr}
            onUnlockWorkOrder={handleUnlockWorkOrder}
            onUpdateFulfillment={handleUpdateFulfillment}
            onCreatePr={handleCreatePr}
          />
        )}

        {activeTab === 'tsrf' && (
          <FormRenderer
            definition={TSRF_V1}
            onSubmit={(values) => handleTsrfSubmit(serializeTsrfValues(values))}
          />
        )}
      </main>

      {/* Incident Report Modal */}
      {selectedIncidentVehicle && (
        <IncidentReportModal
          open={incidentModalOpen}
          onClose={() => setIncidentModalOpen(false)}
          vehiclePlate={selectedIncidentVehicle.plateNumber}
          vehicleId={selectedIncidentVehicle.id}
          repairWorkOrderId="wo-pending-incident"
          onSubmit={handleIncidentSubmit}
        />
      )}
    </div>
  );
}
