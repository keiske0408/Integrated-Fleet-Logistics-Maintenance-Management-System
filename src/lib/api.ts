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

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
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

  const method = (init.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('fleet_csrf');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  return fetch(input, { ...init, headers, credentials: 'include' });
}
