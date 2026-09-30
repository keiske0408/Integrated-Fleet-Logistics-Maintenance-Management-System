import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface IncidentReportModalProps {
  open: boolean;
  onClose: () => void;
  vehiclePlate: string;
  vehicleId: string;
  repairWorkOrderId: string;
  onSubmit: (data: {
    vehicleId: string;
    repairWorkOrderId: string;
    reportedBy: string;
    incidentDate: string;
    reason: string;
    damagesDescription: string;
    preventativeAction: string;
  }) => void;
}

export function IncidentReportModal({
  open,
  onClose,
  vehiclePlate,
  vehicleId,
  repairWorkOrderId,
  onSubmit,
}: IncidentReportModalProps) {
  const [reportedBy, setReportedBy] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [damagesDescription, setDamagesDescription] = useState('');
  const [preventativeAction, setPreventativeAction] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedBy || !reason || !damagesDescription) return;

    onSubmit({
      vehicleId,
      repairWorkOrderId,
      reportedBy,
      incidentDate,
      reason,
      damagesDescription,
      preventativeAction,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Mandatory Incident Report Required</DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            Vehicle <strong className="text-foreground">{vehiclePlate}</strong> skipped scheduled PMS or is overdue. Per Fleet Domain
            Rule 3, repair work orders are locked until an official incident report is filed explaining the
            circumstances.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start space-x-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Non-negotiable Audit Rule:</strong> Unauthorized maintenance without prior PMS validation
            or official explanation is prohibited.
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Reported By (Driver / Fleet Officer)
            </label>
            <Input
              required
              placeholder="e.g. Juan Dela Cruz"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Incident / Breakdown Date
            </label>
            <Input
              type="date"
              required
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Reason Scheduled PMS was Skipped / Circumstances
            </label>
            <textarea
              required
              rows={2}
              placeholder="Explain why the 5,000 km PMS milestone was missed prior to this failure..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Observed Damages & Component Failures
            </label>
            <textarea
              required
              rows={2}
              placeholder="Describe physical damage, engine symptoms, worn parts..."
              value={damagesDescription}
              onChange={(e) => setDamagesDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Preventative Action Plan
            </label>
            <Input
              placeholder="How to prevent recurrence (e.g. stricter daily odometry logs)"
              value={preventativeAction}
              onChange={(e) => setPreventativeAction(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
          >
            File Incident Report & Unlock Audit
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
