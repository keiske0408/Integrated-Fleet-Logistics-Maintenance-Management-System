import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, LoginPage, UserManagementPage } from '@/features/auth';
import { RolesProvider, useRoles, RolesManagementPage } from '@/features/roles';
import { ThemeProvider, ThemeEditorPage } from '@/features/theme';
import { ReferenceDataProvider, ReferenceDataPage } from '@/features/maintenance';
import { ActivityLogProvider, useActivityLog, ActivityLogPage } from '@/features/activity';
import { SidebarLayout, type AppPage } from '@/components/layout';
import { DashboardOverview } from '@/features/dashboard';
import { VehicleRegistryTable, IncidentReportModal, type VehicleItem } from '@/features/fleet';
import {
  PRGatingDashboard,
  type PurchaseRequisitionItem,
  type RepairWorkOrderItem,
} from '@/features/procurement';
import type { TSRFFormData } from '@/features/logistics';
import {
  FormBuilderPage,
  FormRenderer,
  serializeTsrfValues,
  TSRF_V1,
} from '@/features/form-builder';

// ─── Role Sync Bridge ─────────────────────────────────────────────────────────

function RoleSyncBridge({ children }: { children: React.ReactNode }) {
  const { roles } = useRoles();
  const { setRoleDefinitions } = useAuth();
  useEffect(() => {
    setRoleDefinitions(roles);
  }, [roles]);
  return <>{children}</>;
}

// ─── Inner App ────────────────────────────────────────────────────────────────

