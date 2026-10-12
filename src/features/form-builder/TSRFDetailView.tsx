import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Pencil,
  Printer,
  RefreshCw,
  User,
  AlertTriangle,
  Layers,
  X,
  ArrowRight,
  MessageSquare,
  RotateCcw,
  XCircle,
  Truck,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { FormRenderer } from './FormRenderer';
import { FormPrintView, formatPrintableFieldValue } from './FormPrintView';
import type { FormField, FormValues } from './types';
import type {
  SubmissionDetail,
  SubmissionEvent,
  SubmissionRow,
  SubmissionTransition,
} from './TSRFSubmissionTracker';

export function WorkflowActions({
  transitions,
  onTransition,
}: {
  transitions: SubmissionTransition[];
  onTransition: (transition: SubmissionTransition, comment: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<SubmissionTransition | null>(null);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (transitions.length === 0) return null;

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || pending || (selected.reasonRequired && !comment.trim())) return;
    setPending(true);
    setActionError(null);
    try {
      await onTransition(selected, comment.trim());
      setSelected(null);
      setComment('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update the request.');
    } finally {
      setPending(false);
    }
  };

  const getTransitionStyle = (cat: string) => {
    const s = cat.toLowerCase();
    if (s === 'approved' || s === 'completed') {
      return {
        variant: 'default' as const,
        className:
          'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border-emerald-600 hover:border-emerald-700 font-semibold',
        icon: CheckCircle2,
        pillColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        modalIconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        confirmBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        presets: [
          'Approved as requested',
          'Route, schedule, and passenger manifest verified',
          'Fleet unit and driver allocation authorized',
        ],
      };
    }
    if (s === 'returned') {
      return {
        variant: 'outline' as const,
        className:
          'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 shadow-xs font-semibold',
        icon: RotateCcw,
        pillColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        modalIconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        confirmBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        presets: [
          'Please complete and clarify the passenger list',
          'Please provide specific destination route and intermediate stops',
          'Departure time conflict - please revise call time',
        ],
      };
    }
    if (s === 'rejected' || s === 'cancelled') {
      return {
        variant: 'outline' as const,
        className:
          'border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 shadow-xs font-semibold',
        icon: XCircle,
        pillColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        modalIconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        confirmBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
        presets: [
          'No available fleet vehicles for requested timeslot',
          'Request falls outside standard operating logistics policy',
          'Insufficient lead time for vehicle preparation',
        ],
      };
    }
    if (s === 'in_progress' || s === 'dispatched') {
      return {
        variant: 'default' as const,
        className:
          'bg-blue-600 hover:bg-blue-700 text-white shadow-xs border-blue-600 hover:border-blue-700 font-semibold',
        icon: Truck,
        pillColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        modalIconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        confirmBtnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        presets: [
          'Vehicle dispatched and en route to pickup location',
          'Trip initiated as scheduled',
        ],
      };
    }
    return {
      variant: 'default' as const,
      className: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold',
      icon: ArrowRight,
      pillColor: 'bg-primary/10 text-primary border-primary/20',
      modalIconBg: 'bg-primary/10 text-primary',
      confirmBtnClass: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      presets: ['Endorsed and moving to next stage', 'Requirements verified, forwarding request'],
    };
  };

  const activeStyle = selected ? getTransitionStyle(selected.statusCategory) : null;
  const ActiveIcon = activeStyle?.icon || ArrowRight;

  return (
    <section className="border-t border-border/50 pt-3.5 space-y-3" aria-label="Workflow actions">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Actions
        </h4>
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
          {transitions.length} Available
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {transitions.map((transition) => {
          const style = getTransitionStyle(transition.statusCategory);
          const Icon = style.icon;
          return (
            <Button
              key={transition.toStage}
              type="button"
              variant={style.variant}
              size="sm"
              disabled={pending}
              className={`gap-1.5 text-xs whitespace-normal h-auto min-h-8 px-3 py-1.5 transition-all ${style.className}`}
              onClick={() => {
                setSelected(transition);
                setComment('');
                setActionError(null);
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {transition.reasonRequired && (
                <span className="rounded bg-black/15 dark:bg-white/15 px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wider">
                  Req
                </span>
              )}
              {transition.label}
            </Button>
          );
        })}
      </div>

      {selected && (
        <Dialog open={true} onOpenChange={(open) => !open && !pending && setSelected(null)}>
          <form onSubmit={(event) => void submitAction(event)} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl shrink-0 ${activeStyle?.modalIconBg}`}>
                  <ActiveIcon className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>Confirm: {selected.label}</DialogTitle>
                  <DialogDescription>
                    Execute workflow transition and update dispatch queue.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Stage Progression</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Active</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge
                  variant="outline"
                  className={`font-semibold capitalize ${activeStyle?.pillColor}`}
                >
                  {selected.label}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="workflow-decision-comment"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {selected.reasonRequired
                      ? 'Reason / Explanation (Required)'
                      : 'Comments / Remarks (Optional)'}
                  </span>
                </label>
                {selected.reasonRequired ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  >
                    Mandatory
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Optional</span>
                )}
              </div>

              {activeStyle?.presets && activeStyle.presets.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Quick Templates:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeStyle.presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setComment(preset)}
                        className="text-[11px] rounded-lg border border-border/70 bg-background/80 hover:bg-muted hover:border-primary/50 px-2.5 py-1 text-muted-foreground hover:text-foreground text-left transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                id="workflow-decision-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                required={selected.reasonRequired}
                disabled={pending}
                rows={3}
                placeholder={
                  selected.reasonRequired
                    ? 'Provide specific justification for this action…'
                    : 'Add optional notes for the audit trail…'
                }
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs sm:text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all resize-y min-h-[80px]"
              />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Recorded in permanent audit log
                </span>
                <span>{comment.length} characters</span>
              </div>
            </div>

            {actionError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setSelected(null)}
                className="gap-1.5 text-xs"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={pending || (selected.reasonRequired && !comment.trim())}
                className={`gap-1.5 text-xs font-semibold shadow-xs ${activeStyle?.confirmBtnClass}`}
              >
                {pending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm {selected.label}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </section>
  );
}

function displayStatus(value: string): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusBadgeStyle(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('approved') || s.includes('completed') || s.includes('fulfilled')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
  }
  if (s.includes('dispatched') || s.includes('in_transit') || s.includes('active')) {
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25';
  }
  if (
    s.includes('review') ||
    s.includes('pending') ||
    s.includes('submitted') ||
    s.includes('endorsement')
  ) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25';
  }
  if (s.includes('reject') || s.includes('cancelled') || s.includes('declined')) {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function displayResponsibility(submission: SubmissionRow): string {
  if (submission.currentAssignee)
    return `${submission.currentAssignee.name} (${displayStatus(submission.currentAssignee.role)})`;
  if (submission.currentResponsibleRoles?.length)
    return `${submission.currentResponsibleRoles.map(displayStatus).join(', ')} queue`;
  return 'Unassigned';
}

function isFormValues(value: unknown): value is FormValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMeaningfulValue(field: FormField, value: unknown): boolean {
  if (field.type === 'notice') return false;
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (!isFormValues(body)) return fallback;
  if (typeof body.error === 'string') return body.error;
  if (Array.isArray(body.details)) {
    const details = body.details.reduce<string[]>((messages, item) => {
      if (typeof item === 'string') messages.push(item);
      return messages;
    }, []);
    if (details.length > 0) return details.join(' ');
  }
  return fallback;
}

export function TSRFDetailView({ id: propId }: { id?: string }) {
  const params = useParams<{ id: string; formKey?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const submissionId = propId || params.id;
  const requestedEdit = searchParams.get('edit') === 'true';
  const formKey = params.formKey ?? 'tsrf';
  const registerPath =
    formKey === 'tsrf' ? '/tsrf' : `/forms/${encodeURIComponent(formKey)}/submissions`;
  const backParams = new URLSearchParams(searchParams);
  backParams.delete('edit');
  const backUrl = `${registerPath}?${backParams}`;

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const loadData = async () => {
    if (!submissionId) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, eventsRes] = await Promise.all([
        apiFetch(
          `/api/forms/submissions/${encodeURIComponent(submissionId)}?formKey=${encodeURIComponent(formKey)}`,
        ),
        apiFetch(`/api/forms/submissions/${encodeURIComponent(submissionId)}/events`),
      ]);

      if (!detailRes.ok) throw new Error('Unable to find TSRF request details.');
      const detailJson = (await detailRes.json()) as SubmissionDetail;
      const eventsJson = eventsRes.ok ? ((await eventsRes.json()) as SubmissionEvent[]) : [];

      setDetail(detailJson);
      setEvents(eventsJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TSRF submission.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [submissionId, formKey, currentUser?.id]);

  const canEditReturned = Boolean(
    detail &&
    detail.status === 'returned' &&
    detail.createdById === currentUser?.id &&
    detail.resubmitStage,
  );

  useEffect(() => {
    if (requestedEdit && canEditReturned) setEditing(true);
  }, [requestedEdit, canEditReturned]);

  const resubmitReturnedRequest = async (changes: FormValues) => {
    if (!detail?.resubmitStage) throw new Error('This request cannot be resubmitted.');
    if (Object.keys(changes).length > 0) {
      const editResponse = await apiFetch(
        `/api/forms/submissions/${encodeURIComponent(detail.id)}/data`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: changes }),
        },
      );
      if (!editResponse.ok)
        throw new Error(await apiErrorMessage(editResponse, 'Unable to save request changes.'));
    }

    const transitionResponse = await apiFetch(
      `/api/forms/submissions/${encodeURIComponent(detail.id)}/transition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: detail.resubmitStage }),
      },
    );
    if (!transitionResponse.ok) {
      const message = await apiErrorMessage(transitionResponse, 'Unable to resubmit the request.');
      throw new Error(`Changes were saved, but resubmission failed: ${message}`);
    }

    setEditing(false);
    navigate(`${registerPath}/${detail.id}?${backParams}`, { replace: true });
    await loadData();
  };

  const transitionRequest = async (transition: SubmissionTransition, comment: string) => {
    if (!detail) return;
    const response = await apiFetch(
      `/api/forms/submissions/${encodeURIComponent(detail.id)}/transition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: transition.toStage, comment }),
      },
    );
    if (!response.ok)
      throw new Error(await apiErrorMessage(response, 'Unable to update the request.'));
    await loadData();
  };

  // Filter out unwanted sections (like intake-notice / TSRF Intake) and sections with no filled data
  const filteredSections = useMemo(() => {
    if (!detail?.formSchema?.sections) return [];

    return detail.formSchema.sections
      .filter((sec) => {
        // Skip intake notice and static headers that have no operational values
        if (sec.id === 'intake-notice') return false;
        const titleLower = (sec.title || '').toLowerCase();
        if (titleLower === 'tsrf intake' || titleLower === 'intake notice') return false;

        // Check if section contains at least one field with a meaningful filled value
        const hasValidFields = sec.fields.some((field) =>
          hasMeaningfulValue(field, detail.data[field.key]),
        );
        return hasValidFields;
      })
      .map((sec) => ({
        ...sec,
        fields: sec.fields.filter((field) => hasMeaningfulValue(field, detail.data[field.key])),
      }));
  }, [detail]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(backUrl)}
            className="gap-2 text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </Button>
        </div>
        <Card className="p-8 text-center border-border/70">
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Loading TSRF details…</p>
            <p className="text-xs text-muted-foreground">
              Fetching request parameters and workflow events
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(backUrl)}
            className="gap-2 text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </Button>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Error Loading Request</h4>
              <p className="text-xs mt-0.5">{error || 'TSRF request not found.'}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-xs"
            onClick={() => void loadData()}
          >
            Retry Loading
          </Button>
        </Card>
      </div>
    );
  }

  const createdDate = new Date(detail.createdAt);

  return (
    <>
      {/* ─── Screen View (Hidden when printing) ─── */}
      <div className="space-y-6 animate-fade-in print:hidden">
        {/* Top Header with Back Button and Print Action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            {/* Prominent Back Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(backUrl)}
              className="gap-1.5 text-xs font-medium shadow-xs shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-muted-foreground/80">TSRF Logistics</span>
                <span>
                  {detail.formName} · v{detail.version} {detail.versionName ?? ''} (
                  {detail.versionStatus})
                </span>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-mono font-medium text-foreground">
                  {detail.submissionNumber}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {detail.submissionNumber}
                </h1>
                <Badge
                  variant="outline"
                  className={`font-medium ${getStatusBadgeStyle(detail.status)}`}
                >
                  {displayStatus(detail.status)}
                </Badge>
                {detail.isLate ? (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" /> Late Intake
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3 w-3" /> On Time SLA
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs shadow-xs"
              onClick={() => void loadData()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>

            {canEditReturned && !editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-xs shadow-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit &amp; Resubmit
              </Button>
            )}

            {/* Print Action: Automatically triggers system printout without leaving the view */}
            <Button
              type="button"
              size="sm"
              className="gap-2 text-xs font-medium shadow-sm"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Print TSRF Document
            </Button>
          </div>
        </div>

        {/* Returned Action Callout Banner */}
        {canEditReturned && !editing && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100 shadow-xs animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Request Returned For Revision
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  Check the audit remarks from your reviewer, update editable fields, and resubmit
                  for approval.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs shrink-0 self-start sm:self-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit &amp; Resubmit Now</span>
            </Button>
          </div>
        )}

        {/* ─── Two-Column Executive Grid ─── */}
        {editing && canEditReturned ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Edit Returned Request</h2>
                <p className="text-xs text-muted-foreground">
                  Update permitted fields, then resubmit this request.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setEditing(false);
                  navigate(`${registerPath}/${detail.id}?${backParams}`, { replace: true });
                }}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
            <FormRenderer
              definition={detail.formSchema}
              initialValues={detail.data}
              fieldAccess={detail.fieldAccess}
              submitChangedFieldsOnly
              submitLabel="Resubmit Request"
              onSubmit={resubmitReturnedRequest}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Meaningful Form Data (8 cols) */}
            <div className="space-y-6 lg:col-span-8">
              {detail.visibility === 'partially_restricted' && (
                <p className="text-sm text-muted-foreground">
                  Some request fields are restricted at this stage.
                </p>
              )}
              {filteredSections.length === 0 ? (
                <Card className="p-6 text-center border-border/70">
                  <p className="text-xs text-muted-foreground">
                    {detail.visibility === 'restricted'
                      ? 'Request details are restricted at this stage.'
                      : 'No request data has been recorded.'}
                  </p>
                </Card>
              ) : (
                filteredSections.map((section) => (
                  <Card key={section.id} className="border-border/70 shadow-xs overflow-hidden">
                    <div className="border-b border-border/50 bg-muted/20 px-5 py-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {section.title}
                      </h3>
                      {section.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        {section.fields.map((field) => {
                          const value = detail.data[field.key];

                          if (field.type === 'repeater') {
                            const rows = Array.isArray(value) ? value.filter(isFormValues) : [];
                            const rowFields = field.rowFields ?? [];

                            return (
                              <div
                                key={field.id}
                                className="col-span-full space-y-2 rounded-lg border border-border/70 bg-card p-3.5"
                              >
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {field.label}
                                  </h4>
                                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                    {rows.length} {rows.length === 1 ? 'Entry' : 'Entries'}
                                  </span>
                                </div>

                                {rows.length > 0 ? (
                                  <div className="overflow-x-auto rounded-md border border-border/50">
                                    <table className="w-full min-w-[420px] text-left text-xs">
                                      <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                          {rowFields.map((rf) => (
                                            <th key={rf.key} className="px-3 py-2 font-medium">
                                              {rf.label}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50 bg-background/50">
                                        {rows.map((row, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-muted/30">
                                            {rowFields.map((rf) => (
                                              <td
                                                key={rf.key}
                                                className="px-3 py-2 align-top font-medium"
                                              >
                                                {formatPrintableFieldValue(
                                                  rf,
                                                  row[rf.key],
                                                  `${field.key}[${rIdx}].${rf.key}`,
                                                  detail.labelSnapshots,
                                                ).trim() || '—'}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs italic text-muted-foreground">
                                    No entries recorded
                                  </p>
                                )}
                              </div>
                            );
                          }

                          const formatted = formatPrintableFieldValue(
                            field,
                            value,
                            field.key,
                            detail.labelSnapshots,
                          ).trim();

                          return (
                            <div
                              key={field.id}
                              className="rounded-lg border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/30"
                            >
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                {field.label}
                              </p>
                              <p className="mt-1 text-sm font-medium text-foreground break-words">
                                {formatted || '—'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Right Column: Workflow Pipeline & Audit Trail (4 cols) */}
            <div className="space-y-6 lg:col-span-4">
              {/* Workflow Status Overview */}
              <Card className="border-border/70 shadow-xs">
                <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Dispatch Status
                  </h3>
                </div>
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium uppercase text-[10px]">
                      Active Stage
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>{displayStatus(detail.stage)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-medium uppercase text-[10px]">
                      Assigned Queue / Officer
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-foreground">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{displayResponsibility(detail)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-medium uppercase text-[10px]">
                      Submission Timestamp
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{createdDate.toLocaleString()}</span>
                    </div>
                  </div>
                  <WorkflowActions
                    transitions={(detail.availableTransitions ?? []).filter(
                      (transition) =>
                        !canEditReturned || transition.toStage !== detail.resubmitStage,
                    )}
                    onTransition={transitionRequest}
                  />
                </CardContent>
              </Card>

              {/* Workflow Event Timeline */}
              <Card className="border-border/70 shadow-xs">
                <div className="border-b border-border/50 bg-muted/20 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Audit Trail ({events.length})
                  </h3>
                </div>
                <CardContent className="p-4">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      No activity history recorded yet.
                    </p>
                  ) : (
                    <div className="relative pl-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-[2px] before:bg-border">
                      <div className="space-y-5">
                        {events.map((event, idx) => {
                          const toStageLower = (event.toStage || '').toLowerCase();
                          const actionLower = (event.action || '').toLowerCase();
                          const isApproved =
                            toStageLower.includes('approv') ||
                            actionLower.includes('approv') ||
                            toStageLower.includes('complet');
                          const isReturned =
                            toStageLower.includes('returned') || actionLower.includes('returned');
                          const isRejected =
                            toStageLower.includes('reject') ||
                            toStageLower.includes('cancel') ||
                            actionLower.includes('reject');

                          return (
                            <div key={event.id || idx} className="relative group">
                              {/* Node circle */}
                              <div
                                className={`absolute -left-5 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background shadow-xs text-white ${
                                  isApproved
                                    ? 'bg-emerald-600'
                                    : isReturned
                                      ? 'bg-amber-600'
                                      : isRejected
                                        ? 'bg-rose-600'
                                        : 'bg-primary'
                                }`}
                              >
                                {isApproved ? (
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                ) : isReturned ? (
                                  <RotateCcw className="h-2.5 w-2.5" />
                                ) : isRejected ? (
                                  <XCircle className="h-2.5 w-2.5" />
                                ) : (
                                  <Clock className="h-2.5 w-2.5" />
                                )}
                              </div>

                              {/* Event content */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-foreground">
                                    {displayStatus(event.action)}
                                  </span>
                                  <time className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                                    {new Date(event.createdAt).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    {new Date(event.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </time>
                                </div>

                                <p className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {event.actorName}
                                  </span>{' '}
                                  ·{' '}
                                  <span className="capitalize">
                                    {displayStatus(event.actorRole)}
                                  </span>
                                </p>

                                {event.fromStage && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                                      {displayStatus(event.fromStage)}
                                    </span>
                                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 font-semibold">
                                      {displayStatus(event.toStage)}
                                    </span>
                                  </div>
                                )}

                                {event.comment && (
                                  <div
                                    className={`mt-2 rounded-xl p-3 text-xs border ${
                                      isReturned
                                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-100'
                                        : isRejected
                                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-950 dark:text-rose-100'
                                          : isApproved
                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-100'
                                            : 'bg-muted/40 border-border/60 text-foreground'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      <MessageSquare className="h-3 w-3 text-primary" />
                                      <span>
                                        {isReturned
                                          ? 'Return Reason'
                                          : isRejected
                                            ? 'Rejection Note'
                                            : isApproved
                                              ? 'Approval Remarks'
                                              : 'Decision Remarks'}
                                      </span>
                                    </div>
                                    <p className="leading-relaxed whitespace-pre-wrap break-words italic">
                                      &ldquo;{event.comment}&rdquo;
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ─── Printable Document (Only appears when print is triggered) ─── */}
      <div className="hidden print:block">
        <FormPrintView
          definition={detail.formSchema}
          values={detail.data}
          submissionNumber={detail.submissionNumber}
          labelSnapshots={detail.labelSnapshots}
          status={detail.status}
          stage={detail.stage}
          isLate={detail.isLate}
          createdAt={detail.createdAt}
          currentAssignee={detail.currentAssignee}
          currentResponsibleRoles={detail.currentResponsibleRoles}
          workflowEvents={events}
        />
      </div>
    </>
  );
}
export default TSRFDetailView;
