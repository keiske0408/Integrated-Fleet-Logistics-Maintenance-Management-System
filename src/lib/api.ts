import { entraApiScope, msalInstance } from './authClient';

interface DevelopmentPrincipal {
  id: string;
  name: string;
  role: string;
  department?: string;
}

let developmentPrincipal: DevelopmentPrincipal | null = null;

export function setDevelopmentPrincipal(principal: DevelopmentPrincipal | null) {
  developmentPrincipal = principal;
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
