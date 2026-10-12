import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const principal = vi.hoisted(() => ({ role: 'system_admin', id: 'admin-test' }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ currentUser: principal }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ success: vi.fn() }) }));
import { RoleLandingPageSettings } from '../src/features/roles/RolesManagementPage';
import { DEFAULT_ROLES } from '../src/features/roles/RolesContext';
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
});
