import { useCallback, useEffect, useState } from 'react';
import { History, Plus, Printer, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatPrintableFieldValue } from './FormPrintView';
import type { FormDefinition, FormField, FormValues } from './types';

interface SubmissionRow {
  id: string;
  submissionNumber: string;
  status: string;
  stage: string;
  isLate: boolean;
  createdAt: string;
  currentAssignee: { name: string; role: string } | null;
  currentResponsibleRoles: string[];
  data: Record<string, unknown>;
}

interface SubmissionEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  action: string;
  actorName: string;
  actorRole: string;
  comment: string | null;
  createdAt: string;
}

interface SubmissionDetail extends SubmissionRow {
  formSchema: FormDefinition;
  data: FormValues;
  labelSnapshots: Record<string, { code: string; label: string }>;
}

export interface SubmissionPrintRequest {
  definition: FormDefinition;
  values: FormValues;
  submissionNumber: string;
  labelSnapshots: Record<string, { code: string; label: string }>;
  status: string;
  stage: string;
  isLate: boolean;
  createdAt: string;
  currentAssignee: { name: string; role: string } | null;
  currentResponsibleRoles: string[];
}

interface TSRFSubmissionTrackerProps {
  refreshToken: number;
  focusSubmissionId: string | null;
  onPrint: (request: SubmissionPrintRequest) => void;
  onNewRequest: () => void;
}

