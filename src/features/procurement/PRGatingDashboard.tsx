import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Lock,
  Unlock,
  CheckCircle2,
  Plus,
  ShieldCheck,
  ArrowRight,
  Truck,
  FileText,
  Wrench,
  Search,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';

export interface PurchaseRequisitionItem {
  id: string;
  prNumber: string;
  department: string;
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  purpose: string;
  approvedBy?: string | null;
}

export interface RepairWorkOrderItem {
  id: string;
  workOrderNumber: string;
  vehicleId: string;
  vehiclePlate?: string;
  description: string;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  linkedPrId?: string | null;
  hasPmsCompliance: boolean;
  incidentReportFiled: boolean;
  procurementFulfillmentStatus:
    | 'pending_pr_approval'
    | 'pr_approved'
    | 'in_maintenance'
    | 'work_completed'
    | 'vehicle_operational';
}

interface PRGatingDashboardProps {
  prs: PurchaseRequisitionItem[];
  workOrders: RepairWorkOrderItem[];
  onApprovePr: (prId: string) => void;
  onUnlockWorkOrder: (workOrderId: string, prId: string) => void;
  onUpdateFulfillment: (
    workOrderId: string,
    status: 'in_maintenance' | 'work_completed' | 'vehicle_operational',
  ) => void;
  onCreatePr: (department: string, purpose: string, amount: number) => void;
}

