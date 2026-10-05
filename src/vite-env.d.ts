/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_API_SCOPE?: string;
  readonly VITE_ENABLE_DEV_AUTH_HEADERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
