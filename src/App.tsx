import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, LoginPage } from '@/features/auth';
import { RolesProvider, useRoles, type Permission } from '@/features/roles';
import { ThemeProvider } from '@/features/theme';
import { ReferenceDataProvider } from '@/features/maintenance';
import { ActivityLogProvider, useActivityLog } from '@/features/activity';
import { SidebarLayout, PAGE_ROUTES } from '@/components/layout';
import type { VehicleItem } from '@/features/fleet';
import type { PurchaseRequisitionItem, RepairWorkOrderItem } from '@/features/procurement';
import type { TSRFFormData } from '@/features/logistics';
import { ToastProvider, useToast } from '@/components/ui/toast';

// ─── Lazy-loaded Route Components (code-splitting) ────────────────────────────

const DashboardOverview = React.lazy(() =>
  import('@/features/dashboard/DashboardOverview').then((m) => ({
    default: m.DashboardOverview || m.default,
  })),
);
const UserManagementPage = React.lazy(() =>
  import('@/features/auth/UserManagementPage').then((m) => ({
    default: m.UserManagementPage || m.default,
  })),
);
const RolesManagementPage = React.lazy(() =>
  import('@/features/roles/RolesManagementPage').then((m) => ({
    default: m.RolesManagementPage || m.default,
  })),
);
const ThemeEditorPage = React.lazy(() =>
  import('@/features/theme/ThemeEditorPage').then((m) => ({
    default: m.ThemeEditorPage || m.default,
  })),
);
const ReferenceDataPage = React.lazy(() =>
  import('@/features/maintenance/ReferenceDataPage').then((m) => ({
    default: m.ReferenceDataPage || m.default,
  })),
);
const ActivityLogPage = React.lazy(() =>
  import('@/features/activity/ActivityLogPage').then((m) => ({
    default: m.ActivityLogPage || m.default,
  })),
);
const FormBuilderPage = React.lazy(() =>
  import('@/features/form-builder/FormBuilderPage').then((m) => ({
    default: m.FormBuilderPage || m.default,
  })),
);
const PublishedTsrfForm = React.lazy(() =>
  import('@/features/form-builder/PublishedTsrfForm').then((m) => ({
    default: m.PublishedTsrfForm || m.default,
  })),
);
const VehicleRegistryTable = React.lazy(() =>
  import('@/features/fleet/VehicleRegistryTable').then((m) => ({
    default: m.VehicleRegistryTable || m.default,
  })),
);
const IncidentReportModal = React.lazy(() =>
  import('@/features/fleet/IncidentReportModal').then((m) => ({
    default: m.IncidentReportModal || m.default,
  })),
);
const PRGatingDashboard = React.lazy(() =>
  import('@/features/procurement/PRGatingDashboard').then((m) => ({
    default: m.PRGatingDashboard || m.default,
  })),
);

// ─── Route Loading Fallback ───────────────────────────────────────────────────

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ─── Guarded Route ────────────────────────────────────────────────────────────

