import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useActivityLog,
  MODULE_COLORS,
  SEVERITY_STYLES,
  ACTION_ICONS,
  type LogModule,
  type LogSeverity,
  type ActivityLogEntry,
} from './ActivityLogContext';
import { useAuth } from '@/features/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Download,
  RefreshCw,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  Calendar,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_MODULES: LogModule[] = [
  'Fleet',
  'PMS',
  'Work Order',
  'Purchase Requisition',
  'Form Builder',
  'TSRF',
  'Incident Report',
  'User Management',
  'Roles',
  'Reference Data',
  'Maintenance',
  'Authentication',
  'System',
];

const ALL_SEVERITIES: LogSeverity[] = ['info', 'success', 'warning', 'error'];

const SEVERITY_LABELS: Record<LogSeverity, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error / Critical',
};

function formatTimestamp(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let relative: string;
  if (diffMin < 1) relative = 'Just now';
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24) relative = `${diffHr}h ago`;
  else if (diffDay === 1) relative = 'Yesterday';
  else relative = `${diffDay} days ago`;

  return {
    date: isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    relative,
  };
}

function SeverityIcon({ severity }: { severity: LogSeverity }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  if (severity === 'success') return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (severity === 'warning') return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (severity === 'error') return <XCircle className={`${cls} text-rose-400`} />;
  return <Info className={`${cls} text-blue-400`} />;
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

interface StatsBarProps {
  logs: ActivityLogEntry[];
  activeSeverity: string;
  onSelectSeverity: (severity: string) => void;
}

function StatsBar({ logs, activeSeverity, onSelectSeverity }: StatsBarProps) {
  const counts = useMemo(() => {
    const c: Record<LogSeverity, number> = { info: 0, success: 0, warning: 0, error: 0 };
    logs.forEach((l) => {
      if (c[l.severity] !== undefined) {
        c[l.severity]++;
      } else {
        c.info++;
      }
    });
    return c;
  }, [logs]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ALL_SEVERITIES.map((s) => {
        const isActive = activeSeverity === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelectSeverity(isActive ? 'all' : s)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
              s === 'success'
                ? 'bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/15'
                : s === 'warning'
                  ? 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/15'
                  : s === 'error'
                    ? 'bg-rose-500/8 border-rose-500/20 hover:bg-rose-500/15'
                    : 'bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/15'
            } ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background font-semibold' : ''}`}
            title={`Filter by ${SEVERITY_LABELS[s]} (Click to toggle)`}
          >
            <SeverityIcon severity={s} />
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{counts[s]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {SEVERITY_LABELS[s]}
                {isActive && <span className="ml-1 text-primary text-[9px] font-bold">(Active)</span>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ActivityLogPage() {
  const { logs, isLoading, refreshLogs, deleteLogs } = useActivityLog();
  const { currentUser, hasPermission } = useAuth();
  const toast = useToast();

  // Super Admin / Administrator Permission check
  const isSuperAdmin =
    currentUser?.role === 'system_admin' || currentUser?.role === 'admin';
  const canDelete = isSuperAdmin || hasPermission('delete:audit');

  // Filters
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [fromTime, setFromTime] = useState<string>('00:00'); // Initialized to 12:00 AM
  const [toDate, setToDate] = useState<string>('');
  const [toTime, setToTime] = useState<string>('23:59'); // Initialized to 11:59 PM

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Deletion confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  // Dynamic modules list (standard modules + any present in logs)
  const availableModules = useMemo(() => {
    const set = new Set<string>(BASE_MODULES);
    logs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Unique actions from current logs
  const uniqueActions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).sort(),
    [logs],
  );

  // Filtered logs
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return logs.filter((l) => {
      if (filterModule !== 'all' && l.module !== filterModule) return false;
      if (filterSeverity !== 'all' && l.severity !== filterSeverity) return false;
      if (filterAction !== 'all' && l.action !== filterAction) return false;

      // Exact Date & Time range filtering
      if (fromDate || toDate) {
        const entryTime = new Date(l.timestamp).getTime();
        if (!isNaN(entryTime)) {
          if (fromDate) {
            const startStr = `${fromDate}T${fromTime || '00:00'}:00`;
            const startBoundary = new Date(startStr).getTime();
            if (!isNaN(startBoundary) && entryTime < startBoundary) return false;
          }
          if (toDate) {
            const endStr = `${toDate}T${toTime || '23:59'}:59.999`;
            const endBoundary = new Date(endStr).getTime();
            if (!isNaN(endBoundary) && entryTime > endBoundary) return false;
          }
        }
      }

      // Search keyword filter across subject, description, user, module, action
      if (q) {
        const subject = (l.subject || '').toLowerCase();
        const description = (l.description || '').toLowerCase();
        const user = (l.user || '').toLowerCase();
        const module = (l.module || '').toLowerCase();
        const action = (l.action || '').toLowerCase();

        return (
          subject.includes(q) ||
          description.includes(q) ||
          user.includes(q) ||
          module.includes(q) ||
          action.includes(q)
        );
      }
      return true;
    });
  }, [logs, search, filterModule, filterSeverity, filterAction, fromDate, fromTime, toDate, toTime]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterModule, filterSeverity, filterAction, fromDate, fromTime, toDate, toTime, itemsPerPage]);

  // Calculate pagination window
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);

  // Slice logs for the current page
  const pagedLogs = useMemo(() => {
    return filtered.slice(startIndex, endIndex);
  }, [filtered, startIndex, endIndex]);

  // Group current page logs by date for clean timeline rendering
  const groupedPagedLogs = useMemo(() => {
    const map = new Map<string, ActivityLogEntry[]>();
    pagedLogs.forEach((l) => {
      const { date } = formatTimestamp(l.timestamp);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    });
    return map;
  }, [pagedLogs]);

  // Selection calculations for the current page
  const currentPageIds = useMemo(() => pagedLogs.map((l) => l.id), [pagedLogs]);
  const isAllCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const isSomeCurrentPageSelected =
    currentPageIds.some((id) => selectedIds.has(id)) && !isAllCurrentPageSelected;

  // Toggle selection for single entry
  const toggleSelectOne = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle select all on current page
  const toggleSelectCurrentPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [currentPageIds, isAllCurrentPageSelected]);

  // Select all filtered logs across all pages
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((l) => l.id)));
  }, [filtered]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Open confirmation modal for bulk delete (Admin only)
  const promptBulkDelete = () => {
    if (!canDelete || selectedIds.size === 0) return;
    setTargetDeleteIds(Array.from(selectedIds));
    setDeleteModalOpen(true);
  };

  // Open confirmation modal for single entry delete (Admin only)
  const promptSingleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canDelete) return;
    setTargetDeleteIds([id]);
    setDeleteModalOpen(true);
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!canDelete || targetDeleteIds.length === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteLogs(targetDeleteIds);
      if (result.success) {
        toast.success(
          targetDeleteIds.length === 1
            ? 'Activity log entry deleted successfully.'
            : `${targetDeleteIds.length} activity log entries deleted successfully.`,
        );
        // Clear deleted ids from selection
        setSelectedIds((prev) => {
          const next = new Set(prev);
          targetDeleteIds.forEach((id) => next.delete(id));
          return next;
        });
        setDeleteModalOpen(false);
        setTargetDeleteIds([]);
      } else {
        toast.error(result.error || 'Failed to delete activity logs.');
      }
    } catch {
      toast.error('An unexpected error occurred while deleting activity logs.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Date Presets
  const setTodayRange = () => {
    const today = new Date().toISOString().slice(0, 10);
    setFromDate(today);
    setToDate(today);
    setFromTime('00:00');
    setToTime('23:59');
  };

  const setYesterdayRange = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    setFromDate(yesterday);
    setToDate(yesterday);
    setFromTime('00:00');
    setToTime('23:59');
  };

  const setLast7DaysRange = () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekAgo = d.toISOString().slice(0, 10);
    setFromDate(weekAgo);
    setToDate(today);
    setFromTime('00:00');
    setToTime('23:59');
  };

  const clearDateRange = () => {
    setFromDate('');
    setToDate('');
    setFromTime('00:00');
    setToTime('23:59');
  };

  // Export CSV (Selected or Filtered)
  const exportCSV = (exportSelectedOnly = false) => {
    const listToExport = exportSelectedOnly
      ? filtered.filter((l) => selectedIds.has(l.id))
      : filtered;

    if (listToExport.length === 0) {
      toast.warning('No activity logs to export.');
      return;
    }

    const header = 'Timestamp,Module,Action,Subject,User,Severity,Description';
    const rows = listToExport.map(
      (l) =>
        `"${l.timestamp}","${l.module}","${l.action}","${(l.subject || '').replace(/"/g, '""')}","${(l.user || '').replace(/"/g, '""')}","${l.severity}","${(l.description || '').replace(/"/g, '""')}"`,
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${exportSelectedOnly ? 'selected-' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} activity log entries.`);
  };

  // Filter checks
  const hasFilters =
    Boolean(search) ||
    filterModule !== 'all' ||
    filterSeverity !== 'all' ||
    filterAction !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const activeFilterCount =
    (search ? 1 : 0) +
    (filterModule !== 'all' ? 1 : 0) +
    (filterSeverity !== 'all' ? 1 : 0) +
    (filterAction !== 'all' ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  const resetFilters = () => {
    setSearch('');
    setFilterModule('all');
    setFilterSeverity('all');
    setFilterAction('all');
    setFromDate('');
    setToDate('');
    setFromTime('00:00');
    setToTime('23:59');
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Activity History Log</h1>
            {canDelete && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                Admin Controls
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Chronological audit trail of all actions across fleet, procurement, users, and system.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {canDelete && selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={promptBulkDelete}
              className="gap-2 shadow-sm"
              size="sm"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected ({selectedIds.size})</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => exportCSV(selectedIds.size > 0)}
            className="gap-2"
            size="sm"
          >
            <Download className="h-4 w-4" />
            <span>{selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export CSV'}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => void refreshLogs()}
            disabled={isLoading}
            className="gap-2"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar
        logs={logs}
        activeSeverity={filterSeverity}
        onSelectSeverity={(s) => setFilterSeverity(s)}
      />

      {/* Unified Filters Card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
        {/* Top Header of Filters */}
        <div className="flex items-center justify-between text-sm font-medium text-foreground pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Filter Activity History</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Reset All Filters
            </button>
          )}
        </div>

        {/* Row 1: Search, Module, Severity, Action in a balanced 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              id="log-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keyword, user, subject..."
              className="pl-8 pr-7 h-9 text-sm"
              aria-label="Search logs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <Select
            id="log-filter-module"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="h-9 text-sm"
            aria-label="Filter by module"
          >
            <option value="all">All Modules</option>
            {availableModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>

          {/* Severity Filter */}
          <Select
            id="log-filter-severity"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="h-9 text-sm"
            aria-label="Filter by severity"
          >
            <option value="all">All Severities</option>
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </Select>

          {/* Action Filter */}
          <Select
            id="log-filter-action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="h-9 text-sm"
            aria-label="Filter by action"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        {/* Row 2: Date & Time Range Section with clean layout and initial 12:00 AM - 11:59 PM */}
        <div className="pt-2 border-t border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Date & Time Range:</span>
            </div>

            {/* From Date & Time */}
            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1">
              <span className="text-[11px] font-semibold text-muted-foreground shrink-0">From</span>
              <Input
                id="log-filter-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 text-xs w-32 border-border/70 bg-background"
                aria-label="From date"
                title="From date"
              />
              <Input
                id="log-filter-from-time"
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="h-7 text-xs w-24 border-border/70 bg-background"
                aria-label="From time"
                title="From time (starts at 12:00 AM)"
              />
            </div>

            <span className="text-muted-foreground/60 text-xs hidden sm:inline font-bold">→</span>

            {/* To Date & Time */}
            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1">
              <span className="text-[11px] font-semibold text-muted-foreground shrink-0">To</span>
              <Input
                id="log-filter-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 text-xs w-32 border-border/70 bg-background"
                aria-label="To date"
                title="To date"
              />
              <Input
                id="log-filter-to-time"
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="h-7 text-xs w-24 border-border/70 bg-background"
                aria-label="To time"
                title="To time (ends at 11:59 PM)"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Presets:</span>
            <button
              type="button"
              onClick={setTodayRange}
              className="px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors font-medium cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={setYesterdayRange}
              className="px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors font-medium cursor-pointer"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={setLast7DaysRange}
              className="px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors font-medium cursor-pointer"
            >
              Last 7 Days
            </button>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={clearDateRange}
                className="px-2 py-1 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                title="Clear date & time range"
              >
                <X className="h-3 w-3" /> Clear Date
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Toolbar (Admin Only) */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectCurrentPage}
              className="text-primary hover:text-primary/80 transition-colors cursor-pointer"
              title={isAllCurrentPageSelected ? 'Deselect current page' : 'Select current page'}
            >
              {isAllCurrentPageSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : isSomeCurrentPageSelected ? (
                <MinusSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
            <span className="font-semibold text-foreground">
              {selectedIds.size} of {filtered.length} log {selectedIds.size === 1 ? 'entry' : 'entries'} selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size < filtered.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
                className="text-xs h-7 bg-background"
              >
                Select all {filtered.length} matching
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={promptBulkDelete}
              className="text-xs h-7 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Results Header with Select All Page Checkbox */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          {canDelete && pagedLogs.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectCurrentPage}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
              title={isAllCurrentPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
            >
              {isAllCurrentPageSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : isSomeCurrentPageSelected ? (
                <MinusSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>Select page ({pagedLogs.length})</span>
            </button>
          )}

          <span>
            Showing <span className="font-semibold text-foreground">{filtered.length === 0 ? 0 : startIndex + 1}</span>
            –<span className="font-semibold text-foreground">{endIndex}</span> of{' '}
            <span className="font-semibold text-foreground">{filtered.length}</span> log entries
            {hasFilters && <span className="text-primary font-medium"> (filtered from {logs.length})</span>}
          </span>
        </div>

        {totalPages > 1 && (
          <div>
            Page <span className="font-semibold text-foreground">{safeCurrentPage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </div>
        )}
      </div>

      {/* Log entries grouped by date */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center shadow-sm">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-foreground font-semibold">No log entries found</p>
          <p className="text-muted-foreground text-sm mt-1">
            {hasFilters ? 'Try adjusting or clearing your filters' : 'No activity logged yet.'}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedPagedLogs.entries()).map(([date, entries]) => (
            <div key={date} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2.5 py-0.5 bg-muted/60 rounded-full flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {date}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div
                  className={`absolute ${canDelete ? 'left-[35px]' : 'left-[19px]'} top-4 bottom-4 w-px bg-border`}
                />

                <div className="space-y-1.5">
                  {entries.map((entry) => {
                    const ts = formatTimestamp(entry.timestamp);
                    const sev = SEVERITY_STYLES[entry.severity] || SEVERITY_STYLES.info;
                    const isExpanded = expandedId === entry.id;
                    const isSelected = selectedIds.has(entry.id);

                    return (
                      <div
                        key={entry.id}
                        className={`relative flex items-start gap-3 group rounded-xl border transition-all ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-transparent hover:border-border hover:bg-card/70'
                        } ${sev.row}`}
                      >
                        {/* Checkbox (Admin Only) */}
                        {canDelete && (
                          <div className="relative z-10 flex items-center shrink-0 pl-3 pt-3">
                            <button
                              type="button"
                              onClick={(e) => toggleSelectOne(entry.id, e)}
                              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5"
                              aria-label={`Select entry ${entry.subject}`}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Timeline dot */}
                        <div
                          className={`relative z-10 flex flex-col items-center shrink-0 pt-3.5 ${
                            canDelete ? '' : 'pl-3'
                          }`}
                        >
                          <div
                            className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${sev.dot}`}
                          />
                        </div>

                        {/* Content */}
                        <div
                          className="flex-1 min-w-0 py-3 pr-3 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Module badge */}
                              <span
                                className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${MODULE_COLORS[entry.module] || MODULE_COLORS.System}`}
                              >
                                {entry.module}
                              </span>

                              {/* Action */}
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                {ACTION_ICONS[entry.action] || '•'} {entry.action}
                              </span>

                              {/* Subject */}
                              <span className="text-sm font-semibold text-foreground">
                                {entry.subject}
                              </span>

                              {entry.source === 'local' && (
                                <span className="inline-flex rounded-md border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                                  Local UI
                                </span>
                              )}
                            </div>

                            {/* Timestamp & Quick Delete (Admin Only) */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-[11px] text-muted-foreground">{ts.relative}</p>
                                <p className="text-[10px] text-muted-foreground/60">{ts.time}</p>
                              </div>

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => promptSingleDelete(entry.id, e)}
                                  title="Delete this entry"
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                                  aria-label="Delete log entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {entry.description}
                          </p>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-border/50 animate-fade-in">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Performed by: </span>
                                  <span className="font-medium text-foreground">{entry.user || 'Unknown'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Severity: </span>
                                  <span
                                    className={`font-medium capitalize ${
                                      entry.severity === 'error'
                                        ? 'text-rose-400'
                                        : entry.severity === 'warning'
                                          ? 'text-amber-400'
                                          : entry.severity === 'success'
                                            ? 'text-emerald-400'
                                            : 'text-blue-400'
                                    }`}
                                  >
                                    {entry.severity}
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Timestamp: </span>
                                  <span className="font-medium text-foreground font-mono text-[11px]">
                                    {entry.timestamp}
                                  </span>
                                </div>
                                {entry.metadata &&
                                  Object.entries(entry.metadata).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-muted-foreground capitalize">
                                        {k.replace(/_/g, ' ')}:{' '}
                                      </span>
                                      <span className="font-medium text-foreground font-mono text-[11px]">
                                        {String(v)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Expand hint */}
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
                            <Clock className="h-2.5 w-2.5" />
                            {isExpanded ? 'Click to collapse' : 'Click to expand details'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {filtered.length > 0 && (
        <div className="pt-2 border-t border-border">
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(p) => setCurrentPage(p)}
            onItemsPerPageChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
            itemsPerPageOptions={[10, 25, 50, 100]}
          />
        </div>
      )}

      {/* Deletion Confirmation Dialog (Admin Only) */}
      {canDelete && (
        <ConfirmDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setTargetDeleteIds([]);
          }}
          title={targetDeleteIds.length === 1 ? 'Delete Activity Log' : 'Bulk Delete Activity Logs'}
          description={
            targetDeleteIds.length === 1
              ? 'Are you sure you want to permanently delete this activity log entry? This action cannot be undone.'
              : `Are you sure you want to permanently delete these ${targetDeleteIds.length} activity log entries? This action cannot be undone.`
          }
          confirmText={isDeleting ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          variant="destructive"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
