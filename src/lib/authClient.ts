import { PublicClientApplication } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID ?? '';
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID ?? '';
export const entraApiScope = import.meta.env.VITE_ENTRA_API_SCOPE ?? '';
export const entraEnabled = Boolean(tenantId && clientId && entraApiScope);

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: clientId || 'entra-not-configured',
    authority: `https://login.microsoftonline.com/${tenantId || 'organizations'}`,
    redirectUri: typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
});

let initialization: Promise<void> | undefined;

export function initializeAuthClient(): Promise<void> {
  initialization ??= (async () => {
    await msalInstance.initialize();
    const result = await msalInstance.handleRedirectPromise();
    if (result?.account) msalInstance.setActiveAccount(result.account);
  })();
  return initialization;
}