function InnerApp() {
  const { isAuthenticated, hasPermission, currentUser } = useAuth();
  const { addLog } = useActivityLog();
  const [activePage, setActivePage] = useState<AppPage>('dashboard');

  // ── Fleet state ───────────────────────────────────────────────────────────
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
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [selectedIncidentVehicle, setSelectedIncidentVehicle] = useState<VehicleItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userName = currentUser?.name || 'System';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogMileage = (vehicleId: string, newKm: number) => {
    setVehicles(
      vehicles.map((v) => {
        if (v.id !== vehicleId) return v;
        const nextDue = v.lastPmsKm + v.pmsIntervalKm;
        const isDue = newKm >= nextDue;
        const status = isDue ? 'pms_due' : newKm >= nextDue - 500 ? 'pms_approaching' : 'active';
        addLog({
          module: 'Fleet',
          action: 'Updated',
          subject: `Vehicle ${v.plateNumber}`,
          description: `Odometer updated from ${v.currentKm.toLocaleString()} to ${newKm.toLocaleString()} KM.${isDue ? ' PMS now due.' : ''}`,
          severity: isDue ? 'warning' : 'info',
          user: userName,
          metadata: { previous_km: v.currentKm, new_km: newKm },
        });
        return {
          ...v,
          currentKm: newKm,
          status: isDue ? 'pms_due' : v.status,
          computedPmsStatus: status,
        };
      }),
    );
    showToast(`Odometer updated to ${newKm.toLocaleString()} KM.`);
  };

  const handleSchedulePms = (vehicle: VehicleItem) => {
    addLog({
      module: 'PMS',
      action: 'Dispatched',
      subject: `Vehicle ${vehicle.plateNumber}`,
      description: `PMS service order dispatched at ${vehicle.currentKm.toLocaleString()} KM.`,
      severity: 'success',
      user: userName,
    });
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
    addLog({
      module: 'Work Order',
      action: 'Created',
      subject: newWo.workOrderNumber,
      description: `Work order created for ${vehicle.plateNumber}: ${newWo.description}`,
      severity: 'info',
      user: userName,
    });
    showToast(`Work Order ${newWo.workOrderNumber} drafted.`);
  };

  const handleIncidentSubmit = (data: { reportedBy: string; reason: string }) => {
    if (!selectedIncidentVehicle) return;
    const newWo: RepairWorkOrderItem = {
      id: `wo-${Date.now()}`,
      workOrderNumber: `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleId: selectedIncidentVehicle.id,
      vehiclePlate: selectedIncidentVehicle.plateNumber,
      description: `Repair authorized: ${data.reason}`,
      status: 'pending',
      hasPmsCompliance: false,
      incidentReportFiled: true,
      procurementFulfillmentStatus: 'pending_pr_approval',
    };
    setWorkOrders([newWo, ...workOrders]);
    addLog({
      module: 'Incident Report',
      action: 'Submitted',
      subject: `Vehicle ${selectedIncidentVehicle.plateNumber}`,
      description: `Incident report filed by ${data.reportedBy}: ${data.reason}`,
      severity: 'error',
      user: data.reportedBy,
    });
    addLog({
      module: 'Work Order',
      action: 'Created',
      subject: newWo.workOrderNumber,
      description: `Work order ${newWo.workOrderNumber} created from incident report.`,
      severity: 'warning',
      user: userName,
    });
    setIncidentModalOpen(false);
    showToast(`Incident Report filed by ${data.reportedBy}.`);
  };

  const handleApprovePr = (prId: string) => {
    const pr = prs.find((p) => p.id === prId);
    setPrs(
      prs.map((p) =>
        p.id === prId ? { ...p, status: 'approved', approvedBy: `${userName} (Finance)` } : p,
      ),
    );
    addLog({
      module: 'Purchase Requisition',
      action: 'Approved',
      subject: pr?.prNumber || prId,
      description: `PR approved by ${userName}. Amount: ₱${pr?.amount.toLocaleString() || '—'}.`,
      severity: 'success',
      user: userName,
    });
    showToast('PR approved!');
  };

  const handleUnlockWorkOrder = (workOrderId: string, prId: string) => {
    const pr = prs.find((p) => p.id === prId);
    if (!pr || pr.status !== 'approved') {
      showToast('Blocked: PR not yet approved.');
      addLog({
        module: 'Work Order',
        action: 'Rejected',
        subject: workOrderId,
        description: 'Work order unlock blocked — linked PR not approved.',
        severity: 'warning',
        user: userName,
      });
      return;
    }
    const wo = workOrders.find((w) => w.id === workOrderId);
    setWorkOrders(
      workOrders.map((wo) =>
        wo.id === workOrderId
          ? { ...wo, status: 'approved', procurementFulfillmentStatus: 'pr_approved' }
          : wo,
      ),
    );
    addLog({
      module: 'Work Order',
      action: 'Approved',
      subject: wo?.workOrderNumber || workOrderId,
      description: `Work order unlocked after PR ${pr.prNumber} was confirmed approved.`,
      severity: 'success',
      user: userName,
    });
    showToast('Work Order unlocked!');
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
      addLog({
        module: 'Fleet',
        action: 'Completed',
        subject: `Vehicle ${targetWo.vehiclePlate}`,
        description: `Vehicle ${targetWo.vehiclePlate} returned to operational status after maintenance (${targetWo.workOrderNumber}).`,
        severity: 'success',
        user: userName,
      });
      showToast(`Vehicle ${targetWo.vehiclePlate} restored to Operational!`);
    } else {
      addLog({
        module: 'Work Order',
        action: 'Updated',
        subject: targetWo?.workOrderNumber || workOrderId,
        description: `Fulfillment status updated to "${status.replace(/_/g, ' ')}".`,
        severity: 'info',
        user: userName,
      });
      showToast(`Fulfillment updated.`);
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
    addLog({
      module: 'Purchase Requisition',
      action: 'Created',
      subject: newPr.prNumber,
      description: `PR created by ${department}: ${purpose}. Amount: ₱${amount.toLocaleString()}.`,
      severity: 'info',
      user: userName,
    });
    showToast(`PR ${newPr.prNumber} created.`);
  };

  const handleTsrfSubmit = (data: TSRFFormData) => {
    addLog({
      module: 'TSRF',
      action: 'Submitted',
      subject: `TSRF - ${data.projectName}`,
      description: `TSRF submitted by ${currentUser?.department || 'Unknown Dept'} for "${data.projectName}" with ${data.stops.length} stops.`,
      severity: 'info',
      user: userName,
    });
    showToast(`TSRF created for "${data.projectName}" with ${data.stops.length} stops.`);
  };

  if (!isAuthenticated) return <LoginPage />;

  const notifications =
    vehicles.filter((v) => v.computedPmsStatus === 'pms_due').length +
    prs.filter((p) => p.status === 'pending').length;

  return (
    <SidebarLayout activePage={activePage} onNavigate={setActivePage} notifications={notifications}>
      {/* Global toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-3 bg-card border border-border text-foreground text-sm rounded-xl shadow-2xl animate-slide-in-right flex items-center gap-2 max-w-sm">
          <span className="text-primary shrink-0">🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Dashboard ── */}
      {activePage === 'dashboard' && hasPermission('view:dashboard') && <DashboardOverview />}

      {/* ── Fleet ── */}
      {activePage === 'fleet' && hasPermission('view:fleet') && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fleet & KM Monitoring</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track vehicles, log mileage, and manage PMS schedules.
            </p>
          </div>
          <VehicleRegistryTable
            vehicles={vehicles}
            onLogMileage={handleLogMileage}
            onSchedulePms={handleSchedulePms}
            onRequestRepair={handleRequestRepair}
          />
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
      )}

      {/* ── Procurement ── */}
      {activePage === 'procurement' && hasPermission('view:procurement') && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PR Gatekeeper & Procurement</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage purchase requisitions and work order approvals.
            </p>
          </div>
          <PRGatingDashboard
            prs={prs}
            workOrders={workOrders}
            onApprovePr={handleApprovePr}
            onUnlockWorkOrder={handleUnlockWorkOrder}
            onUpdateFulfillment={handleUpdateFulfillment}
            onCreatePr={handleCreatePr}
          />
        </div>
      )}

      {/* ── TSRF ── */}
      {activePage === 'tsrf' && hasPermission('view:tsrf') && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">TSRF Logistics Intake</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Submit Transportation Service Request Forms for dispatch.
            </p>
          </div>
          <FormRenderer
            definition={TSRF_V1}
            onSubmit={(values) => handleTsrfSubmit(serializeTsrfValues(values))}
          />
        </div>
      )}

      {/* ── Users ── */}
      {activePage === 'users' && hasPermission('view:users') && <UserManagementPage />}

      {/* ── Roles ── */}
      {activePage === 'roles' && hasPermission('view:roles') && <RolesManagementPage />}

      {/* ── Reference Data ── */}
      {activePage === 'maintenance_ref' && hasPermission('view:maintenance_ref') && (
        <ReferenceDataPage />
      )}

      {/* ── Activity History ── */}
      {activePage === 'history' && <ActivityLogPage />}

      {/* ── Theme Editor ── */}
      {activePage === 'theme_editor' && <ThemeEditorPage />}

      {activePage === 'form_builder' && hasPermission('manage:reference_data') && (
        <FormBuilderPage />
      )}

      {/* ── Reports ── */}
      {activePage === 'reports' && hasPermission('view:reports') && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Fleet analytics and reports — coming soon.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-muted-foreground text-sm">
              Advanced reporting module coming in the next phase.
            </p>
          </div>
        </div>
      )}

      {/* Access denied */}
      {(
        [
          'fleet',
          'procurement',
          'tsrf',
          'users',
          'roles',
          'maintenance_ref',
          'reports',
          'form_builder',
        ] as AppPage[]
      ).includes(activePage) &&
        !hasPermission(`view:${activePage}` as any) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-4xl mb-3">🚫</p>
              <h2 className="text-lg font-bold text-foreground mb-1">Access Restricted</h2>
              <p className="text-muted-foreground text-sm">
                You don't have permission to view this module.
              </p>
            </div>
          </div>
        )}
    </SidebarLayout>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export function App() {
  return (
    <ThemeProvider>
      <RolesProvider>
        <AuthProvider>
          <ActivityLogProvider>
            <ReferenceDataProvider>
              <RoleSyncBridge>
                <InnerApp />
              </RoleSyncBridge>
            </ReferenceDataProvider>
          </ActivityLogProvider>
        </AuthProvider>
      </RolesProvider>
    </ThemeProvider>
  );
}

export default App;
