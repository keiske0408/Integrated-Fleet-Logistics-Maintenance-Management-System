import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, Unlock, CheckCircle2, Plus, ShieldCheck, ArrowRight, Truck } from 'lucide-react';

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
              Strict Gate: Work orders remain locked in &quot;Pending PR Approval&quot; until Finance formally authorizes
              the Purchase Requisition. Once unlocked, Procurement coordinates fulfillment and releases the vehicle.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreatePr(!showCreatePr)}
        >
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
            <form onSubmit={handleCreatePrSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
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

      {/* Section 1: Purchase Requisitions */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>1. Purchase Requisitions (Finance Spend Queue)</CardTitle>
              <CardDescription>Mandatory financial spend authorization gate</CardDescription>
            </div>
            <Badge variant="outline">{prs.length} Requisitions</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="py-2.5 px-4 font-semibold text-muted-foreground uppercase">Requisition ID</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold text-muted-foreground uppercase">Unit / Dept</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold text-muted-foreground uppercase">Expenditure Purpose</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold text-muted-foreground uppercase">Est. Cost</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold text-muted-foreground uppercase">PR State</th>
                  <th scope="col" className="py-2.5 px-4 text-right font-semibold text-muted-foreground uppercase">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {prs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">{pr.prNumber}</td>
                    <td className="py-3 px-4 text-foreground/80">{pr.department}</td>
                    <td className="py-3 px-4 text-foreground">{pr.purpose}</td>
                    <td className="py-3 px-4 font-mono font-medium">₱{pr.amount.toLocaleString()}</td>
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
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => onApprovePr(pr.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Spend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Work Orders & PR Gatekeeper Unlock */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>2. Maintenance Work Orders & Procurement Hand-off</CardTitle>
              <CardDescription>
                Work orders gated by PR approval before Procurement fulfillment can proceed
              </CardDescription>
            </div>
            <Badge variant="outline">{workOrders.length} Work Orders</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
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
                {workOrders.map((wo) => {
                  const linkedPr = prs.find((p) => p.id === wo.linkedPrId);
                  const isLocked = wo.procurementFulfillmentStatus === 'pending_pr_approval';

                  return (
                    <tr key={wo.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">{wo.workOrderNumber}</td>
                      <td className="py-3 px-4 font-bold text-foreground">{wo.vehiclePlate || 'Fleet Unit'}</td>
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
                          <Badge variant="destructive" className="flex items-center space-x-1 w-max">
                            <Lock className="h-3 w-3 mr-1" /> Locked
                          </Badge>
                        ) : (
                          <Badge variant="success" className="flex items-center space-x-1 w-max">
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
                          <div className="inline-flex space-x-1.5">
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
                                onClick={() => onUpdateFulfillment(wo.id, 'vehicle_operational')}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1" /> Release to Fleet
                              </Button>
                            )}
                            {wo.procurementFulfillmentStatus === 'vehicle_operational' && (
                              <span className="text-xs text-emerald-600 font-bold flex items-center justify-end">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Operational
                              </span>
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
        </CardContent>
      </Card>
    </div>
  );
}
