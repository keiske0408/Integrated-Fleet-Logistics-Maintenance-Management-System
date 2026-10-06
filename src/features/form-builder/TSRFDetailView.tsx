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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { FormRenderer } from './FormRenderer';
import { FormPrintView, formatPrintableFieldValue } from './FormPrintView';
import type { FormField, FormValues } from './types';
import type { SubmissionDetail, SubmissionEvent, SubmissionRow } from './TSRFSubmissionTracker';

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
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const submissionId = propId || params.id;
  const requestedEdit = searchParams.get('edit') === 'true';

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
        apiFetch(`/api/forms/submissions/${encodeURIComponent(submissionId)}`),
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
  }, [submissionId]);

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
    navigate(`/tsrf/${detail.id}`, { replace: true });
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
            onClick={() => navigate('/tsrf')}
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
            onClick={() => navigate('/tsrf')}
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
              onClick={() => navigate('/tsrf')}
              className="gap-1.5 text-xs font-medium shadow-xs shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-muted-foreground/80">TSRF Logistics</span>
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
                  navigate(`/tsrf/${detail.id}`, { replace: true });
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
              {filteredSections.length === 0 ? (
                <Card className="p-6 text-center border-border/70">
                  <p className="text-xs text-muted-foreground">
                    No specific fields submitted for this request.
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
                        {events.map((event, idx) => (
                          <div key={event.id || idx} className="relative group">
                            {/* Node circle */}
                            <div className="absolute -left-5 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow-xs">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            </div>

                            {/* Event content */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {displayStatus(event.action)}
                                </span>
                                <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {new Date(event.createdAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </time>
                              </div>

                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {event.actorName}
                                </span>{' '}
                                · <span>{displayStatus(event.actorRole)}</span>
                              </p>

                              {event.fromStage && (
                                <p className="text-[10px] text-muted-foreground">
                                  <span>{displayStatus(event.fromStage)}</span> →{' '}
                                  <span className="font-semibold text-primary">
                                    {displayStatus(event.toStage)}
                                  </span>
                                </p>
                              )}

                              {event.comment && (
                                <p className="mt-1 rounded bg-muted/40 p-2 text-xs italic text-foreground border border-border/40">
                                  &quot;{event.comment}&quot;
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
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
        />
      </div>
    </>
  );
}
export default TSRFDetailView;
