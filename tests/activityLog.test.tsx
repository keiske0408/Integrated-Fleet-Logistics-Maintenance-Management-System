import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActivityLogPage } from '../src/features/activity/ActivityLogPage';
import type { ActivityLogEntry } from '../src/features/activity/ActivityLogContext';

let currentMockLogs: ActivityLogEntry[] = [];
const mockDeleteLogs = vi.fn();
const mockRefreshLogs = vi.fn();
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock('../src/features/activity/ActivityLogContext', async () => {
  const actual = await vi.importActual('../src/features/activity/ActivityLogContext');
  return {
    ...actual,
    useActivityLog: () => ({
      logs: currentMockLogs,
      isLoading: false,
      refreshLogs: mockRefreshLogs,
      addLog: vi.fn(),
      deleteLogs: mockDeleteLogs,
    }),
  };
});

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

describe('ActivityLogPage', () => {
  const sampleLogs: ActivityLogEntry[] = [
    {
      id: 'log-1',
      timestamp: '2026-11-01T10:00:00Z',
      module: 'Fleet',
      action: 'Created',
      subject: 'Vehicle V-101',
      description: 'Vehicle V-101 registered into fleet',
      severity: 'info',
      user: 'Alice Admin',
    },
    {
      id: 'log-2',
      timestamp: '2026-11-02T14:30:00Z',
      module: 'TSRF',
      action: 'Approved',
      subject: 'TSRF-2026-001',
      description: 'Trip request approved by manager',
      severity: 'success',
      user: 'Bob Approver',
    },
    {
      id: 'log-3',
      timestamp: '2026-11-03T09:15:00Z',
      module: 'Maintenance',
      action: 'Updated',
      subject: 'WO-8821',
      description: 'Oil leak reported during inspection',
      severity: 'warning',
      user: 'Charlie Driver',
    },
    {
      id: 'log-4',
      timestamp: '2026-11-03T11:00:00Z',
      module: 'Authentication',
      action: 'Login',
      subject: 'Failed Login',
      description: 'Repeated bad password attempts detected',
      severity: 'error',
      user: 'Dave Unknown',
    },
  ];

  beforeEach(() => {
    currentMockLogs = [...sampleLogs];
    vi.clearAllMocks();
  });

  it('renders page title, stats bar, and all filter controls', () => {
    const html = renderToStaticMarkup(<ActivityLogPage />);

    // Title and actions
    expect(html).toContain('Activity History Log');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Refresh');

    // Severity stats
    expect(html).toContain('Info');
    expect(html).toContain('Success');
    expect(html).toContain('Warning');
    expect(html).toContain('Error / Critical');

    // Filter controls
    expect(html).toContain('id="log-search"');
    expect(html).toContain('id="log-filter-module"');
    expect(html).toContain('id="log-filter-severity"');
    expect(html).toContain('id="log-filter-action"');
    expect(html).toContain('id="log-filter-from-date"');
    expect(html).toContain('id="log-filter-to-date"');

    // Log items rendered
    expect(html).toContain('Vehicle V-101');
    expect(html).toContain('TSRF-2026-001');
    expect(html).toContain('WO-8821');
    expect(html).toContain('Failed Login');
  });

  it('renders pagination and select page controls with items count', () => {
    const html = renderToStaticMarkup(<ActivityLogPage />);

    expect(html).toContain('Showing');
    expect(html).toContain('Select page');
    expect(html).toContain('Rows per page:');
    expect(html).toContain('log entries');
  });

  it('renders empty state when there are no logs', () => {
    currentMockLogs = [];
    const html = renderToStaticMarkup(<ActivityLogPage />);

    expect(html).toContain('No log entries found');
    expect(html).toContain('No activity logged yet.');
  });

  it('includes quick delete icon buttons for individual rows', () => {
    const html = renderToStaticMarkup(<ActivityLogPage />);

    expect(html).toContain('title="Delete this entry"');
  });

  it('populates filter options with unique modules and actions', () => {
    const html = renderToStaticMarkup(<ActivityLogPage />);

    // Modules
    expect(html).toContain('<option value="Fleet">Fleet</option>');
    expect(html).toContain('<option value="TSRF">TSRF</option>');
    expect(html).toContain('<option value="Maintenance">Maintenance</option>');
    expect(html).toContain('<option value="Authentication">Authentication</option>');

    // Actions
    expect(html).toContain('<option value="Approved">Approved</option>');
    expect(html).toContain('<option value="Created">Created</option>');
    expect(html).toContain('<option value="Login">Login</option>');
    expect(html).toContain('<option value="Updated">Updated</option>');
  });
});
