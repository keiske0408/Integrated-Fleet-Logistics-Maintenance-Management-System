import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';

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
  | 'Maintenance'
  | 'Authentication'
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
  timestamp: string; // ISO string
  module: LogModule;
  action: LogAction;
  subject: string; // e.g. "Vehicle ABC-1234", "PR-2026-1042"
  description: string;
  severity: LogSeverity;
  user: string; // user name who performed the action
  metadata?: Record<string, string | number>;
  source?: 'persisted' | 'local';
}

interface BackendActivityLog {
  id: string;
  createdAt: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  severity: string;
  metadataJson: string;
}

function fromBackendLog(log: BackendActivityLog): ActivityLogEntry {
  let metadata: Record<string, string | number> = {};
  try {
    const parsed: unknown = JSON.parse(log.metadataJson);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, string | number>;
    }
  } catch {
    metadata = {};
  }
  const severity: LogSeverity =
    log.severity === 'critical'
      ? 'error'
      : log.severity === 'warning' || log.severity === 'error' || log.severity === 'success'
        ? log.severity
        : 'info';
  const knownActions: LogAction[] = [
    'Created',
    'Updated',
    'Deleted',
    'Approved',
    'Rejected',
    'Activated',
    'Deactivated',
    'Submitted',
    'Dispatched',
    'Completed',
    'Login',
    'Logout',
    'Permission Changed',
  ];
  const actionAliases: Record<string, LogAction> = {
    local_login_succeeded: 'Login',
    local_login_failed: 'Login',
    pending_signup_login_attempt: 'Login',
    logout: 'Logout',
    signup_approved: 'Approved',
    signup_rejected: 'Rejected',
    signup_verification_requested: 'Submitted',
  };
  const action =
    actionAliases[log.action] ??
    (knownActions.includes(log.action as LogAction) ? (log.action as LogAction) : 'Updated');
  const knownModules: LogModule[] = [
    'Fleet',
    'PMS',
    'Work Order',
    'Purchase Requisition',
    'TSRF',
    'Incident Report',
    'User Management',
    'Roles',
    'Reference Data',
    'Maintenance',
    'Authentication',
    'System',
  ];
  const module = knownModules.includes(log.module as LogModule)
    ? (log.module as LogModule)
    : 'System';
  const path = typeof metadata.path === 'string' ? metadata.path : '';
  return {
    id: log.id,
    timestamp: log.createdAt,
    module,
    action,
    subject: path || `${action} ${module}`,
    description: log.description,
    severity,
    user: log.userName,
    metadata,
    source: 'persisted',
  };
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface ActivityLogContextValue {
  logs: ActivityLogEntry[];
  refreshLogs: () => Promise<void>;
  addLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
}

const ActivityLogContext = createContext<ActivityLogContextValue | null>(null);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  const refreshLogs = useCallback(async () => {
    if (!currentUser) {
      setLogs((previous) => previous.filter((log) => log.id.startsWith('local-')));
      return;
    }
    try {
      const response = await apiFetch('/api/activity-logs');
      if (!response.ok) return;
      const rows = (await response.json()) as BackendActivityLog[];
      const persisted = rows.map(fromBackendLog);
      setLogs((previous) => [
        ...previous.filter((log) => log.id.startsWith('local-')),
        ...persisted,
      ]);
    } catch {
      return;
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  const addLog = useCallback((entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: `local-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      source: 'local',
    };
    setLogs((prev) => [newEntry, ...prev]);
  }, []);

  return (
    <ActivityLogContext.Provider value={{ logs, refreshLogs, addLog }}>
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
  Fleet: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  PMS: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'Work Order': 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  'Purchase Requisition': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  TSRF: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  'Incident Report': 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  'User Management': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  Roles: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'Reference Data': 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  Maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  Authentication: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  System: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

export const SEVERITY_STYLES: Record<LogSeverity, { dot: string; row: string }> = {
  info: { dot: 'bg-blue-400', row: '' },
  success: { dot: 'bg-emerald-400', row: 'bg-emerald-500/3' },
  warning: { dot: 'bg-amber-400', row: 'bg-amber-500/3' },
  error: { dot: 'bg-rose-500', row: 'bg-rose-500/5' },
};

export const ACTION_ICONS: Partial<Record<LogAction, string>> = {
  Created: '＋',
  Updated: '✎',
  Deleted: '✕',
  Approved: '✓',
  Rejected: '✗',
  Activated: '◉',
  Deactivated: '○',
  Submitted: '→',
  Dispatched: '⬆',
  Completed: '★',
  Login: '⬤',
  Logout: '⬡',
  'Permission Changed': '⚙',
};