const ProtectedRoute = React.memo(function ProtectedRoute({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-4xl mb-3">🚫</p>
          <h2 className="text-lg font-bold text-foreground mb-1">Access Restricted</h2>
          <p className="text-muted-foreground text-sm">
            You don't have permission to view this module.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
});

// ─── Role Sync Bridge ─────────────────────────────────────────────────────────

function RoleSyncBridge({ children }: { children: React.ReactNode }) {
  const { roles } = useRoles();
  const { setRoleDefinitions } = useAuth();
  useEffect(() => {
    setRoleDefinitions(roles);
  }, [roles]);
  return <>{children}</>;
}

// ─── Fleet Page ───────────────────────────────────────────────────────────────

const FleetPage = React.memo(function FleetPage({
  vehicles,
  onLogMileage,
  onSchedulePms,
  onRequestRepair,
  incidentModalOpen,
  selectedIncidentVehicle,
  onIncidentClose,
  onIncidentSubmit,
}: {
  vehicles: VehicleItem[];
  onLogMileage: (id: string, km: number) => void;
  onSchedulePms: (v: VehicleItem) => void;
  onRequestRepair: (v: VehicleItem) => void;
  incidentModalOpen: boolean;
  selectedIncidentVehicle: VehicleItem | null;
  onIncidentClose: () => void;
  onIncidentSubmit: (data: { reportedBy: string; reason: string }) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fleet & KM Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Track vehicles, log mileage, and manage PMS schedules.
        </p>
      </div>
      <Suspense fallback={<RouteLoadingFallback />}>
        <VehicleRegistryTable
          vehicles={vehicles}
          onLogMileage={onLogMileage}
          onSchedulePms={onSchedulePms}
          onRequestRepair={onRequestRepair}
        />
        {selectedIncidentVehicle && (
          <IncidentReportModal
            open={incidentModalOpen}
            onClose={onIncidentClose}
            vehiclePlate={selectedIncidentVehicle.plateNumber}
            vehicleId={selectedIncidentVehicle.id}
            repairWorkOrderId="wo-pending-incident"
            onSubmit={onIncidentSubmit}
          />
        )}
      </Suspense>
    </div>
  );
});

// ─── Procurement Page ─────────────────────────────────────────────────────────

const ProcurementPage = React.memo(function ProcurementPage({
  prs,
  workOrders,
  onApprovePr,
  onUnlockWorkOrder,
  onUpdateFulfillment,
  onCreatePr,
}: {
  prs: PurchaseRequisitionItem[];
  workOrders: RepairWorkOrderItem[];
  onApprovePr: (id: string) => void;
  onUnlockWorkOrder: (woId: string, prId: string) => void;
  onUpdateFulfillment: (
    woId: string,
    status: 'in_maintenance' | 'work_completed' | 'vehicle_operational',
  ) => void;
  onCreatePr: (dept: string, purpose: string, amount: number) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">PR Gatekeeper & Procurement</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage purchase requisitions and work order approvals.
        </p>
      </div>
      <Suspense fallback={<RouteLoadingFallback />}>
        <PRGatingDashboard
          prs={prs}
          workOrders={workOrders}
          onApprovePr={onApprovePr}
          onUnlockWorkOrder={onUnlockWorkOrder}
          onUpdateFulfillment={onUpdateFulfillment}
          onCreatePr={onCreatePr}
        />
      </Suspense>
    </div>
  );
});

// ─── TSRF Page ────────────────────────────────────────────────────────────────

const TsrfPage = React.memo(function TsrfPage({
  onSubmit,
}: {
  onSubmit: (data: TSRFFormData) => void;
}) {
  return (
    <div className="animate-fade-in">
      <Suspense fallback={<RouteLoadingFallback />}>
        <PublishedTsrfForm onSubmit={onSubmit} />
      </Suspense>
    </div>
  );
});

// ─── Reports Page ─────────────────────────────────────────────────────────────

const ReportsPage = React.memo(function ReportsPage() {
  return (
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
  );
});

// ─── Inner App ────────────────────────────────────────────────────────────────

function InnerApp() {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { addLog } = useActivityLog();
  const { success: toastSuccess, warning: toastWarning } = useToast();

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

  const userName = currentUser?.name || 'System';

  // ── Memoized notification count ───────────────────────────────────────────
  const notifications = useMemo(
    () =>
      vehicles.filter((v) => v.computedPmsStatus === 'pms_due').length +
      prs.filter((p) => p.status === 'pending').length,
    [vehicles, prs],
  );

  // ── Stabilized callbacks (useCallback + functional updaters) ──────────────

  const handleLogMileage = useCallback(
    (vehicleId: string, newKm: number) => {
      setVehicles((prev) =>
        prev.map((v) => {
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
      toastSuccess(`Odometer updated to ${newKm.toLocaleString()} KM.`);
    },
    [addLog, userName, toastSuccess],
  );

  const handleSchedulePms = useCallback(
    (vehicle: VehicleItem) => {
      addLog({
        module: 'PMS',
        action: 'Dispatched',
        subject: `Vehicle ${vehicle.plateNumber}`,
        description: `PMS service order dispatched at ${vehicle.currentKm.toLocaleString()} KM.`,
        severity: 'success',
        user: userName,
      });
      toastSuccess(
        `PMS Service Order drafted for ${vehicle.plateNumber} at ${vehicle.currentKm} KM.`,
      );
    },
    [addLog, userName, toastSuccess],
  );

  const handleRequestRepair = useCallback(
    (vehicle: VehicleItem) => {
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
      setWorkOrders((prev) => [newWo, ...prev]);
      addLog({
        module: 'Work Order',
        action: 'Created',
        subject: newWo.workOrderNumber,
        description: `Work order created for ${vehicle.plateNumber}: ${newWo.description}`,
        severity: 'info',
        user: userName,
      });
      toastSuccess(`Work Order ${newWo.workOrderNumber} drafted.`);
    },
    [addLog, userName, toastSuccess],
  );

  const handleIncidentSubmit = useCallback(
    (data: { reportedBy: string; reason: string }) => {
      setSelectedIncidentVehicle((prev) => {
        if (!prev) return null;
        const newWo: RepairWorkOrderItem = {
          id: `wo-${Date.now()}`,
          workOrderNumber: `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          vehicleId: prev.id,
          vehiclePlate: prev.plateNumber,
          description: `Repair authorized: ${data.reason}`,
          status: 'pending',
          hasPmsCompliance: false,
          incidentReportFiled: true,
          procurementFulfillmentStatus: 'pending_pr_approval',
        };
        setWorkOrders((prevWos) => [newWo, ...prevWos]);
        addLog({
          module: 'Incident Report',
          action: 'Submitted',
          subject: `Vehicle ${prev.plateNumber}`,
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
        toastSuccess(`Incident Report filed by ${data.reportedBy}.`);
        return prev; // don't change the vehicle selection
      });
      setIncidentModalOpen(false);
    },
    [addLog, userName, toastSuccess],
  );

  const handleIncidentClose = useCallback(() => setIncidentModalOpen(false), []);

  const handleApprovePr = useCallback(
    (prId: string) => {
      setPrs((prev) => {
        const pr = prev.find((p) => p.id === prId);
        addLog({
          module: 'Purchase Requisition',
          action: 'Approved',
          subject: pr?.prNumber || prId,
          description: `PR approved by ${userName}. Amount: ₱${pr?.amount.toLocaleString() || '—'}.`,
          severity: 'success',
          user: userName,
        });
        toastSuccess('PR approved!');
        return prev.map((p) =>
          p.id === prId ? { ...p, status: 'approved', approvedBy: `${userName} (Finance)` } : p,
        );
      });
    },
    [addLog, userName, toastSuccess],
  );

  const handleUnlockWorkOrder = useCallback(
    (workOrderId: string, prId: string) => {
      setPrs((currentPrs) => {
        const pr = currentPrs.find((p) => p.id === prId);
        if (!pr || pr.status !== 'approved') {
          toastWarning('Blocked: PR not yet approved.');
          addLog({
            module: 'Work Order',
            action: 'Rejected',
            subject: workOrderId,
            description: 'Work order unlock blocked — linked PR not approved.',
            severity: 'warning',
            user: userName,
          });
          return currentPrs; // no change
        }
        setWorkOrders((prevWos) => {
          const wo = prevWos.find((w) => w.id === workOrderId);
          addLog({
            module: 'Work Order',
            action: 'Approved',
            subject: wo?.workOrderNumber || workOrderId,
            description: `Work order unlocked after PR ${pr.prNumber} was confirmed approved.`,
            severity: 'success',
            user: userName,
          });
          toastSuccess('Work Order unlocked!');
          return prevWos.map((wo) =>
            wo.id === workOrderId
              ? { ...wo, status: 'approved', procurementFulfillmentStatus: 'pr_approved' }
              : wo,
          );
        });
        return currentPrs; // no change to PRs
      });
    },
    [addLog, userName, toastSuccess, toastWarning],
  );

  const handleUpdateFulfillment = useCallback(
    (workOrderId: string, status: 'in_maintenance' | 'work_completed' | 'vehicle_operational') => {
      setWorkOrders((prevWos) => {
        const targetWo = prevWos.find((w) => w.id === workOrderId);
        if (status === 'vehicle_operational' && targetWo) {
          setVehicles((prevVs) =>
            prevVs.map((v) =>
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
          toastSuccess(`Vehicle ${targetWo.vehiclePlate} restored to Operational!`);
        } else {
          addLog({
            module: 'Work Order',
            action: 'Updated',
            subject: targetWo?.workOrderNumber || workOrderId,
            description: `Fulfillment status updated to "${status.replace(/_/g, ' ')}".`,
            severity: 'info',
            user: userName,
          });
          toastSuccess('Fulfillment updated.');
        }
        return prevWos.map((wo) =>
          wo.id === workOrderId ? { ...wo, procurementFulfillmentStatus: status } : wo,
        );
      });
    },
    [addLog, userName, toastSuccess],
  );

  const handleCreatePr = useCallback(
    (department: string, purpose: string, amount: number) => {
      const newPr: PurchaseRequisitionItem = {
        id: `pr-${Date.now()}`,
        prNumber: `PR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        department,
        purpose,
        amount,
        status: 'pending',
      };
      setPrs((prev) => [newPr, ...prev]);
      addLog({
        module: 'Purchase Requisition',
        action: 'Created',
        subject: newPr.prNumber,
        description: `PR created by ${department}: ${purpose}. Amount: ₱${amount.toLocaleString()}.`,
        severity: 'info',
        user: userName,
      });
      toastSuccess(`PR ${newPr.prNumber} created.`);
    },
    [addLog, userName, toastSuccess],
  );

  const handleTsrfSubmit = useCallback(
    (data: TSRFFormData) => {
      addLog({
        module: 'TSRF',
        action: 'Submitted',
        subject: `TSRF - ${data.projectName}`,
        description: `TSRF submitted by ${currentUser?.department || 'Unknown Dept'} for "${data.projectName}" with ${data.stops.length} stops.`,
        severity: 'info',
        user: userName,
      });
      toastSuccess(`TSRF created for "${data.projectName}" with ${data.stops.length} stops.`);
    },
    [addLog, userName, currentUser?.department, toastSuccess],
  );

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Layout route — SidebarLayout wraps all child routes via <Outlet> */}
        <Route element={<SidebarLayout notifications={notifications} />}>
          {/* Default redirect */}
          <Route index element={<Navigate to={PAGE_ROUTES.dashboard} replace />} />

          {/* Dashboard */}
          <Route
            path={PAGE_ROUTES.dashboard}
            element={
              <ProtectedRoute permission="view:dashboard">
                <DashboardOverview />
              </ProtectedRoute>
            }
          />

          {/* Fleet */}
          <Route
            path={PAGE_ROUTES.fleet}
            element={
              <ProtectedRoute permission="view:fleet">
                <FleetPage
                  vehicles={vehicles}
                  onLogMileage={handleLogMileage}
                  onSchedulePms={handleSchedulePms}
                  onRequestRepair={handleRequestRepair}
                  incidentModalOpen={incidentModalOpen}
                  selectedIncidentVehicle={selectedIncidentVehicle}
                  onIncidentClose={handleIncidentClose}
                  onIncidentSubmit={handleIncidentSubmit}
                />
              </ProtectedRoute>
            }
          />

          {/* Procurement */}
          <Route
            path={PAGE_ROUTES.procurement}
            element={
              <ProtectedRoute permission="view:procurement">
                <ProcurementPage
                  prs={prs}
                  workOrders={workOrders}
                  onApprovePr={handleApprovePr}
                  onUnlockWorkOrder={handleUnlockWorkOrder}
                  onUpdateFulfillment={handleUpdateFulfillment}
                  onCreatePr={handleCreatePr}
                />
              </ProtectedRoute>
            }
          />

          {/* TSRF */}
          <Route
            path={PAGE_ROUTES.tsrf}
            element={
              <ProtectedRoute permission="view:tsrf">
                <TsrfPage onSubmit={handleTsrfSubmit} />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${PAGE_ROUTES.tsrf}/:id`}
            element={
              <ProtectedRoute permission="view:tsrf">
                <TsrfPage onSubmit={handleTsrfSubmit} />
              </ProtectedRoute>
            }
          />

          {/* Users */}
          <Route
            path={PAGE_ROUTES.users}
            element={
              <ProtectedRoute permission="view:users">
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Roles */}
          <Route
            path={PAGE_ROUTES.roles}
            element={
              <ProtectedRoute permission="view:roles">
                <RolesManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Reference Data */}
          <Route
            path={PAGE_ROUTES.maintenance_ref}
            element={
              <ProtectedRoute permission="view:maintenance_ref">
                <ReferenceDataPage />
              </ProtectedRoute>
            }
          />

          {/* Activity History */}
          <Route path={PAGE_ROUTES.history} element={<ActivityLogPage />} />

          {/* Theme Editor */}
          <Route path={PAGE_ROUTES.theme_editor} element={<ThemeEditorPage />} />

          {/* Form Builder */}
          <Route
            path={PAGE_ROUTES.form_builder}
            element={
              <ProtectedRoute permission="manage:reference_data">
                <FormBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${PAGE_ROUTES.form_builder}/versions/:version`}
            element={
              <ProtectedRoute permission="manage:reference_data">
                <FormBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${PAGE_ROUTES.form_builder}/preview/:role/:stage/:version?`}
            element={
              <ProtectedRoute permission="manage:reference_data">
                <FormBuilderPage />
              </ProtectedRoute>
            }
          />

          {/* Reports */}
          <Route
            path={PAGE_ROUTES.reports}
            element={
              <ProtectedRoute permission="view:reports">
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all → redirect to dashboard */}
          <Route path="*" element={<Navigate to={PAGE_ROUTES.dashboard} replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
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
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
