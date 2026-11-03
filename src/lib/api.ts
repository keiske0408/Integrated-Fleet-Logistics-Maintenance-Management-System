import { entraApiScope, msalInstance } from './authClient';

interface DevelopmentPrincipal {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const DEV_PRINCIPAL_KEY = 'hulma_dev_principal_v1';

function loadStoredPrincipal(): DevelopmentPrincipal | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.sessionStorage?.getItem(DEV_PRINCIPAL_KEY) ||
      window.localStorage?.getItem(DEV_PRINCIPAL_KEY);
    return raw ? (JSON.parse(raw) as DevelopmentPrincipal) : null;
  } catch {
    return null;
  }
}

let developmentPrincipal: DevelopmentPrincipal | null = loadStoredPrincipal();

export function setDevelopmentPrincipal(principal: DevelopmentPrincipal | null) {
  developmentPrincipal = principal;
  if (typeof window !== 'undefined') {
    try {
      if (principal) {
        const serialized = JSON.stringify(principal);
        window.sessionStorage?.setItem(DEV_PRINCIPAL_KEY, serialized);
        window.localStorage?.setItem(DEV_PRINCIPAL_KEY, serialized);
      } else {
        window.sessionStorage?.removeItem(DEV_PRINCIPAL_KEY);
        window.localStorage?.removeItem(DEV_PRINCIPAL_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
}

function readCookie(name: string): string | undefined {
  const encodedName = `${name}=`;
  const part = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(encodedName));
  return part ? decodeURIComponent(part.slice(encodedName.length)) : undefined;
}

function backendRole(role: string): string {
  const mapping: Record<string, string> = {
    system_admin: 'admin',
    fleet_manager: 'fleet_team',
    finance_manager: 'finance',
    procurement_officer: 'procurement',
  };
  return mapping[role] ?? role;
}

// ─── Session-ended signalling ────────────────────────────────────────────────
// The server session is the single source of truth. Any authenticated request
// that comes back 401 means the session is gone (expired, revoked by a logout
// in another browser, password change, ...). The auth layer registers a handler
// to react to that exactly once.
//
// `authEpoch` is bumped on every login/logout so a 401 from a request that was
// started under a previous session can never sign out a freshly created one.

export type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let hasAuthenticatedSession: (() => boolean) | null = null;
let authEpoch = 0;

export function registerUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
  isAuthenticated: (() => boolean) | null = null,
) {
  unauthorizedHandler = handler;
  hasAuthenticatedSession = isAuthenticated;
}

export function bumpAuthEpoch(): void {
  authEpoch += 1;
}

/** Endpoints where 401 means "bad credentials/token", not "session ended". */
const SESSION_AGNOSTIC_PATHS = [
  '/api/auth/local/login',
  '/api/auth/local/signup',
  '/api/auth/local/password-reset',
  '/api/auth/local/logout',
  '/api/auth/signup/options',
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isSessionAgnosticRequest(input: RequestInfo | URL, method: string): boolean {
  const path = new URL(requestUrl(input), window.location.origin).pathname;
  if (SESSION_AGNOSTIC_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }
  return (
    path === '/api/health' ||
    path.startsWith('/api/forms/published/') ||
    (path === '/api/theme' && method === 'GET')
  );
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // Capture before token acquisition: a delayed request must never inherit a
  // session established while it was waiting for Microsoft authentication.
  const epochAtRequest = authEpoch;
  const sessionAtRequest = hasAuthenticatedSession?.() === true;
  const headers = new Headers(init.headers);
  const account = msalInstance.getActiveAccount();
  if (account && entraApiScope) {
    const result = await msalInstance.acquireTokenSilent({ account, scopes: [entraApiScope] });
    headers.set('Authorization', `Bearer ${result.accessToken}`);
  } else if (
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEV_AUTH_HEADERS === 'true' &&
    developmentPrincipal
  ) {
    headers.set('x-user-id', developmentPrincipal.id);
    headers.set('x-user-name', developmentPrincipal.name);
    headers.set('x-user-role', backendRole(developmentPrincipal.role));
    if (developmentPrincipal.department)
      headers.set('x-user-department', developmentPrincipal.department);
  }

  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('fleet_csrf');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(input, { ...init, headers, credentials: 'include' });

  if (
    response.status === 401 &&
    sessionAtRequest &&
    hasAuthenticatedSession?.() === true &&
    epochAtRequest === authEpoch &&
    unauthorizedHandler &&
    !isSessionAgnosticRequest(input, method)
  ) {
    unauthorizedHandler();
  }

  return response;
}

export async function apiFetchAllPages<T>(path: string, pageSize = 500): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError('Page size must be an integer between 1 and 500.');
  }
  const rows: T[] = [];
  let offset: number | null = 0;

  while (offset !== null) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await apiFetch(`${path}${separator}limit=${pageSize}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(`Unable to load paginated resource (${response.status}).`);
    }

    const page: unknown = await response.json();
    if (!Array.isArray(page)) {
      throw new Error('Paginated API response must be an array.');
    }
    rows.push(...(page as T[]));

    if (response.headers.get('X-Has-More') !== 'true') {
      offset = null;
      continue;
    }
    const nextOffset = response.headers.get('X-Next-Offset');
    if (!nextOffset || !/^\d+$/.test(nextOffset)) {
      throw new Error('Paginated API response is missing a valid next offset.');
    }
    const next = Number(nextOffset);
    if (!Number.isSafeInteger(next) || next <= offset) {
      throw new Error('Paginated API returned an unsafe next offset.');
    }
    offset = next;
  }
  return rows;
}
