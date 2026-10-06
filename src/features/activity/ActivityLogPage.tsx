import React, { useState, useMemo, useEffect } from 'react';
import {
  useActivityLog,
  MODULE_COLORS,
  SEVERITY_STYLES,
  ACTION_ICONS,
  type LogModule,
  type LogSeverity,
  type ActivityLogEntry,
} from './ActivityLogContext';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_MODULES: LogModule[] = [
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
    date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
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

function StatsBar({ logs }: { logs: ActivityLogEntry[] }) {
  const counts = useMemo(() => {
    const c: Record<LogSeverity, number> = { info: 0, success: 0, warning: 0, error: 0 };
    logs.forEach((l) => c[l.severity]++);
    return c;
  }, [logs]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ALL_SEVERITIES.map((s) => (
        <div
          key={s}
          className={`flex items-center gap-3 p-3 rounded-xl border ${
            s === 'success'
              ? 'bg-emerald-500/8 border-emerald-500/20'
              : s === 'warning'
                ? 'bg-amber-500/8 border-amber-500/20'
                : s === 'error'
                  ? 'bg-rose-500/8 border-rose-500/20'
                  : 'bg-blue-500/8 border-blue-500/20'
          }`}
        >
          <SeverityIcon severity={s} />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{counts[s]}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{SEVERITY_LABELS[s]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ActivityLogPage() {
  const { logs, refreshLogs } = useActivityLog();

  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  // Unique actions from current logs
  const uniqueActions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs],
  );

  // Filtered logs
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterModule !== 'all' && l.module !== filterModule) return false;
      if (filterSeverity !== 'all' && l.severity !== filterSeverity) return false;
      if (filterAction !== 'all' && l.action !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.subject.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.user.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, filterModule, filterSeverity, filterAction]);

  // Export CSV
  const exportCSV = () => {
    const header = 'Timestamp,Module,Action,Subject,User,Severity,Description';
    const rows = filtered.map(
      (l) =>
        `"${l.timestamp}","${l.module}","${l.action}","${l.subject}","${l.user}","${l.severity}","${l.description.replace(/"/g, '""')}"`,
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters =
    search || filterModule !== 'all' || filterSeverity !== 'all' || filterAction !== 'all';

  const resetFilters = () => {
    setSearch('');
    setFilterModule('all');
    setFilterSeverity('all');
    setFilterAction('all');
  };

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityLogEntry[]>();
    filtered.forEach((l) => {
      const { date } = formatTimestamp(l.timestamp);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity History Log</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Chronological audit trail of all actions across fleet, procurement, users, and system.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button variant="outline" onClick={() => void refreshLogs()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar logs={logs} />

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filters
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="log-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select
            id="log-filter-module"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="h-8 text-sm"
          >
            <option value="all">All Modules</option>
            {ALL_MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>

          <Select
            id="log-filter-severity"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="h-8 text-sm"
          >
            <option value="all">All Severities</option>
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </Select>

          <Select
            id="log-filter-action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="h-8 text-sm"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{' '}
        <span className="font-semibold text-foreground">{logs.length}</span> log entries
        {hasFilters && <span className="text-primary"> (filtered)</span>}
      </p>

      {/* Log entries grouped by date */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-foreground font-semibold">No log entries found</p>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, entries]) => (
            <div key={date} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-0.5 bg-muted/50 rounded-full">
                  {date}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

                <div className="space-y-1">
                  {entries.map((entry) => {
                    const ts = formatTimestamp(entry.timestamp);
                    const sev = SEVERITY_STYLES[entry.severity];
                    const isExpanded = expandedId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className={`relative flex gap-3 group ${sev.row} rounded-xl transition-colors`}
                      >
                        {/* Timeline dot */}
                        <div className="relative z-10 flex flex-col items-center shrink-0 pt-3.5">
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
                                className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${MODULE_COLORS[entry.module]}`}
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

                            {/* Timestamp */}
                            <div className="text-right shrink-0">
                              <p className="text-[11px] text-muted-foreground">{ts.relative}</p>
                              <p className="text-[10px] text-muted-foreground/60">{ts.time}</p>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {entry.description}
                          </p>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-border/50 animate-fade-in">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Performed by: </span>
                                  <span className="font-medium text-foreground">{entry.user}</span>
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
                                  <span className="font-medium text-foreground font-mono">
                                    {entry.timestamp}
                                  </span>
                                </div>
                                {entry.metadata &&
                                  Object.entries(entry.metadata).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-muted-foreground capitalize">
                                        {k.replace(/_/g, ' ')}:{' '}
                                      </span>
                                      <span className="font-medium text-foreground">{v}</span>
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
    </div>
  );
}
