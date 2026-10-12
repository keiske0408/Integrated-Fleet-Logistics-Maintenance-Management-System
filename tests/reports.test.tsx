import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const principal = vi.hoisted(() => ({ role: 'system_admin', id: 'report-test' }));
vi.mock('@/features/auth', () => ({ useAuth: () => ({ currentUser: principal }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
import {
  ReportsPage,
  SearchableFormSelect,
  reportQuery,
} from '../src/features/reports/ReportsPage';
import { DEFAULT_ROLES } from '../src/features/roles/RolesContext';

describe('Reporting workspace', () => {
  beforeEach(() => {
    principal.role = 'system_admin';
  });

  it('preserves encoded filters and server pagination', () => {
    const query = new URLSearchParams(
      reportQuery(
        { formKey: 'tsrf', reference: 'TSRF & 1', late: 'false', from: '2026-10-12', action: '' },
        3,
      ),
    );
    expect(query.get('reference')).toBe('TSRF & 1');
    expect(query.get('late')).toBe('false');
    expect(query.get('page')).toBe('3');
    expect(query.get('pageSize')).toBe('25');
    expect(query.has('action')).toBe(false);
  });

  it('renders SearchableFormSelect with combobox and accessible options', () => {
    const mockForms = [
      { key: 'tsrf', name: 'Transportation Service Request Form' },
      { key: 'maintenance_check', name: 'Fleet Maintenance Checklist' },
    ];
    const html = renderToStaticMarkup(
      <SearchableFormSelect forms={mockForms} value="tsrf" onChange={() => {}} />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('Transportation Service Request Form');
    expect(html).toContain('Fleet Maintenance Checklist');
  });

  it.each(['system_admin', 'auditor'])('shows audit reporting to %s', (role) => {
    principal.role = role;
    const html = renderToStaticMarkup(<ReportsPage />);
    expect(html).toContain('Audit History</button>');
    expect(html).toContain('Loading report...');
    expect(html).toMatch(/disabled=""[^>]*>.*Export CSV/);
    expect(html).not.toContain('coming soon');
  });

  it.each(['department_requester', 'finance_manager', 'fleet_manager', 'approver', 'driver'])(
    'hides organization audit tab from %s',
    (role) => {
      principal.role = role;
      expect(renderToStaticMarkup(<ReportsPage />)).not.toContain('Audit History</button>');
    },
  );

  it('gives the auditor only reporting and audit navigation permissions', () => {
    expect(DEFAULT_ROLES.find((role) => role.key === 'auditor')?.permissions).toEqual([
      'view:reports',
      'view:audit',
    ]);
    expect(
      DEFAULT_ROLES.find((role) => role.key === 'procurement_officer')?.permissions,
    ).not.toContain('view:reports');
  });
});
