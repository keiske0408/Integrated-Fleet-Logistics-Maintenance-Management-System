import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const principal = vi.hoisted(() => ({ role: 'system_admin', id: 'admin-test' }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ currentUser: principal }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ success: vi.fn() }) }));
import {
  RoleLandingPageSettings,
  RolesManagementPage,
  AVAILABLE_LANDING_PAGES,
} from '../src/features/roles/RolesManagementPage';
import { DEFAULT_ROLES, RolesProvider } from '../src/features/roles/RolesContext';
import { toBackendRole } from '../src/features/auth/backendRole';
import {
  defaultLandingPages,
  effectiveLandingPage,
  permittedLandingPages,
} from '../../fleet-backend/src/domain/role-navigation';
import type { Role } from '../../fleet-backend/src/auth/abilities';

describe('Administrator account controls', () => {
  it('renders role landing configuration only for administrators', () => {
    principal.role = 'system_admin';
    expect(renderToStaticMarkup(<RoleLandingPageSettings />)).toContain('Post-Login Landing Pages');
    principal.role = 'auditor';
    expect(renderToStaticMarkup(<RoleLandingPageSettings />)).toBe('');
    principal.role = 'department_requester';
    expect(renderToStaticMarkup(<RoleLandingPageSettings />)).toBe('');
  });

  it('maps every supported frontend role to a stable canonical navigation role', () => {
    for (const role of DEFAULT_ROLES)
      expect(defaultLandingPages).toHaveProperty(toBackendRole(role.key));
    expect(toBackendRole('auditor')).toBe('auditor');
    expect(toBackendRole('logistics_manager')).toBe('fleet_team');
  });

  it.each([
    'admin',
    'fleet_team',
    'finance',
    'procurement',
    'approver',
    'department_requester',
    'driver',
    'auditor',
  ] as Role[])('keeps %s default and choices restricted to internal app pages', (role) => {
    expect(permittedLandingPages(role).map((page) => page.path)).toContain(
      defaultLandingPages[role],
    );
    expect(effectiveLandingPage(role, 'https://example.invalid')).toBe(defaultLandingPages[role]);
    expect(effectiveLandingPage(role, '//example.invalid')).toBe(defaultLandingPages[role]);
    if (role !== 'admin')
      expect(permittedLandingPages(role).map((page) => page.path)).not.toContain('/users');
  });

  it('renders landing pages inside roles management table and enables edit buttons for admins', () => {
    principal.role = 'system_admin';
    const html = renderToStaticMarkup(
      <RolesProvider>
        <RolesManagementPage />
      </RolesProvider>,
    );
    expect(html).toContain('Roles Management');
    expect(html).toContain('Post-Login Landing Page');
    expect(html).toContain('btn-edit-system_admin');
    expect(html).toContain('btn-edit-fleet_manager');
    expect(html).toContain('Dashboard');
    expect(html).toContain('/dashboard');
    expect(html).toContain('Fleet &amp; KM');
    expect(html).toContain('/fleet');
    expect(html).toContain('Create Role');
    expect(html).toContain('Administrator Controls Active');
    // Admin buttons should not have disabled attribute
    expect(html).not.toMatch(/id="btn-add-role"[^>]*disabled/);
    expect(html).not.toMatch(/id="btn-edit-system_admin"[^>]*disabled/);
  });

  it('disables role editing and create buttons for non-administrators', () => {
    principal.role = 'driver';
    const html = renderToStaticMarkup(
      <RolesProvider>
        <RolesManagementPage />
      </RolesProvider>,
    );
    expect(html).toContain('Role management is view-only for non-administrators');
    expect(html).toMatch(/id="btn-add-role"[^>]*disabled/);
    expect(html).toMatch(/id="btn-edit-system_admin"[^>]*disabled/);
  });

  it('provides all expected core system pages in AVAILABLE_LANDING_PAGES', () => {
    const paths = AVAILABLE_LANDING_PAGES.map((p) => p.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/fleet');
    expect(paths).toContain('/driver');
    expect(paths).toContain('/tsrf');
    expect(paths).toContain('/procurement');
    expect(paths).toContain('/reports');
    expect(paths).toContain('/users');
    expect(paths).toContain('/roles');
    expect(paths).toContain('/reference-data');
    expect(paths).toContain('/form-builder');
    expect(paths).toContain('/history');
    expect(paths).toContain('/theme-editor');
  });
});
