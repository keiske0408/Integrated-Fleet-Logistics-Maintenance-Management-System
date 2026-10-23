import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type AccountInfo } from '@azure/msal-browser';
import { type Permission, type RoleDefinition, DEFAULT_ROLES } from '@/features/roles/RolesContext';
import {
  apiFetch,
  bumpAuthEpoch,
  registerUnauthorizedHandler,
  setDevelopmentPrincipal,
} from '@/lib/api';
import { entraApiScope, entraEnabled, msalInstance } from '@/lib/authClient';

export type { Permission };
export type Role = string;

export const developmentDemoAuthEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH_HEADERS === 'true';

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map((role) => [role.key, role.label]),
);
export const ROLE_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map((role) => [role.key, role.color]),
);

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatarInitials: string;
  createdAt: string;
  isActive: boolean;
  landingPage?: string;
  hasLocalPassword?: boolean;
  /** 'session' = revocable server session (cookie/Entra); 'demo' = offline dev identity. */
  authMethod?: 'session' | 'demo';
}

const DEFAULT_USERS: User[] = developmentDemoAuthEnabled
  ? [
      {
        id: 'u-1',
        name: 'Admin User',
        email: 'admin@hulma.com',
        role: 'system_admin',
        department: 'IT / Systems',
        avatarInitials: 'AU',
        createdAt: '2026-01-01',
        isActive: true,
      },
      {
        id: 'u-2',
        name: 'Marco Reyes',
        email: 'marco.reyes@hulma.com',
        role: 'fleet_manager',
        department: 'Fleet Operations',
        avatarInitials: 'MR',
        createdAt: '2026-02-15',
        isActive: true,
      },
      {
        id: 'u-3',
        name: 'Sandra Cruz',
        email: 'sandra.cruz@hulma.com',
        role: 'finance_manager',
        department: 'Finance & Accounting',
        avatarInitials: 'SC',
        createdAt: '2026-03-01',
        isActive: true,
      },
      {
        id: 'u-4',
        name: 'Jose Lim',
        email: 'jose.lim@hulma.com',
        role: 'procurement_officer',
        department: 'Procurement',
        avatarInitials: 'JL',
        createdAt: '2026-03-10',
        isActive: true,
      },
      {
        id: 'u-5',
        name: 'Ana Santos',
        email: 'ana.santos@hulma.com',
        role: 'department_requester',
        department: 'Human Resources',
        avatarInitials: 'AS',
        createdAt: '2026-04-05',
        isActive: true,
      },
    ]
  : [];

const USER_PASSWORDS: Record<string, string> = developmentDemoAuthEnabled
  ? {
      'admin@hulma.com': 'admin123',
      'marco.reyes@hulma.com': 'fleet123',
      'sandra.cruz@hulma.com': 'finance123',
      'jose.lim@hulma.com': 'procure123',
      'ana.santos@hulma.com': 'request123',
    }
  : {};

interface AuthApiUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  department?: string;
  landingPage?: string;
}

function fromApiUser(user: AuthApiUser): User {
  const roleAliases: Record<string, string> = {
    admin: 'system_admin',
    fleet_team: 'fleet_manager',
    procurement: 'procurement_officer',
    finance: 'finance_manager',
  };
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    role: roleAliases[user.role] ?? user.role,
    department: user.department ?? '',
    avatarInitials: user.name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
    createdAt: new Date().toISOString().slice(0, 10),
    isActive: true,
    landingPage: user.landingPage,
  };
}

interface AuthContextValue {
  currentUser: User | null;
  allUsers: User[];
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  roleDefinitions: RoleDefinition[];
  setRoleDefinitions: (roles: RoleDefinition[]) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    name: string;
    email: string;
    departmentCode: string;
    requestedRole: string;
    password: string;
  }) => Promise<{ success: boolean; message?: string; verificationUrl?: string; error?: string }>;
  verifySignupEmail: (token: string) => Promise<string>;
  loginWithEntra: () => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  addUser: (user: Omit<User, 'id' | 'avatarInitials' | 'createdAt'> & { password: string }) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER_STORAGE_KEY = 'hulma_demo_user_v1';
const AUTH_SYNC_CHANNEL = 'hulma_fleet_auth_sync';
const AUTH_SYNC_STORAGE_KEY = 'hulma_fleet_auth_event';
/** Background re-validation interval while the tab is visible. */
const SESSION_CHECK_INTERVAL_MS = 15_000;
/** Minimum gap between re-validations triggered by focus/visibility events. */
const SESSION_CHECK_THROTTLE_MS = 2_500;
const SESSION_ENDED_NOTICE =
  'Your session has ended. You were signed out here because you logged out in another browser or your session expired.';
const OTHER_TAB_NOTICE = 'You signed out in another tab.';

const CURRENT_TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type AuthSyncMessage =
  | { type: 'signed_out'; senderId: string }
  | { type: 'signed_in'; senderId: string };

function isDemoUser(user: User | null): boolean {
  return user?.authMethod === 'demo';
}

function loadStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.sessionStorage?.getItem(DEMO_USER_STORAGE_KEY) ||
      window.localStorage?.getItem(DEMO_USER_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    const authMethod = user.authMethod ?? 'session';
    if (authMethod === 'demo' && !developmentDemoAuthEnabled) return null;
    return { ...user, authMethod };
  } catch {
    return null;
  }
}

function saveStoredUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      const serialized = JSON.stringify(user);
      window.sessionStorage?.setItem(DEMO_USER_STORAGE_KEY, serialized);
      window.localStorage?.setItem(DEMO_USER_STORAGE_KEY, serialized);
    } else {
      window.sessionStorage?.removeItem(DEMO_USER_STORAGE_KEY);
      window.localStorage?.removeItem(DEMO_USER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function principalFor(user: User) {
  return { id: user.id, name: user.name, role: user.role, department: user.department };
}

/** Notify other tabs of this browser. BroadcastChannel with a storage-event fallback. */
function postAuthSync(type: 'signed_out' | 'signed_in'): void {
  if (typeof window === 'undefined') return;
  const message: AuthSyncMessage = { type, senderId: CURRENT_TAB_ID };
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.postMessage(message);
      channel.close();
      return;
    } catch {
      // fall through to storage fallback
    }
  }
  try {
    window.localStorage?.setItem(
      AUTH_SYNC_STORAGE_KEY,
      JSON.stringify({ ...message, at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

function sameUser(a: User | null, b: User | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.email === b.email &&
    a.role === b.role &&
    a.department === b.department &&
    a.landingPage === b.landingPage &&
    a.authMethod === b.authMethod
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialStoredUser] = useState<User | null>(() => {
    const stored = loadStoredUser();
    // Dev identity headers are only ever valid for offline demo users. Clearing them
    // synchronously (before any child effect fires a request) prevents a real user from
    // silently staying authenticated through headers after their server session ends.
    setDevelopmentPrincipal(stored && isDemoUser(stored) ? principalFor(stored) : null);
    return stored;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(initialStoredUser);
  const [allUsers, setAllUsers] = useState<User[]>(DEFAULT_USERS);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  // Stored sessions are verified with the server before protected routes render.
  const [isLoading, setIsLoading] = useState(Boolean(initialStoredUser));
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const currentUserRef = useRef<User | null>(initialStoredUser);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  /** Single place that establishes a signed-in user. */
  const applyUser = useCallback((user: User) => {
    currentUserRef.current = user;
    setCurrentUser((previous) => (sameUser(previous, user) ? previous : user));
    saveStoredUser(user);
  }, []);

  /** Single place that tears down local auth state. Idempotent. */
  const endSession = useCallback((reason: 'user' | 'revoked' | 'other_tab') => {
    currentUserRef.current = null;
    bumpAuthEpoch();
    saveStoredUser(null);
    setDevelopmentPrincipal(null);
    msalInstance.setActiveAccount(null);
    setCurrentUser(null);
    setSessionNotice(
      reason === 'revoked' ? SESSION_ENDED_NOTICE : reason === 'other_tab' ? OTHER_TAB_NOTICE : null,
    );
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
    if (reason !== 'other_tab') postAuthSync('signed_out');
  }, []);

  /** Ask the server who we are. 401s are handled by the apiFetch interceptor. */
  const refreshFromServer = useCallback(async () => {
    const response = await apiFetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) return;
    const user = fromApiUser((await response.json()) as AuthApiUser);
    applyUser({ ...user, authMethod: 'session' });
  }, [applyUser]);

  // Any authenticated request returning 401 means the server session is gone.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      endSession('revoked');
    });
    return () => registerUnauthorizedHandler(null);
  }, [endSession]);

  // Initial verification of a server session on mount.
  useEffect(() => {
    if (!initialStoredUser) return;
    let cancelled = false;
    lastCheckRef.current = Date.now();
    refreshFromServer()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialStoredUser, refreshFromServer]);

  // Same-browser, cross-tab synchronisation.
  useEffect(() => {
    const onMessage = (message: AuthSyncMessage | undefined) => {
      if (!message || message.senderId === CURRENT_TAB_ID) return;
      if (message.type === 'signed_out') endSession('other_tab');
      if (message.type === 'signed_in' && !currentUserRef.current) {
        setSessionNotice(null);
        void refreshFromServer().catch(() => undefined);
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
        channel.onmessage = (event: MessageEvent<AuthSyncMessage>) => onMessage(event.data);
      } catch {
        channel = null;
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (channel || event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        onMessage(JSON.parse(event.newValue) as AuthSyncMessage);
      } catch {
        // ignore malformed payloads
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [endSession, refreshFromServer]);

  // Cross-browser detection: re-validate when the user returns to the tab, when the
  // network comes back, and periodically while the tab is visible.
  useEffect(() => {
    if (!currentUser) return;

    const revalidate = (force = false) => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!force && now - lastCheckRef.current < SESSION_CHECK_THROTTLE_MS) return;
      lastCheckRef.current = now;
      void refreshFromServer().catch(() => undefined);
    };

    const onActivity = () => revalidate();
    window.addEventListener('focus', onActivity);
    window.addEventListener('online', onActivity);
    document.addEventListener('visibilitychange', onActivity);
    const interval = window.setInterval(() => revalidate(true), SESSION_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', onActivity);
      window.removeEventListener('online', onActivity);
      document.removeEventListener('visibilitychange', onActivity);
      window.clearInterval(interval);
    };
  }, [currentUser, refreshFromServer]);

  const loginDemo = async (email: string) => {
    const demoUser = allUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!demoUser) return { success: false, error: 'Invalid email or password.' };
    setDevelopmentPrincipal(principalFor(demoUser));
    let landingPage = demoUser.role === 'auditor' ? '/reports' : '/dashboard';
    try {
      const response = await apiFetch('/api/roles/login-redirects/me');
      if (response.ok) {
        const settings = await response.json();
        if (settings.landingPage) landingPage = settings.landingPage;
      }
    } catch {
      // offline dev fallback
    }
    bumpAuthEpoch();
    applyUser({ ...demoUser, landingPage, authMethod: 'demo' });
    setSessionNotice(null);
    return { success: true };
  };

  const login = async (email: string, password: string) => {
    msalInstance.setActiveAccount(null);
    setDevelopmentPrincipal(null);
    const matchesDemoAccount =
      developmentDemoAuthEnabled && USER_PASSWORDS[email.toLowerCase()] === password;
    try {
      // Real server sessions always win: they can be revoked, demo identities cannot.
      const response = await apiFetch('/api/auth/local/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        bumpAuthEpoch();
        applyUser({ ...fromApiUser(result.user as AuthApiUser), authMethod: 'session' });
        setSessionNotice(null);
        postAuthSync('signed_in');
        return { success: true };
      }
      return { success: false, error: result.error ?? 'Unable to sign in.' };
    } catch {
      if (matchesDemoAccount) return loginDemo(email);
      return { success: false, error: 'Unable to reach the sign-in service.' };
    }
  };

  const signup = async (data: {
    name: string;
    email: string;
    departmentCode: string;
    requestedRole: string;
    password: string;
  }) => {
    try {
      const response = await apiFetch('/api/auth/local/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        return { success: false, error: result.error ?? 'Unable to submit signup request.' };
      return {
        success: true,
        message: result.message as string,
        verificationUrl:
          typeof result.verificationUrl === 'string' ? result.verificationUrl : undefined,
      };
    } catch {
      return { success: false, error: 'Unable to reach the signup service.' };
    }
  };

  const verifySignupEmail = async (token: string) => {
    const response = await apiFetch('/api/auth/local/signup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Unable to verify signup email.');
    return result.message as string;
  };

  const loginWithEntra = async () => {
    if (!entraEnabled) return { success: false, error: 'Microsoft sign-in is not configured.' };
    try {
      const result = await msalInstance.loginPopup({ scopes: [entraApiScope] });
      const account: AccountInfo | null = result.account;
      if (!account) return { success: false, error: 'Microsoft did not return an account.' };
      msalInstance.setActiveAccount(account);
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) {
        msalInstance.setActiveAccount(null);
        return {
          success: false,
          error: 'This Microsoft identity is not linked to a Fleet account.',
        };
      }
      bumpAuthEpoch();
      applyUser({ ...fromApiUser((await response.json()) as AuthApiUser), authMethod: 'session' });
      setSessionNotice(null);
      postAuthSync('signed_in');
      return { success: true };
    } catch {
      msalInstance.setActiveAccount(null);
      return { success: false, error: 'Microsoft sign-in could not be completed.' };
    }
  };

  const requestPasswordReset = async (email: string) => {
    const response = await apiFetch('/api/auth/local/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error('Unable to request a password reset.');
  };

  const resetPassword = async (token: string, password: string) => {
    const response = await apiFetch('/api/auth/local/password-reset/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? 'Unable to reset password.');
    }
  };

  const logout = () => {
    // Revoke on the server first, then tear down local state.
    // keepalive lets the request finish during page navigation.
    void apiFetch('/api/auth/local/logout', { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
    endSession('user');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    const role = roleDefinitions.find((item) => item.key === currentUser.role);
    return role?.permissions.includes(permission) ?? false;
  };

  const addUser = (
    data: Omit<User, 'id' | 'avatarInitials' | 'createdAt'> & { password: string },
  ) => {
    const { password: _password, ...rest } = data;
    const user: User = {
      ...rest,
      id: `u-${Date.now()}`,
      avatarInitials: rest.name
        .split(' ')
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setAllUsers((previous) => [...previous, user]);
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setAllUsers((previous) =>
      previous.map((user) => (user.id === id ? { ...user, ...updates } : user)),
    );
    if (id === currentUser?.id)
      setCurrentUser((previous) => (previous ? { ...previous, ...updates } : previous));
  };

  const deleteUser = (id: string) =>
    setAllUsers((previous) => previous.filter((user) => user.id !== id));

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated: !!currentUser,
        isLoading,
        sessionNotice,
        clearSessionNotice,
        roleDefinitions,
        setRoleDefinitions,
        login,
        signup,
        verifySignupEmail,
        loginWithEntra,
        requestPasswordReset,
        resetPassword,
        logout,
        hasPermission,
        addUser,
        updateUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
