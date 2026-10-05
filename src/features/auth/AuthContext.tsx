import React, { createContext, useContext, useEffect, useState } from 'react';
import { type AccountInfo } from '@azure/msal-browser';
import { type Permission, type RoleDefinition, DEFAULT_ROLES } from '@/features/roles/RolesContext';
import { apiFetch, setDevelopmentPrincipal } from '@/lib/api';
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
  };
}

interface AuthContextValue {
  currentUser: User | null;
  allUsers: User[];
  isAuthenticated: boolean;
  isLoading: boolean;
  roleDefinitions: RoleDefinition[];
  setRoleDefinitions: (roles: RoleDefinition[]) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { name: string; email: string; department: string; password: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(DEFAULT_USERS);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiFetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AuthApiUser;
      })
      .then((user) => {
        if (!cancelled && user) setCurrentUser(fromApiUser(user));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (developmentDemoAuthEnabled && USER_PASSWORDS[email.toLowerCase()] === password) {
      const demoUser = allUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (demoUser) {
        setDevelopmentPrincipal({
          id: demoUser.id,
          name: demoUser.name,
          role: demoUser.role,
          department: demoUser.department,
        });
        setCurrentUser(demoUser);
        return { success: true };
      }
    }
    try {
      msalInstance.setActiveAccount(null);
      const response = await apiFetch('/api/auth/local/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, error: result.error ?? 'Unable to sign in.' };
      const user = fromApiUser(result.user as AuthApiUser);
      setCurrentUser(user);
      return { success: true };
    } catch {
      return { success: false, error: 'Unable to reach the sign-in service.' };
    }
  };

  const signup = async (data: { name: string; email: string; department: string; password: string }) => {
    try {
      const response = await apiFetch('/api/auth/local/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, error: result.error ?? 'Unable to submit signup request.' };
      return { success: true, message: result.message as string };
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
      setCurrentUser(fromApiUser((await response.json()) as AuthApiUser));
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
    if (currentUser && !USER_PASSWORDS[currentUser.email.toLowerCase()]) {
      void apiFetch('/api/auth/local/logout', { method: 'POST' });
    }
    setDevelopmentPrincipal(null);
    msalInstance.setActiveAccount(null);
    setCurrentUser(null);
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
