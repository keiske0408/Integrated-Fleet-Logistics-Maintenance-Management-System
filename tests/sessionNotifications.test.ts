import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const microsoft = vi.hoisted(() => ({
  getActiveAccount: vi.fn<() => { homeAccountId: string } | null>(() => null),
  acquireTokenSilent: vi.fn<() => Promise<{ accessToken: string }>>(),
}));
vi.mock('../src/lib/authClient', () => ({
  entraApiScope: 'api://fleet/access',
  msalInstance: microsoft,
}));

import { apiFetch, bumpAuthEpoch, registerUnauthorizedHandler } from '../src/lib/api';

describe('session-ended API notifications', () => {
  let authenticated = false;
  const onUnauthorized = vi.fn(() => {
    authenticated = false;
    bumpAuthEpoch();
  });
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    authenticated = false;
    onUnauthorized.mockClear();
    fetchMock.mockReset();
    microsoft.getActiveAccount.mockReset().mockReturnValue(null);
    microsoft.acquireTokenSilent.mockReset();
    vi.stubGlobal('window', { location: { origin: 'https://fleet.example.com' } });
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', fetchMock);
    registerUnauthorizedHandler(onUnauthorized, () => authenticated);
    bumpAuthEpoch();
  });

  afterEach(() => {
    registerUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('does not announce session loss when an anonymous request returns 401', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await apiFetch('/api/auth/me');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([
    '/api/auth/local/login',
    '/api/auth/local/signup',
    '/api/auth/local/signup/verify',
    '/api/auth/local/password-reset/request',
    '/api/auth/local/password-reset/consume',
    '/api/auth/local/logout',
    '/api/auth/signup/options',
    '/api/theme',
    '/api/theme?refresh=1',
    '/api/health',
    '/api/forms/published/tsrf',
  ])('does not treat a public/authentication failure at %s as session loss', async (path) => {
    authenticated = true;
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await apiFetch(path);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not end a session when a public form submission is rejected', async () => {
    authenticated = true;
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await apiFetch('/api/forms/published/tsrf/submit', { method: 'POST' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('still ends a session when a protected theme mutation fails authentication', async () => {
    authenticated = true;
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await apiFetch(new Request('https://fleet.example.com/api/theme', { method: 'POST' }));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('announces a genuine authenticated 401 once despite parallel failures', async () => {
    authenticated = true;
    fetchMock.mockImplementation(async () => new Response(null, { status: 401 }));
    await Promise.all([apiFetch('/api/auth/me'), apiFetch('/api/vehicles')]);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it.each([200, 403, 429, 500, 503])('does not end a session for HTTP %s', async (status) => {
    authenticated = true;
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await apiFetch('/api/vehicles');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not end a session for a network failure', async () => {
    authenticated = true;
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/api/vehicles')).rejects.toThrow('Failed to fetch');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores a request started anonymously even if login finishes before its 401', async () => {
    let respond: (response: Response) => void = () => {
      throw new Error('No pending request');
    };
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const pending = apiFetch('/api/auth/me');
    authenticated = true;
    bumpAuthEpoch();
    respond(new Response(null, { status: 401 }));
    await pending;
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores a previous session response after a new login', async () => {
    authenticated = true;
    let respond: (response: Response) => void = () => {
      throw new Error('No pending request');
    };
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const pending = apiFetch('/api/vehicles');
    bumpAuthEpoch();
    respond(new Response(null, { status: 401 }));
    await pending;
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('captures the session generation before asynchronous Microsoft token acquisition', async () => {
    authenticated = true;
    microsoft.getActiveAccount.mockReturnValue({ homeAccountId: 'old-session' });
    let acquire: (token: { accessToken: string }) => void = () => {
      throw new Error('No token request');
    };
    microsoft.acquireTokenSilent.mockImplementation(
      () =>
        new Promise((resolve) => {
          acquire = resolve;
        }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const pending = apiFetch('/api/vehicles');
    bumpAuthEpoch();
    acquire({ accessToken: 'old-token' });
    await pending;
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('still protects private endpoints when their query contains a public endpoint name', async () => {
    authenticated = true;
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await apiFetch('/api/vehicles?returnTo=/api/auth/local/login');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