export function PRGatingDashboard({
  prs,
  workOrders,
  onApprovePr,
  onUnlockWorkOrder,
  onUpdateFulfillment,
  onCreatePr,
}: PRGatingDashboardProps) {
  const [newPrDept, setNewPrDept] = useState('Logistics');
  const [newPrPurpose, setNewPrPurpose] = useState('');
  const [newPrAmount, setNewPrAmount] = useState(15000);
  const [showCreatePr, setShowCreatePr] = useState(false);

  // ─── Section 1: PR Search, Filter, Sort & Pagination State ──────────────────
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [prStatusFilter, setPrStatusFilter] = useState('all');
  const [prDeptFilter, setPrDeptFilter] = useState('all');
  const [prSortBy, setPrSortBy] = useState<'newest' | 'amount_desc' | 'amount_asc' | 'dept'>(
    'newest',
  );
  const [prCurrentPage, setPrCurrentPage] = useState(1);
  const [prPageSize, setPrPageSize] = useState(5);

  const prDepartments = useMemo(() => {
    const depts = new Set<string>();
    prs.forEach((p) => {
      if (p.department) depts.add(p.department);
    });
    return Array.from(depts).sort();
  }, [prs]);

  const hasPrActiveFilters =
    prSearchQuery.trim() !== '' ||
    prStatusFilter !== 'all' ||
    prDeptFilter !== 'all' ||
    prSortBy !== 'newest';

  const handleResetPrFilters = () => {
    setPrSearchQuery('');
    setPrStatusFilter('all');
    setPrDeptFilter('all');
    setPrSortBy('newest');
    setPrCurrentPage(1);
  };

  useEffect(() => {
    setPrCurrentPage(1);
  }, [prSearchQuery, prStatusFilter, prDeptFilter, prSortBy]);

  const filteredPrs = useMemo(() => {
    return prs
      .filter((pr) => {
        if (prSearchQuery.trim()) {
          const q = prSearchQuery.toLowerCase();
          const matchNumber = pr.prNumber?.toLowerCase().includes(q);
          const matchDept = pr.department?.toLowerCase().includes(q);
          const matchPurpose = pr.purpose?.toLowerCase().includes(q);
          const matchApprover = pr.approvedBy?.toLowerCase().includes(q);
          if (!matchNumber && !matchDept && !matchPurpose && !matchApprover) return false;
        }
        if (prStatusFilter !== 'all' && pr.status !== prStatusFilter) return false;
        if (prDeptFilter !== 'all' && pr.department !== prDeptFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (prSortBy === 'amount_desc') return b.amount - a.amount;
        if (prSortBy === 'amount_asc') return a.amount - b.amount;
        if (prSortBy === 'dept') return a.department.localeCompare(b.department);
        return 0;
      });
  }, [prs, prSearchQuery, prStatusFilter, prDeptFilter, prSortBy]);

  const paginatedPrs = useMemo(() => {
    const startIndex = (prCurrentPage - 1) * prPageSize;
    return filteredPrs.slice(startIndex, startIndex + prPageSize);
  }, [filteredPrs, prCurrentPage, prPageSize]);

  // ─── Section 2: Work Order Search, Filter & Pagination State ────────────────
  const [woSearchQuery, setWoSearchQuery] = useState('');
  const [woStatusFilter, setWoStatusFilter] = useState('all');
  const [woSortBy, setWoSortBy] = useState<'number_asc' | 'plate_asc'>('number_asc');
  const [woCurrentPage, setWoCurrentPage] = useState(1);
  const [woPageSize, setWoPageSize] = useState(5);

  const hasWoActiveFilters =
    woSearchQuery.trim() !== '' || woStatusFilter !== 'all' || woSortBy !== 'number_asc';

  const handleResetWoFilters = () => {
    setWoSearchQuery('');
    setWoStatusFilter('all');
    setWoSortBy('number_asc');
    setWoCurrentPage(1);
  };

  useEffect(() => {
    setWoCurrentPage(1);
  }, [woSearchQuery, woStatusFilter, woSortBy]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders
      .filter((wo) => {
        if (woSearchQuery.trim()) {
          const q = woSearchQuery.toLowerCase();
          const matchNumber = wo.workOrderNumber?.toLowerCase().includes(q);
          const matchPlate = wo.vehiclePlate?.toLowerCase().includes(q);
          const matchDesc = wo.description?.toLowerCase().includes(q);
          if (!matchNumber && !matchPlate && !matchDesc) return false;
        }
        if (woStatusFilter !== 'all') {
          const isLocked = wo.procurementFulfillmentStatus === 'pending_pr_approval';
          if (woStatusFilter === 'locked' && !isLocked) return false;
          if (woStatusFilter === 'unlocked' && isLocked) return false;
          if (
            woStatusFilter === 'in_maintenance' &&
            wo.procurementFulfillmentStatus !== 'in_maintenance'
          )
            return false;
          if (
            woStatusFilter === 'completed' &&
            wo.procurementFulfillmentStatus !== 'work_completed' &&
            wo.procurementFulfillmentStatus !== 'vehicle_operational'
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (woSortBy === 'plate_asc')
          return (a.vehiclePlate || '').localeCompare(b.vehiclePlate || '');
        return a.workOrderNumber.localeCompare(b.workOrderNumber);
      });
  }, [workOrders, woSearchQuery, woStatusFilter, woSortBy]);

  const paginatedWorkOrders = useMemo(() => {
    const startIndex = (woCurrentPage - 1) * woPageSize;
    return filteredWorkOrders.slice(startIndex, startIndex + woPageSize);
  }, [filteredWorkOrders, woCurrentPage, woPageSize]);

  const handleCreatePrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrPurpose) return;
    onCreatePr(newPrDept, newPrPurpose, newPrAmount);
    setNewPrPurpose('');
    setShowCreatePr(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Overview Banner */}
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-start justify-between shadow-sm">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="h-6 w-6 text-primary mt-0.5" />
          <div>
            <div className="font-semibold text-foreground text-sm">
              Module C: Approved PR Gatekeeper & Procurement Engine
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strict Gate: Work orders remain locked in &quot;Pending PR Approval&quot; until
              Finance formally authorizes the Purchase Requisition. Once unlocked, Procurement
              coordinates fulfillment and releases the vehicle.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreatePr(!showCreatePr)}>
          <Plus className="h-4 w-4 mr-1" /> Draft PR
        </Button>
      </div>

      {/* Draft PR Form */}
      {showCreatePr && (
        <Card className="border-primary/40 bg-primary/5 animate-fade-in shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Draft New Purchase Requisition</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreatePrSubmit}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
            >
              <Input
                placeholder="Department"
                value={newPrDept}
                onChange={(e) => setNewPrDept(e.target.value)}
                className="bg-background"
              />
              <Input
                placeholder="Purpose (e.g. Brake replacement)"
                value={newPrPurpose}
                onChange={(e) => setNewPrPurpose(e.target.value)}
                className="bg-background"
              />
              <Input
                type="number"
                placeholder="Amount (PHP)"
                value={newPrAmount}
                onChange={(e) => setNewPrAmount(parseInt(e.target.value, 10) || 0)}
                className="bg-background font-mono"
              />
              <Button type="submit" size="sm">
                Submit for Finance Review
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Section 1: Purchase Requisitions ────────────────────────────── */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>1. Purchase Requisitions (Finance Spend Queue)</CardTitle>
              <CardDescription>Mandatory financial spend authorization gate</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {prs.length} Requisitions
              </Badge>
              {prs.filter((p) => p.status === 'pending').length > 0 && (
                <Badge variant="warning" className="text-xs">
                  {prs.filter((p) => p.status === 'pending').length} Pending Approval
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {/* PR Toolbar: Search, Filter, Sort */}
        <div className="p-4 bg-muted/20 border-b border-border/40 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PR #, purpose, department, or approver..."
                value={prSearchQuery}
                onChange={(e) => setPrSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-background"
              />
              {prSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPrSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={prStatusFilter}
                onChange={(e) => setPrStatusFilter(e.target.value)}
                aria-label="Filter by PR status"
                className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
              >
                <option value="all">All PR States</option>
                <option value="pending">Pending Finance</option>
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={prDeptFilter}
                onChange={(e) => setPrDeptFilter(e.target.value)}
                aria-label="Filter by department"
                className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
              >
                <option value="all">All Departments</option>
                {prDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={prSortBy}
                onChange={(e) =>
                  setPrSortBy(e.target.value as 'newest' | 'amount_desc' | 'amount_asc' | 'dept')
                }
                aria-label="Sort purchase requisitions"
                className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
              >
                <option value="newest">Sort: Default</option>
                <option value="amount_desc">Amount (High to Low)</option>
                <option value="amount_asc">Amount (Low to High)</option>
                <option value="dept">Department (A → Z)</option>
              </select>

              {hasPrActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetPrFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground px-2.5"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              Showing <strong className="text-foreground">{filteredPrs.length}</strong> of{' '}
              <strong className="text-foreground">{prs.length}</strong> requisitions
              {hasPrActiveFilters && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  Filtered
                </span>
              )}
            </span>
          </div>
        </div>

        <CardContent className="pt-4">
          {prs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
              <div className="rounded-2xl bg-primary/10 p-3 mb-2 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">No Purchase Requisitions</h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                No active or pending purchase requisitions found. Click &quot;Draft PR&quot; above
                to request procurement authorization.
              </p>
            </div>
          ) : filteredPrs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
              <div className="rounded-2xl bg-muted/30 p-3 mb-2 text-muted-foreground">
                <Filter className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                No Matching Purchase Requisitions
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                No purchase requisitions matched your search query or status filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPrFilters}
                className="mt-3 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th
                        scope="col"
                        className="py-2.5 px-4 font-semibold text-muted-foreground uppercase"
                      >
                        Requisition ID
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 px-4 font-semibold text-muted-foreground uppercase"
                      >
                        Unit / Dept
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 px-4 font-semibold text-muted-foreground uppercase"
                      >
                        Expenditure Purpose
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 px-4 font-semibold text-muted-foreground uppercase"
                      >
                        Est. Cost
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 px-4 font-semibold text-muted-foreground uppercase"
                      >
                        PR State
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 px-4 text-right font-semibold text-muted-foreground uppercase"
                      >
                        Decision
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedPrs.map((pr) => (
                      <tr key={pr.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {pr.prNumber}
                        </td>
                        <td className="py-3 px-4 text-foreground/80">{pr.department}</td>
                        <td className="py-3 px-4 text-foreground">{pr.purpose}</td>
                        <td className="py-3 px-4 font-mono font-medium">
                          ₱{pr.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {pr.status === 'approved' ? (
                            <Badge variant="success">Approved</Badge>
                          ) : pr.status === 'rejected' ? (
                            <Badge variant="destructive">Rejected</Badge>
                          ) : (
                            <Badge variant="warning">Pending Finance</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {pr.status !== 'approved' && (
                            <Button size="sm" variant="success" onClick={() => onApprovePr(pr.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Spend
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedPrs.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-sm text-foreground">
                          {pr.prNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">{pr.department}</div>
                      </div>
                      <div>
                        {pr.status === 'approved' ? (
                          <Badge variant="success">Approved</Badge>
                        ) : pr.status === 'rejected' ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : (
                          <Badge variant="warning">Pending Finance</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-foreground/90 bg-muted/20 p-2 rounded-lg">
                      {pr.purpose}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="font-mono font-bold text-sm text-foreground">
                        ₱{pr.amount.toLocaleString()}
                      </div>
                      {pr.status !== 'approved' && (
                        <Button size="sm" variant="success" onClick={() => onApprovePr(pr.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* PR Pagination Controls */}
              {filteredPrs.length > 0 && (
                <div className="pt-3 border-t border-border/40 mt-3">
                  <Pagination
                    currentPage={prCurrentPage}
                    totalItems={filteredPrs.length}
                    itemsPerPage={prPageSize}
                    onPageChange={setPrCurrentPage}
                    onItemsPerPageChange={(newSize) => {
                      setPrPageSize(newSize);
                      setPrCurrentPage(1);
                    }}
                    itemsPerPageOptions={[5, 10, 20]}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Work Orders & PR Gatekeeper Unlock ───────────────── */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>2. Maintenance Work Orders & Procurement Hand-off</CardTitle>
              <CardDescription>
                Work orders gated by PR approval before Procurement fulfillment can proceed
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {workOrders.length} Work Orders
              </Badge>
              {workOrders.filter((w) => w.procurementFulfillmentStatus === 'pending_pr_approval')
                .length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {
                    workOrders.filter(
                      (w) => w.procurementFulfillmentStatus === 'pending_pr_approval',
                    ).length
                  }{' '}
                  Locked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Work Order Toolbar */}
        <div className="p-4 bg-muted/20 border-b border-border/40 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search work order #, vehicle plate, or repair description..."
                value={woSearchQuery}
                onChange={(e) => setWoSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-background"
              />
              {woSearchQuery && (
                <button
                  type="button"
                  onClick={() => setWoSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={woStatusFilter}
                onChange={(e) => setWoStatusFilter(e.target.value)}
                aria-label="Filter by work order status"
                className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
              >
                <option value="all">All Gatekeeper States</option>
                <option value="locked">Locked (Needs PR Approval)</option>
                <option value="unlocked">Unlocked (PR Approved)</option>
                <option value="in_maintenance">In Maintenance (In Shop)</option>
                <option value="completed">Work Completed / Operational</option>
              </select>

              <select
                value={woSortBy}
                onChange={(e) => setWoSortBy(e.target.value as 'number_asc' | 'plate_asc')}
                aria-label="Sort work orders"
                className="h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
              >
                <option value="number_asc">Sort: Work Order #</option>
                <option value="plate_asc">Sort: Vehicle Plate (A → Z)</option>
              </select>

              {hasWoActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetWoFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground px-2.5"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              Showing <strong className="text-foreground">{filteredWorkOrders.length}</strong> of{' '}
              <strong className="text-foreground">{workOrders.length}</strong> work orders
              {hasWoActiveFilters && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  Filtered
                </span>
              )}
            </span>
          </div>
        </div>

        <CardContent className="pt-4">
          {workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
              <div className="rounded-2xl bg-primary/10 p-3 mb-2 text-primary">
                <Wrench className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">No Maintenance Work Orders</h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                No repair work orders currently require PR gating or procurement fulfillment.
              </p>
            </div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl border-dashed border-border/80 bg-muted/10">
              <div className="rounded-2xl bg-muted/30 p-3 mb-2 text-muted-foreground">
                <Filter className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">No Matching Work Orders</h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                No maintenance work orders matched your search query or status filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetWoFilters}
                className="mt-3 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border uppercase text-muted-foreground font-semibold">
                      <th className="py-2.5 px-4">Work Order</th>
                      <th className="py-2.5 px-4">Vehicle</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Linked PR</th>
                      <th className="py-2.5 px-4">Gatekeeper Status</th>
                      <th className="py-2.5 px-4 text-right">Fulfillment Progression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedWorkOrders.map((wo) => {
                      const linkedPr = prs.find((p) => p.id === wo.linkedPrId);
                      const isLocked = wo.procurementFulfillmentStatus === 'pending_pr_approval';

                      return (
                        <tr key={wo.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-foreground">
                            {wo.workOrderNumber}
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            {wo.vehiclePlate || 'Fleet Unit'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{wo.description}</td>
                          <td className="py-3 px-4 font-mono">
                            {linkedPr ? (
                              <span>
                                {linkedPr.prNumber}{' '}
                                {linkedPr.status === 'approved' ? (
                                  <span className="text-emerald-600 font-semibold">(Approved)</span>
                                ) : (
                                  <span className="text-amber-600 font-semibold">(Pending)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isLocked ? (
                              <Badge
                                variant="destructive"
                                className="flex items-center space-x-1 w-max"
                              >
                                <Lock className="h-3 w-3 mr-1" /> Locked
                              </Badge>
                            ) : (
                              <Badge
                                variant="success"
                                className="flex items-center space-x-1 w-max"
                              >
                                <Unlock className="h-3 w-3 mr-1" /> Unlocked
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isLocked ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (linkedPr) onUnlockWorkOrder(wo.id, linkedPr.id);
                                }}
                                disabled={!linkedPr || linkedPr.status !== 'approved'}
                              >
                                <Unlock className="h-3.5 w-3.5 mr-1" /> Assert PR Gate
                              </Button>
                            ) : (
                              <div className="flex items-center justify-end space-x-2">
                                {wo.procurementFulfillmentStatus === 'pr_approved' && (
                                  <Button
                                    size="sm"
                                    variant="warning"
                                    onClick={() => onUpdateFulfillment(wo.id, 'in_maintenance')}
                                  >
                                    Send to Shop <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                )}
                                {wo.procurementFulfillmentStatus === 'in_maintenance' && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => onUpdateFulfillment(wo.id, 'work_completed')}
                                  >
                                    Mark Completed
                                  </Button>
                                )}
                                {wo.procurementFulfillmentStatus === 'work_completed' && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() =>
                                      onUpdateFulfillment(wo.id, 'vehicle_operational')
                                    }
                                  >
                                    <Truck className="h-3.5 w-3.5 mr-1" /> Release to Fleet
                                  </Button>
                                )}
                                {wo.procurementFulfillmentStatus === 'vehicle_operational' && (
                                  <Badge
                                    variant="outline"
                                    className="text-emerald-600 border-emerald-500/40"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Operational
                                  </Badge>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedWorkOrders.map((wo) => {
                  const linkedPr = prs.find((p) => p.id === wo.linkedPrId);
                  const isLocked = wo.procurementFulfillmentStatus === 'pending_pr_approval';

                  return (
                    <div
                      key={wo.id}
                      className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono font-bold text-sm text-foreground">
                            {wo.workOrderNumber}
                          </div>
                          <div className="text-xs text-muted-foreground font-semibold">
                            {wo.vehiclePlate || 'Fleet Unit'}
                          </div>
                        </div>
                        <div>
                          {isLocked ? (
                            <Badge variant="destructive" className="flex items-center space-x-1">
                              <Lock className="h-3 w-3 mr-1" /> Locked
                            </Badge>
                          ) : (
                            <Badge variant="success" className="flex items-center space-x-1">
                              <Unlock className="h-3 w-3 mr-1" /> Unlocked
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-foreground/90 bg-muted/20 p-2 rounded-lg">
                        {wo.description}
                      </div>

                      <div className="text-xs py-1 border-y border-border/50 flex justify-between items-center">
                        <span className="text-muted-foreground">Linked PR:</span>
                        <span className="font-mono font-medium">
                          {linkedPr ? (
                            <span>
                              {linkedPr.prNumber}{' '}
                              {linkedPr.status === 'approved' ? (
                                <span className="text-emerald-600 font-semibold">(Approved)</span>
                              ) : (
                                <span className="text-amber-600 font-semibold">(Pending)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">None</span>
                          )}
                        </span>
                      </div>

                      <div className="pt-1 flex justify-end">
                        {isLocked ? (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              if (linkedPr) onUnlockWorkOrder(wo.id, linkedPr.id);
                            }}
                            disabled={!linkedPr || linkedPr.status !== 'approved'}
                          >
                            <Unlock className="h-3.5 w-3.5 mr-1" /> Assert PR Gate
                          </Button>
                        ) : (
                          <div className="w-full">
                            {wo.procurementFulfillmentStatus === 'pr_approved' && (
                              <Button
                                size="sm"
                                variant="warning"
                                className="w-full"
                                onClick={() => onUpdateFulfillment(wo.id, 'in_maintenance')}
                              >
                                Send to Shop <ArrowRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            )}
                            {wo.procurementFulfillmentStatus === 'in_maintenance' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full"
                                onClick={() => onUpdateFulfillment(wo.id, 'work_completed')}
                              >
                                Mark Completed
                              </Button>
                            )}
                            {wo.procurementFulfillmentStatus === 'work_completed' && (
                              <Button
                                size="sm"
                                variant="success"
                                className="w-full"
                                onClick={() => onUpdateFulfillment(wo.id, 'vehicle_operational')}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1" /> Release to Fleet
                              </Button>
                            )}
                            {wo.procurementFulfillmentStatus === 'vehicle_operational' && (
                              <div className="text-xs text-emerald-600 font-bold flex items-center justify-center p-1 bg-emerald-500/10 rounded-lg">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Operational in Fleet
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Work Orders Pagination Controls */}
              {filteredWorkOrders.length > 0 && (
                <div className="pt-3 border-t border-border/40 mt-3">
                  <Pagination
                    currentPage={woCurrentPage}
                    totalItems={filteredWorkOrders.length}
                    itemsPerPage={woPageSize}
                    onPageChange={setWoCurrentPage}
                    onItemsPerPageChange={(newSize) => {
                      setWoPageSize(newSize);
                      setWoCurrentPage(1);
                    }}
                    itemsPerPageOptions={[5, 10, 20]}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