function displayStatus(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayResponsibility(submission: SubmissionRow): string {
  if (submission.currentAssignee)
    return `${submission.currentAssignee.name} · ${displayStatus(submission.currentAssignee.role)}`;
  if (submission.currentResponsibleRoles.length)
    return `${submission.currentResponsibleRoles.map(displayStatus).join(', ')} queue`;
  return 'No active assignee';
}

function isFormValues(value: unknown): value is FormValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function SubmissionField({
  field,
  values,
  path,
  labelSnapshots,
}: {
  field: FormField;
  values: FormValues;
  path: string;
  labelSnapshots: SubmissionDetail['labelSnapshots'];
}) {
  if (field.type === 'notice') return null;
  const value = values[field.key];
  if (field.type === 'repeater') {
    const rows = Array.isArray(value) ? value.filter(isFormValues) : [];
    const rowFields = field.rowFields ?? [];
    return (
      <section className="space-y-2 py-2" key={path}>
        <h5 className="text-sm font-medium">{field.label}</h5>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  {rowFields.map((rowField) => (
                    <th key={rowField.key} className="px-2 py-1 font-medium">
                      {rowField.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border">
                    {rowFields.map((rowField) => (
                      <td key={rowField.key} className="px-2 py-2 align-top">
                        {rowField.type === 'repeater' ? (
                          <SubmissionField
                            field={rowField}
                            values={row}
                            path={`${path}[${rowIndex}].${rowField.key}`}
                            labelSnapshots={labelSnapshots}
                          />
                        ) : (
                          formatPrintableFieldValue(
                            rowField,
                            row[rowField.key],
                            `${path}[${rowIndex}].${rowField.key}`,
                            labelSnapshots,
                          ).trim() || '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No entries</p>
        )}
      </section>
    );
  }
  return (
    <div className="grid gap-1 border-b border-border py-2" key={path}>
      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
      <p className="text-sm">
        {formatPrintableFieldValue(field, value, path, labelSnapshots).trim() || '—'}
      </p>
    </div>
  );
}

export function TSRFSubmissionTracker({
  refreshToken,
  focusSubmissionId,
  onPrint,
  onNewRequest,
}: TSRFSubmissionTrackerProps) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const openHistory = useCallback(async (submission: SubmissionRow) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const [detailResponse, eventsResponse] = await Promise.all([
        apiFetch(`/api/forms/submissions/${encodeURIComponent(submission.id)}`),
        apiFetch(`/api/forms/submissions/${encodeURIComponent(submission.id)}/events`),
      ]);
      if (!detailResponse.ok || !eventsResponse.ok)
        throw new Error('Unable to load request details and history.');
      const detail = (await detailResponse.json()) as SubmissionDetail;
      const history = (await eventsResponse.json()) as SubmissionEvent[];
      setSelected(detail);
      setEvents(history);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load request history.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiFetch('/api/forms/tsrf/submissions/report?limit=50')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load TSRF requests.');
        return (await response.json()) as SubmissionRow[];
      })
      .then((rows) => {
        if (cancelled) return;
        setSubmissions(rows);
        const focused = focusSubmissionId
          ? rows.find((row) => row.id === focusSubmissionId)
          : undefined;
        if (focused) void openHistory(focused);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Unable to load TSRF requests.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focusSubmissionId, openHistory, refreshToken, reloadToken]);

  return (
    <section
      className="space-y-4 border-t border-border pt-6"
      aria-labelledby="tsrf-requests-title"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tsrf-requests-title" className="text-lg font-semibold">
            TSRF Requests
          </h2>
          <p className="text-sm text-muted-foreground">
            Review current status, activity history, and print a submitted request.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" className="gap-2" onClick={onNewRequest}>
            <Plus className="h-4 w-4" />
            New Request
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={loading}
            onClick={() => setReloadToken((current) => current + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading requests…
        </p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests found.</p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">TSRF No.</th>
                <th className="px-3 py-2 font-medium">Submitted</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Current responsibility</th>
                <th className="px-3 py-2 font-medium">Intake</th>
                <th className="px-3 py-2 text-right font-medium">History</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr
                  key={submission.id}
                  className={`border-t border-border ${selected?.id === submission.id ? 'bg-muted/40' : ''}`}
                >
                  <td className="px-3 py-3 font-medium">{submission.submissionNumber}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {new Date(submission.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">{displayStatus(submission.stage)}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">{displayStatus(submission.status)}</Badge>
                  </td>
                  <td className="px-3 py-3">{displayResponsibility(submission)}</td>
                  <td className="px-3 py-3">
                    {submission.isLate ? (
                      <Badge variant="destructive">Late</Badge>
                    ) : (
                      <span className="text-muted-foreground">On time</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      disabled={loadingHistory}
                      onClick={() => void openHistory(submission)}
                    >
                      <History className="h-4 w-4" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className="space-y-3" aria-label={`History for ${selected.submissionNumber}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">History: {selected.submissionNumber}</h3>
              <p className="text-sm text-muted-foreground">
                {displayStatus(selected.status)} · {displayStatus(selected.stage)}
              </p>
              <p className="text-sm text-muted-foreground">
                Current responsibility: {displayResponsibility(selected)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2 print:hidden"
              onClick={() =>
                onPrint({
                  definition: selected.formSchema,
                  values: selected.data,
                  submissionNumber: selected.submissionNumber,
                  labelSnapshots: selected.labelSnapshots,
                  status: selected.status,
                  stage: selected.stage,
                  isLate: selected.isLate,
                  createdAt: selected.createdAt,
                  currentAssignee: selected.currentAssignee,
                  currentResponsibleRoles: selected.currentResponsibleRoles,
                })
              }
            >
              <Printer className="h-4 w-4" />
              Prepare print request
            </Button>
          </div>
          <div className="space-y-5 divide-y divide-border border-y border-border py-2">
            {selected.formSchema.sections.map((section) => (
              <section key={section.id} className="space-y-1 py-3">
                <div>
                  <h4 className="font-medium">{section.title}</h4>
                  {section.description && (
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  )}
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <SubmissionField
                      key={field.id}
                      field={field}
                      values={selected.data}
                      path={field.key}
                      labelSnapshots={selected.labelSnapshots}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <ol className="divide-y divide-border border-y border-border">
              {events.map((event) => (
                <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-medium">{displayStatus(event.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorName} · {displayStatus(event.actorRole)}
                      {event.fromStage ? ` · ${displayStatus(event.fromStage)} -> ` : ' · '}
                      {displayStatus(event.toStage)}
                    </p>
                    {event.comment && <p className="mt-1 text-sm">{event.comment}</p>}
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}
