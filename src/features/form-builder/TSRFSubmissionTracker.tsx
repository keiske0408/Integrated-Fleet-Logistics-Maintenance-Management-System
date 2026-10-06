import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { FormDefinition, FormValues } from './types';

export interface SubmissionRow {
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
  onNewRequest: () => void;
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

export function TSRFSubmissionTracker({ refreshToken, onNewRequest }: TSRFSubmissionTrackerProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'returned' | 'approved' | 'dispatched' | 'late'
  >('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'on_time' | 'late'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiFetch('/api/forms/tsrf/submissions/report?limit=100')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load TSRF requests.');
        return (await response.json()) as SubmissionRow[];
      })
      .then((rows) => {
        if (cancelled) return;
        setSubmissions(rows);
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
  }, [refreshToken, reloadToken]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, departmentFilter, slaFilter, pageSize]);

  // Summary Metrics calculations
  const stats = useMemo(() => {
    const total = submissions.length;
    let pending = 0;
    let returned = 0;
    let approved = 0;
    let dispatched = 0;
    let late = 0;

    for (const sub of submissions) {
      const s = (sub.status || '').toLowerCase();
      if (s === 'returned') returned++;
      if (
        s.includes('pending') ||
        s.includes('review') ||
        s.includes('submitted') ||
        s.includes('endorsement')
      )
        pending++;
      if (s.includes('approved')) approved++;
      if (s.includes('dispatched') || s.includes('completed')) dispatched++;
      if (sub.isLate) late++;
    }

    const onTimePct = total > 0 ? Math.round(((total - late) / total) * 100) : 100;
    return { total, pending, returned, approved, dispatched, late, onTimePct };
  }, [submissions]);

  // Unique departments for dropdown filter
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    submissions.forEach((s) => {
      const d = String(
        s.data?.department ||
          s.data?.requestingDepartment ||
          s.data?.requesting_department ||
          s.data?.dept ||
          '',
      ).trim();
      if (d && d !== '—' && d !== 'undefined') depts.add(d);
    });
    return Array.from(depts).sort();
  }, [submissions]);

  // Filtered rows
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // 1. Status Filter Pills
      if (statusFilter === 'pending') {
        const s = (sub.status || '').toLowerCase();
        if (
          !s.includes('pending') &&
          !s.includes('review') &&
          !s.includes('submitted') &&
          !s.includes('endorsement')
        )
          return false;
      } else if (statusFilter === 'returned') {
        if ((sub.status || '').toLowerCase() !== 'returned') return false;
      } else if (statusFilter === 'approved') {
        const s = (sub.status || '').toLowerCase();
        if (!s.includes('approved')) return false;
      } else if (statusFilter === 'dispatched') {
        const s = (sub.status || '').toLowerCase();
        if (!s.includes('dispatched') && !s.includes('completed')) return false;
      } else if (statusFilter === 'late') {
        if (!sub.isLate) return false;
      }

      // 2. Department Filter
      const dept = String(
        sub.data?.department ||
          sub.data?.requestingDepartment ||
          sub.data?.requesting_department ||
          sub.data?.dept ||
          '',
      ).trim();
      if (departmentFilter !== 'all') {
        if (dept.toLowerCase() !== departmentFilter.toLowerCase()) return false;
      }

      // 3. SLA Filter
      if (slaFilter === 'on_time' && sub.isLate) return false;
      if (slaFilter === 'late' && !sub.isLate) return false;

      // 4. Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (sub.submissionNumber || '').toLowerCase();
        const stat = (sub.status || '').toLowerCase();
        const assignee = (sub.currentAssignee?.name || '').toLowerCase();
        const roles = (sub.currentResponsibleRoles || []).join(' ').toLowerCase();

        // Check deep data fields
        const proj = String(sub.data?.projectName || sub.data?.purpose || '').toLowerCase();
        const vtype = String(sub.data?.vehicleType || '').toLowerCase();

        return (
          num.includes(q) ||
          dept.toLowerCase().includes(q) ||
          proj.includes(q) ||
          stat.includes(q) ||
          assignee.includes(q) ||
          roles.includes(q) ||
          vtype.includes(q)
        );
      }

      return true;
    });
  }, [submissions, statusFilter, departmentFilter, slaFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex);

  const isFiltered =
    searchQuery !== '' ||
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    slaFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setSlaFilter('all');
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
              TSRF Logistics Intake & Dispatch
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

          <Button
            type="button"
            size="sm"
            className="gap-2 shadow-sm font-medium text-xs"
            onClick={onNewRequest}
          >
            <Plus className="h-4 w-4" />
            Create Request
          </Button>
        </div>
      </div>

      {/* ─── KPI Metric Cards Bar ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Requests */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Requests
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
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
                placeholder="Search by TSRF number, department, project, or assignee..."
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
                  Department:
                </span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Departments</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
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
                { id: 'all', label: 'All', count: stats.total },
                { id: 'pending', label: 'Pending', count: stats.pending },
                { id: 'returned', label: 'Returned', count: stats.returned },
                { id: 'approved', label: 'Approved', count: stats.approved },
                { id: 'dispatched', label: 'Dispatched', count: stats.dispatched },
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
                <th className="px-4 py-3">TSRF Reference</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Project / Purpose</th>
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
                      ) : (
                        <Button size="sm" className="mt-2 text-xs gap-1.5" onClick={onNewRequest}>
                          <Plus className="h-3.5 w-3.5" />
                          Submit First Request
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((submission) => {
                  const dateObj = new Date(submission.createdAt);
                  const dept = String(
                    submission.data?.department ||
                      submission.data?.requestingDepartment ||
                      submission.data?.requesting_department ||
                      submission.data?.dept ||
                      '—',
                  );
                  const proj = String(
                    submission.data?.projectName || submission.data?.purpose || '',
                  );

                  return (
                    <tr
                      key={submission.id}
                      onClick={() => navigate(`/tsrf/${submission.id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/40 group"
                    >
                      {/* TSRF Reference */}
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        <span className="font-mono text-primary font-bold group-hover:underline">
                          {submission.submissionNumber}
                        </span>
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
                          {proj || '—'}
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
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2.5 text-xs text-primary hover:bg-primary/10 font-medium"
                          onClick={() =>
                            navigate(
                              currentUser?.role === 'department_requester' &&
                                submission.status.toLowerCase() === 'returned'
                                ? `/tsrf/${submission.id}?edit=true`
                                : `/tsrf/${submission.id}`,
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
                              <ArrowRight className="h-3 w-3" />
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
