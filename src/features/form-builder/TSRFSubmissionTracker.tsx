import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ArrowRight,
  Calendar,
  User,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Pencil,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/toast';
import type { FormDefinition, FormValues } from './types';

export interface SubmissionRow {
  formKey?: string;
  formName?: string;
  formVersionId?: string;
  version?: number;
  versionName?: string | null;
  versionStatus?: string;
  visibility?: 'visible' | 'partially_restricted' | 'restricted' | 'empty';
  readPolicyRevision?: number;
  labelSnapshots?: Record<string, { code: string; label: string }>;
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

export interface SubmissionEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  action: string;
  actorName: string;
  actorRole: string;
  comment: string | null;
  createdAt: string;
}

export interface SubmissionDetail extends SubmissionRow {
  createdById: string;
  formSchema: FormDefinition;
  data: FormValues;
  labelSnapshots: Record<string, { code: string; label: string }>;
  fieldAccess: Record<string, 'read' | 'edit'>;
  resubmitStage: string | null;
  availableTransitions?: SubmissionTransition[];
}

export interface SubmissionTransition {
  toStage: string;
  label: string;
  statusCategory: string;
  reasonRequired: boolean;
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
  onNewRequest?: () => void;
  formKey?: string;
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
  if (
    s.includes('dispatched') ||
    s.includes('in_transit') ||
    s.includes('in_progress') ||
    s.includes('active')
  ) {
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
  if (s.includes('returned')) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25';
  }
  if (s.includes('reject') || s.includes('cancelled') || s.includes('declined')) {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  }
  if (s.includes('draft')) {
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25';
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

export function TSRFSubmissionTracker({
  refreshToken,
  onNewRequest,
  formKey = 'tsrf',
}: TSRFSubmissionTrackerProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activatingVersionId, setActivatingVersionId] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const handleSetActiveVersion = async (targetId: string, versionNumber: number) => {
    setActivatingVersionId(targetId);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(targetId)}/activate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate version.');
      }
      toastSuccess(`Version v${versionNumber} is now the active live template.`);
      setReloadToken((c) => c + 1);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Unable to activate form version.');
    } finally {
      setActivatingVersionId(null);
    }
  };

  const searchQuery = searchParams.get('search') ?? '';
  const statusFilter = searchParams.get('status') ?? 'all';
  const slaFilter = searchParams.get('sla') ?? 'all';
  const versionFilter = searchParams.get('formVersionId') ?? '';
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 10));
  const [versions, setVersions] = useState<
    Array<{ id: string; version: number; versionName: string | null; status: string }>
  >([]);
  const [formName, setFormName] = useState(formKey);
  const [summary, setSummary] = useState({
    total: 0,
    all: 0,
    pending: 0,
    returned: 0,
    approved: 0,
    dispatched: 0,
    rejected: 0,
    late: 0,
  });
  const totalCount = summary.all || summary.total;
  const stats = {
    ...summary,
    totalCount,
    onTimePct: totalCount ? Math.round(((totalCount - summary.late) / totalCount) * 100) : 100,
  };
  const updateFilter = (key: string, value: string, resetPage = true) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
      if (resetPage) next.delete('page');
      return next;
    });
  };
  const setSearchQuery = (value: string) => updateFilter('search', value);
  const setStatusFilter = (value: string) => updateFilter('status', value);
  const setSlaFilter = (value: string) => updateFilter('sla', value);
  const setPageSize = (value: number) => updateFilter('pageSize', String(value));
  const setCurrentPage = (value: number | ((page: number) => number)) =>
    updateFilter('page', String(typeof value === 'function' ? value(currentPage) : value), false);
  const query = new URLSearchParams({
    search: searchQuery,
    status: statusFilter,
    sla: slaFilter,
    page: String(currentPage),
    pageSize: String(pageSize),
  });
  if (versionFilter) query.set('formVersionId', versionFilter);
  const requestUrl = `/api/forms/${encodeURIComponent(formKey)}/submissions?${query}`;
  const registerPath =
    formKey === 'tsrf' ? '/tsrf' : `/forms/${encodeURIComponent(formKey)}/submissions`;
  const detailUrl = (id: string) => `${registerPath}/${id}?${searchParams}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiFetch(requestUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load TSRF requests.');
        return (await response.json()) as {
          rows: SubmissionRow[];
          versions: typeof versions;
          summary: typeof summary;
          meta: { formName: string };
        };
      })
      .then((result) => {
        if (cancelled) return;
        setSubmissions(result.rows);
        setVersions(result.versions);
        setSummary(result.summary);
        setFormName(result.meta.formName);
        const lastPage = Math.max(1, Math.ceil(result.summary.total / pageSize));
        if (currentPage > lastPage) setCurrentPage(lastPage);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSubmissions([]);
          setVersions([]);
          setSummary({
            total: 0,
            all: 0,
            pending: 0,
            returned: 0,
            approved: 0,
            dispatched: 0,
            rejected: 0,
            late: 0,
          });
          setError(cause instanceof Error ? cause.message : 'Unable to load TSRF requests.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestUrl, refreshToken, reloadToken, currentUser?.id]);

  // Pagination calculation
  const totalItems = summary.total;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSubmissions = submissions;

  const isFiltered =
    searchQuery !== '' || statusFilter !== 'all' || versionFilter !== '' || slaFilter !== 'all';

  const resetFilters = () => {
    setSearchParams({});
  };

  return (
    <div className="space-y-6">
      {/* ─── Single Unified Top Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {formKey === 'tsrf' ? 'TSRF Logistics Intake & Dispatch' : `${formName} Requests`}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage Transportation Service Request Forms, track dispatch queues, and monitor SLA
            compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shadow-xs text-xs"
            disabled={loading}
            onClick={() => setReloadToken((c) => c + 1)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {onNewRequest && (
            <Button
              type="button"
              size="sm"
              className="gap-2 shadow-sm font-medium text-xs"
              onClick={onNewRequest}
            >
              <Plus className="h-4 w-4" />
              Create Request
            </Button>
          )}
        </div>
      </div>

      {/* ─── KPI Metric Cards Bar ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Requests */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Requests
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stats.totalCount}
              </p>
              <p className="text-[10px] text-muted-foreground">Registered TSRF entries</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending Approval
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Awaiting gating/officer</p>
            </div>
            <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Dispatched & Approved */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Dispatched / Fulfilled
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stats.approved + stats.dispatched}
              </p>
              <p className="text-[10px] text-muted-foreground">Cleared for transit</p>
            </div>
            <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Rejected / Closed */}
        <Card className="border-rose-500/20 bg-rose-500/5 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Rejected / Closed
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{stats.rejected}</p>
              <p className="text-[10px] text-muted-foreground">
                {stats.returned > 0
                  ? `${stats.returned} returned for revision`
                  : 'Declined requests'}
              </p>
            </div>
            <div className="rounded-xl bg-rose-500/15 p-2.5 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* SLA Compliance */}
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                SLA Compliance
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stats.onTimePct}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {stats.late > 0 ? `${stats.late} flagged late intake` : '100% On-time intake'}
              </p>
            </div>
            <div className="rounded-xl bg-blue-500/15 p-2.5 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search, Filtering & Quick Pills Toolbar ─── */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by request reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                  Version:
                </span>
                <select
                  aria-label="Form version"
                  value={versionFilter}
                  onChange={(e) => updateFilter('formVersionId', e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Versions</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.version}
                      {version.versionName ? ` - ${version.versionName}` : ''} ({version.status})
                    </option>
                  ))}
                </select>
                {(() => {
                  const selectedVer = versions.find((v) => v.id === versionFilter);
                  if (!selectedVer || selectedVer.status === 'published') return null;
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleSetActiveVersion(selectedVer.id, selectedVer.version)
                      }
                      disabled={activatingVersionId === selectedVer.id}
                      className="h-9 gap-1.5 px-2.5 text-xs font-semibold text-emerald-700 border-emerald-600/40 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 shadow-xs"
                      title={`Set v${selectedVer.version} as the active live published template`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Set as Active
                    </Button>
                  );
                })()}
              </div>

              {/* SLA Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                  SLA:
                </span>
                <select
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value as 'all' | 'on_time' | 'late')}
                  className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Intakes</option>
                  <option value="on_time">On Time Only</option>
                  <option value="late">Late Intake Only</option>
                </select>
              </div>

              {/* Reset Filters */}
              {isFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40 text-xs">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">Status:</span>
            {(
              [
                { id: 'all', label: 'All', count: stats.totalCount },
                { id: 'pending', label: 'Pending', count: stats.pending },
                { id: 'returned', label: 'Returned', count: stats.returned },
                { id: 'approved', label: 'Approved', count: stats.approved },
                { id: 'dispatched', label: 'Dispatched', count: stats.dispatched },
                { id: 'rejected', label: 'Rejected', count: stats.rejected },
                { id: 'late', label: 'Late SLA', count: stats.late },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Error Notification ─── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Data Registry Table (Stage hidden, Department prominent) ─── */}
      <Card className="overflow-hidden border-border/70 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Request Reference</th>
                <th className="px-4 py-3">{formKey === 'tsrf' ? 'Department' : 'Form'}</th>
                <th className="px-4 py-3">
                  {formKey === 'tsrf' ? 'Project / Purpose' : 'Release'}
                </th>
                <th className="px-4 py-3">Submission Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignment</th>
                <th className="px-4 py-3">SLA Intake</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="h-4 w-28 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-3 w-32 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-3 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-16 rounded-full bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-3 w-28 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-14 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="ml-auto h-7 w-16 rounded bg-muted"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center space-y-2">
                      <div className="rounded-full bg-muted p-3 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        No TSRF requests found
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isFiltered
                          ? 'No records match your search query or filters.'
                          : 'No transportation service request forms have been submitted yet.'}
                      </p>
                      {isFiltered ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={resetFilters}
                        >
                          Clear All Filters
                        </Button>
                      ) : onNewRequest ? (
                        <Button size="sm" className="mt-2 text-xs gap-1.5" onClick={onNewRequest}>
                          <Plus className="h-3.5 w-3.5" />
                          Submit First Request
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((submission) => {
                  const dateObj = new Date(submission.createdAt);
                  const restricted =
                    submission.visibility === 'restricted' ||
                    submission.visibility === 'partially_restricted';
                  const dept =
                    formKey === 'tsrf'
                      ? String(
                          submission.labelSnapshots?.department?.label ??
                            submission.data.department ??
                            (restricted ? 'Restricted at this stage' : '—'),
                        )
                      : (submission.formName ?? formName);
                  const proj =
                    formKey === 'tsrf'
                      ? String(
                          submission.data.projectName ??
                            (restricted ? 'Restricted at this stage' : '—'),
                        )
                      : `v${submission.version} ${submission.versionName ?? ''}`;

                  return (
                    <tr
                      key={submission.id}
                      onClick={() => navigate(detailUrl(submission.id))}
                      className="cursor-pointer transition-colors hover:bg-muted/40 group"
                    >
                      {/* TSRF Reference */}
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        <span className="font-mono text-primary font-bold group-hover:underline">
                          {submission.submissionNumber}
                        </span>
                        <div className="mt-1 text-[10px] text-muted-foreground font-normal">
                          {formName} · v{submission.version} {submission.versionName ?? ''} (
                          {submission.versionStatus})
                        </div>
                      </td>

                      {/* Explicit Department Column */}
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[160px] font-semibold">{dept}</span>
                        </div>
                      </td>

                      {/* Project / Purpose */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <span className="truncate max-w-[200px] block" title={proj}>
                          {proj ||
                            (submission.visibility === 'restricted' ||
                            submission.visibility === 'partially_restricted'
                              ? 'Restricted at this stage'
                              : '—')}
                        </span>
                      </td>

                      {/* Submission Date */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{dateObj.toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={`font-medium capitalize ${getStatusBadgeStyle(submission.status)}`}
                        >
                          {displayStatus(submission.status)}
                        </Badge>
                      </td>

                      {/* Assignment */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="max-w-[180px] truncate">
                            {displayResponsibility(submission)}
                          </span>
                        </div>
                      </td>

                      {/* Intake SLA */}
                      <td className="px-4 py-3.5">
                        {submission.isLate ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            On Time
                          </span>
                        )}
                      </td>

                      {/* Action Button: Routes directly to dedicated page */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant={
                            currentUser?.role === 'department_requester' &&
                            submission.status.toLowerCase() === 'returned'
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          className={`h-8 gap-1.5 px-3 text-xs font-semibold shadow-2xs transition-all ${
                            currentUser?.role === 'department_requester' &&
                            submission.status.toLowerCase() === 'returned'
                              ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                              : 'border-border/70 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary'
                          }`}
                          onClick={() =>
                            navigate(
                              currentUser?.role === 'department_requester' &&
                                submission.status.toLowerCase() === 'returned'
                                ? `${detailUrl(submission.id)}&edit=true`
                                : detailUrl(submission.id),
                            )
                          }
                        >
                          {currentUser?.role === 'department_requester' &&
                          submission.status.toLowerCase() === 'returned' ? (
                            <>
                              <Pencil className="h-3 w-3" />
                              <span>Edit &amp; Resubmit</span>
                            </>
                          ) : (
                            <>
                              <span>View Details</span>
                              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Footer Bar ─── */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            {/* Status Summary */}
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-foreground">{startIndex + 1}</strong> to{' '}
                <strong className="text-foreground">{endIndex}</strong> of{' '}
                <strong className="text-foreground">{totalItems}</strong> requests
              </span>
              {isFiltered && (
                <Badge variant="secondary" className="text-[10px]">
                  Filtered
                </Badge>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-4">
              {/* Rows Per Page */}
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Page Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="First Page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <span className="px-2 font-medium text-foreground">
                  {safeCurrentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last Page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
export default TSRFSubmissionTracker;
