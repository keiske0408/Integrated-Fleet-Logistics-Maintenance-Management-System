import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { components, paths } from '@/api/generated-types';
import { useAuth } from '@/features/auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SubmissionReport = components['schemas']['SubmissionReport'];
type ActivityReport = components['schemas']['ActivityReport'];
type Filters = NonNullable<paths['/api/reports/submissions']['get']['parameters']['query']>;
type Forms = paths['/api/reports/forms']['get']['responses'][200]['content']['application/json'];
type Evidence =
  paths['/api/reports/submissions/{id}/events']['get']['responses'][200]['content']['application/json'];

const statuses = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const dateFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const readable = (value: string) => value.replace(/_/g, ' ');

export function SearchableFormSelect({
  forms,
  value,
  onChange,
}: {
  forms: Forms;
  value?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const allForms = useMemo(() => {
    const list = [...forms];
    if (!list.some((f) => f.key === 'tsrf')) {
      list.unshift({ key: 'tsrf', name: 'Transportation Service Request Form' });
    }
    return list;
  }, [forms]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allForms;
    const q = search.toLowerCase();
    return allForms.filter(
      (f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q),
    );
  }, [allForms, search]);

  const currentForm = allForms.find((f) => f.key === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        role="combobox"
        aria-label="Form"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          selectClass,
          'flex items-center justify-between text-left cursor-pointer hover:border-primary/50 transition-colors bg-background',
        )}
      >
        <span className="truncate font-normal">
          {currentForm ? currentForm.name : value || 'Select form'}
        </span>
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-70" />
      </button>

      {/* Accessible native select fallback for testing & screen readers */}
      <select
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allForms.map((f) => (
          <option key={f.key} value={f.key}>
            {f.name}
          </option>
        ))}
      </select>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[260px] max-w-[340px] z-50 rounded-xl border border-border bg-popover shadow-xl animate-fade-in overflow-hidden">
          <div className="p-2 border-b border-border/80 bg-muted/30">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search forms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-background"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 overscroll-contain">
            {filtered.length === 0 ? (
              <div className="py-5 text-center text-xs text-muted-foreground">
                No forms found matching &quot;{search}&quot;
              </div>
            ) : (
              filtered.map((form) => {
                const isSelected = form.key === value;
                return (
                  <button
                    key={form.key}
                    type="button"
                    onClick={() => {
                      onChange(form.key);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted/70',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{form.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{form.key}</div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function reportQuery(filters: Filters, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
  query.set('page', String(page));
  query.set('pageSize', '25');
  return query.toString();
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(
    body.error ??
      (response.status === 403
        ? 'You do not have access to this report.'
        : 'Unable to load report.'),
  );
}

export function ReportsPage() {
  const { currentUser } = useAuth();
  const canAudit = currentUser?.role === 'system_admin' || currentUser?.role === 'auditor';
  const [tab, setTab] = useState<'submissions' | 'activity'>('submissions');
  const [filters, setFilters] = useState<Filters>({ formKey: 'tsrf' });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [forms, setForms] = useState<Forms>([]);
  const [report, setReport] = useState<SubmissionReport | ActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<SubmissionReport['rows'][number] | null>(null);
  const [events, setEvents] = useState<Evidence>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const query = reportQuery(filters, page);

  useEffect(() => {
    const controller = new AbortController();
    setForms([]);
    apiFetch('/api/reports/forms', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw await responseError(response);
        const options: Forms = await response.json();
        if (!controller.signal.aborted) setForms(options);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentUser?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    if (tab === 'activity' && !canAudit) {
      setError('You do not have access to audit history.');
      setLoading(false);
      return () => controller.abort();
    }
    apiFetch(`/api/reports/${tab}?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw await responseError(response);
        const result: SubmissionReport | ActivityReport = await response.json();
        if (!controller.signal.aborted) setReport(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load report.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab, query, revision, currentUser?.id, canAudit]);

  useEffect(() => {
    setEvents([]);
    setEvidenceError('');
    if (!selected) return;
    const controller = new AbortController();
    setEvidenceLoading(true);
    apiFetch(`/api/reports/submissions/${selected.id}/events`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw await responseError(response);
        const result: Evidence = await response.json();
        if (!controller.signal.aborted) setEvents(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setEvidenceError(cause instanceof Error ? cause.message : 'Unable to load evidence.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setEvidenceLoading(false);
      });
    return () => controller.abort();
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement;
    const dialog = document
      .getElementById('report-evidence-title')
      ?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    dialog.setAttribute('aria-labelledby', 'report-evidence-title');
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [selected?.id]);

  function filter(key: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value || undefined }));
    setPage(1);
  }

  function switchTab(next: typeof tab) {
    setTab(next);
    setFilters({ formKey: 'tsrf' });
    setPage(1);
    setSelected(null);
  }

  async function exportReport() {
    setExporting(true);
    setError('');
    try {
      const response = await apiFetch(`/api/reports/${tab}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!response.ok) throw await responseError(response);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export report.');
    } finally {
      setExporting(false);
    }
  }

  const submissions = report && 'summary' in report ? report : null;
  const audit = report && !('summary' in report) ? report : null;
  const pageCount = Math.max(1, Math.ceil((report?.meta.total ?? 0) / 25));

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submission Register &amp; Audit History
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            title="Refresh report"
            aria-label="Refresh report"
            disabled={loading || exporting}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || exporting || !report?.meta.total}
            onClick={() => void exportReport()}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Report views"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <button
          role="tab"
          aria-selected={tab === 'submissions'}
          className={`flex items-center gap-2 px-3 py-3 text-sm border-b-2 ${tab === 'submissions' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground'}`}
          onClick={() => switchTab('submissions')}
        >
          <FileText className="h-4 w-4" />
          Form Submissions
        </button>
        {canAudit && (
          <button
            role="tab"
            aria-selected={tab === 'activity'}
            className={`flex items-center gap-2 px-3 py-3 text-sm border-b-2 ${tab === 'activity' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground'}`}
            onClick={() => switchTab('activity')}
          >
            <ShieldCheck className="h-4 w-4" />
            Audit History
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {tab === 'submissions' && (
          <div className="text-xs font-medium space-y-1">
            <span>Form</span>
            <SearchableFormSelect
              forms={forms}
              value={filters.formKey}
              onChange={(value) => filter('formKey', value)}
            />
          </div>
        )}
        <label className="text-xs font-medium space-y-1">
          From (Manila)
          <Input
            type="date"
            aria-label="From date"
            value={filters.from ?? ''}
            onChange={(event) => filter('from', event.target.value)}
          />
        </label>
        <label className="text-xs font-medium space-y-1">
          To (Manila)
          <Input
            type="date"
            aria-label="To date"
            value={filters.to ?? ''}
            onChange={(event) => filter('to', event.target.value)}
          />
        </label>
        {tab === 'submissions' ? (
          <>
            <label className="text-xs font-medium space-y-1">
              Status
              <select
                aria-label="Status"
                className={selectClass}
                value={filters.status ?? ''}
                onChange={(event) => filter('status', event.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {readable(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium space-y-1">
              Cutoff
              <select
                aria-label="Cutoff"
                className={selectClass}
                value={filters.late ?? ''}
                onChange={(event) => filter('late', event.target.value)}
              >
                <option value="">All requests</option>
                <option value="true">Late</option>
                <option value="false">On time</option>
              </select>
            </label>
            <label className="text-xs font-medium space-y-1">
              Submission Reference
              <Input
                aria-label="Submission reference"
                value={filters.reference ?? ''}
                onChange={(event) => filter('reference', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              Stage
              <Input
                aria-label="Stage"
                value={filters.stage ?? ''}
                onChange={(event) => filter('stage', event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="text-xs font-medium space-y-1">
              Module
              <Input
                aria-label="Module"
                value={filters.module ?? ''}
                onChange={(event) => filter('module', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              Action
              <Input
                aria-label="Action"
                value={filters.action ?? ''}
                onChange={(event) => filter('action', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              Severity
              <select
                aria-label="Severity"
                className={selectClass}
                value={filters.severity ?? ''}
                onChange={(event) => filter('severity', event.target.value)}
              >
                <option value="">All severities</option>
                {['info', 'success', 'warning', 'critical'].map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium space-y-1">
              Actor ID
              <Input
                aria-label="Actor ID"
                value={filters.actorId ?? ''}
                onChange={(event) => filter('actorId', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              Actor Role
              <Input
                aria-label="Actor role"
                value={filters.actorRole ?? ''}
                onChange={(event) => filter('actorRole', event.target.value)}
              />
            </label>
          </>
        )}
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ formKey: filters.formKey });
              setPage(1);
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-l-4 border-destructive bg-destructive/5 p-3 text-sm"
        >
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>
            Retry
          </Button>
        </div>
      )}
      {report && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {report.meta.scope === 'own' ? 'My submissions' : 'Organization records'} / Asia/Manila
          </span>
          <span>Generated {dateFormat.format(new Date(report.meta.generatedAt))}</span>
        </div>
      )}
      <section
        aria-label="Report totals"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 border-y border-border divide-x divide-border py-3"
      >
        {[
          ['Matching', report?.meta.total],
          ...(submissions
            ? [
                ['Pending', submissions.summary.pending],
                ['Completed', submissions.summary.completed],
                ['Returned', submissions.summary.returned],
                ['Rejected', submissions.summary.rejected],
                ['Cancelled', submissions.summary.cancelled],
                ['Late', submissions.summary.late],
              ]
            : []),
        ].map(([label, count]) => (
          <div key={String(label)} className="px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading ? '...' : typeof count === 'number' ? count.toLocaleString() : '-'}
            </p>
          </div>
        ))}
      </section>
      <div
        role="tabpanel"
        aria-label={tab === 'submissions' ? 'Form Submissions' : 'Audit History'}
        aria-busy={loading}
      >
        {loading ? (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading report...
          </p>
        ) : report?.rows.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No matching records.</p>
        ) : (
          <div className="overflow-x-auto border-b border-border">
            {submissions && (
              <table className="w-full min-w-[900px] text-sm text-left">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {[
                      'Reference / Version',
                      'Submitted',
                      'Status / Stage',
                      'Cutoff',
                      'Responsibility',
                      'Reportable Fields',
                      'Evidence',
                    ].map((title) => (
                      <th key={title} scope="col" className="p-3 font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submissions.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium">
                        <span className="block">{row.submissionNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.formName} / {(row as any).versionName || `v${row.version}`}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-xs">
                        {dateFormat.format(new Date(row.createdAt))}
                      </td>
                      <td className="p-3">
                        <span className="block capitalize">{readable(row.status)}</span>
                        <span className="text-xs text-muted-foreground">{readable(row.stage)}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={row.isLate ? 'text-amber-600 font-medium' : 'text-emerald-600'}
                        >
                          {row.isLate ? 'Late' : 'On time'}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.currentAssignee
                          ? `${row.currentAssignee.name} (${readable(row.currentAssignee.role)})`
                          : row.currentResponsibleRoles.map(readable).join(', ') || '-'}
                      </td>
                      <td className="p-3 max-w-[280px]">
                        <dl className="text-xs space-y-1 break-words">
                          {Object.entries(row.data).map(([key, value]) => (
                            <div key={key}>
                              <dt className="inline text-muted-foreground">{readable(key)}: </dt>
                              <dd className="inline">
                                {row.labels[key] ??
                                  (typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value ?? '-'))}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`View workflow evidence for ${row.submissionNumber}`}
                          aria-label={`View workflow evidence for ${row.submissionNumber}`}
                          onClick={() => setSelected(row)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {audit && (
              <table className="w-full min-w-[800px] text-sm text-left">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {[
                      'Timestamp',
                      'Actor / Role',
                      'Action',
                      'Module',
                      'Severity',
                      'Record Reference',
                    ].map((title) => (
                      <th key={title} scope="col" className="p-3 font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {audit.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-xs">
                        {dateFormat.format(new Date(row.createdAt))}
                      </td>
                      <td className="p-3">
                        <span className="block">{row.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {readable(row.userRole)}
                        </span>
                      </td>
                      <td className="p-3">{readable(row.action)}</td>
                      <td className="p-3">{row.module}</td>
                      <td className="p-3">
                        <span
                          className={
                            row.severity === 'critical'
                              ? 'text-destructive'
                              : row.severity === 'warning'
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                          }
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td className="p-3 text-xs break-all">
                        {row.submissionId || row.recordId || row.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {report && (
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{report.meta.total.toLocaleString()} matching records</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              title="Previous page"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              title="Next page"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
      {selected &&
        createPortal(
          <Dialog open onClose={() => setSelected(null)} className="max-w-2xl">
            <DialogHeader>
              <DialogTitle id="report-evidence-title">Workflow Evidence</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              {selected?.submissionNumber} / v{selected?.version}
            </p>
            {evidenceLoading ? (
              <p role="status">Loading evidence...</p>
            ) : evidenceError ? (
              <p role="alert" className="text-destructive">
                {evidenceError}
              </p>
            ) : events.length === 0 ? (
              <p>No workflow events recorded.</p>
            ) : (
              <ol className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-sm font-medium capitalize">{readable(event.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorName} / {readable(event.actorRole)} /{' '}
                      {dateFormat.format(new Date(event.createdAt))}
                    </p>
                    <p className="text-xs mt-1">
                      {event.fromStage ?? '-'} &rarr; {event.toStage}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
