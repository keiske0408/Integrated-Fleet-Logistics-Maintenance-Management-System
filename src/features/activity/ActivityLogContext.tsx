import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LogModule =
  | 'Fleet'
  | 'PMS'
  | 'Work Order'
  | 'Purchase Requisition'
  | 'TSRF'
  | 'Incident Report'
  | 'User Management'
  | 'Roles'
  | 'Reference Data'
  | 'System';

export type LogAction =
  | 'Created'
  | 'Updated'
  | 'Deleted'
  | 'Approved'
  | 'Rejected'
  | 'Activated'
  | 'Deactivated'
  | 'Submitted'
  | 'Dispatched'
  | 'Completed'
  | 'Login'
  | 'Logout'
  | 'Permission Changed';

export type LogSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;  // ISO string
  module: LogModule;
  action: LogAction;
  subject: string;    // e.g. "Vehicle ABC-1234", "PR-2026-1042"
  description: string;
  severity: LogSeverity;
  user: string;       // user name who performed the action
  metadata?: Record<string, string | number>;
}

// ─── Seed Data ─────────────────────────────────────────────────────────────────

const now = new Date();
const ts = (minutesAgo: number) =>
  new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

const SEED_LOGS: ActivityLogEntry[] = [
  { id: 'log-s1', timestamp: ts(5), module: 'Fleet', action: 'Updated', subject: 'Vehicle XYZ-9876', description: 'Odometer updated to 5,120 KM — PMS due triggered.', severity: 'warning', user: 'Marco Reyes' },
  { id: 'log-s2', timestamp: ts(15), module: 'Purchase Requisition', action: 'Approved', subject: 'PR-2026-1011', description: 'PR approved by Finance Manager. Amount: ₱6,200.', severity: 'success', user: 'Sandra Cruz' },
  { id: 'log-s3', timestamp: ts(30), module: 'TSRF', action: 'Submitted', subject: 'TSRF-0042', description: 'TSRF submitted for IT Department → Main Office route.', severity: 'info', user: 'Ana Santos' },
  { id: 'log-s4', timestamp: ts(60), module: 'Work Order', action: 'Created', subject: 'WO-2026-0041', description: 'Work order created for brake overhaul on XYZ-9876.', severity: 'warning', user: 'Marco Reyes' },
  { id: 'log-s5', timestamp: ts(90), module: 'Fleet', action: 'Updated', subject: 'Vehicle NCR-5566', description: 'Odometer logged at 9,800 KM. PMS approaching in 200 KM.', severity: 'info', user: 'Marco Reyes' },
  { id: 'log-s6', timestamp: ts(120), module: 'User Management', action: 'Created', subject: 'Ana Santos', description: 'New user created with role: Department Requester.', severity: 'info', user: 'Admin User' },
  { id: 'log-s7', timestamp: ts(180), module: 'Roles', action: 'Permission Changed', subject: 'Fleet & Logistics Manager', description: 'Permissions updated: approve:pr removed.', severity: 'warning', user: 'Admin User' },
  { id: 'log-s8', timestamp: ts(240), module: 'Reference Data', action: 'Created', subject: 'Vendor: Pro Auto Service Center', description: 'New vendor added to the reference data.', severity: 'info', user: 'Admin User' },
  { id: 'log-s9', timestamp: ts(300), module: 'PMS', action: 'Dispatched', subject: 'Vehicle ABC-1234', description: 'PMS service order dispatched to Pro Auto Service Center.', severity: 'success', user: 'Marco Reyes' },
  { id: 'log-s10', timestamp: ts(360), module: 'Incident Report', action: 'Submitted', subject: 'Vehicle XYZ-9876', description: 'Incident report filed: severe brake squeal reported by driver.', severity: 'error', user: 'Roberto Santos' },
  { id: 'log-s11', timestamp: ts(420), module: 'Purchase Requisition', action: 'Created', subject: 'PR-2026-1042', description: 'PR created for brake overhaul. Amount: ₱18,500.', severity: 'info', user: 'Marco Reyes' },
  { id: 'log-s12', timestamp: ts(480), module: 'System', action: 'Login', subject: 'Admin User', description: 'System Administrator logged in.', severity: 'info', user: 'Admin User' },
];

// ─── Context ───────────────────────────────────────────────────────────────────

interface ActivityLogContextValue {
  logs: ActivityLogEntry[];
  addLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextValue | null>(null);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>(SEED_LOGS);

  const addLog = useCallback((entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [newEntry, ...prev]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <ActivityLogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog(): ActivityLogContextValue {
  const ctx = useContext(ActivityLogContext);
  if (!ctx) throw new Error('useActivityLog must be used inside ActivityLogProvider');
  return ctx;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const MODULE_COLORS: Record<LogModule, string> = {
  'Fleet':                'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'PMS':                  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'Work Order':           'bg-violet-500/15 text-violet-400 border-violet-500/25',
  'Purchase Requisition': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'TSRF':                 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  'Incident Report':      'bg-rose-500/15 text-rose-400 border-rose-500/25',
  'User Management':      'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  'Roles':                'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'Reference Data':       'bg-teal-500/15 text-teal-400 border-teal-500/25',
  'System':               'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

export const SEVERITY_STYLES: Record<LogSeverity, { dot: string; row: string }> = {
  info:    { dot: 'bg-blue-400',    row: '' },
  success: { dot: 'bg-emerald-400', row: 'bg-emerald-500/3' },
  warning: { dot: 'bg-amber-400',   row: 'bg-amber-500/3' },
  error:   { dot: 'bg-rose-500',    row: 'bg-rose-500/5' },
};

export const ACTION_ICONS: Partial<Record<LogAction, string>> = {
  'Created': '＋',
  'Updated': '✎',
  'Deleted': '✕',
  'Approved': '✓',
  'Rejected': '✗',
  'Activated': '◉',
  'Deactivated': '○',
  'Submitted': '→',
  'Dispatched': '⬆',
  'Completed': '★',
  'Login': '⬤',
  'Logout': '⬡',
  'Permission Changed': '⚙',
};
