import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/AuthContext', () => ({
  developmentDemoAuthEnabled: false,
  useAuth: () => ({
    sessionNotice: 'Your session has ended.',
    clearSessionNotice: vi.fn(),
  }),
}));
vi.mock('@/lib/authClient', () => ({ entraEnabled: false }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { LoginPage } from '../src/features/auth/LoginPage';

describe('session notice placement', () => {
  afterEach(() => vi.unstubAllGlobals());

  function renderLogin(hash: string) {
    vi.stubGlobal('window', { location: { hash } });
    return renderToStaticMarkup(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
  }

  it('shows genuine session loss on the ordinary sign-in form', () => {
    const html = renderLogin('');
    expect(html).toContain('Your session has ended.');
    expect(html).toContain('role="status"');
  });

  it.each(['#token=reset-token', '#signupToken=verification-token'])(
    'does not show a session notice while handling %s',
    (hash) => {
      expect(renderLogin(hash)).not.toContain('Your session has ended.');
    },
  );
});
