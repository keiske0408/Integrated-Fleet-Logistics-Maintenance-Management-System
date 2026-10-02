import React, { createContext, useContext, useState, useEffect } from 'react';
import { type Permission, type RoleDefinition, DEFAULT_ROLES } from '@/features/roles/RolesContext';

// Re-export Permission for convenience
export type { Permission };

// Backwards-compat type alias (now a string for dynamic roles)
export type Role = string;

// Static badge colors and labels for the built-in roles (fallback)
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.key, r.label]),
);

export const ROLE_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.key, r.color]),
);

// ─── User Types ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: string; // role key (e.g. 'system_admin', or custom 'maintenance_supervisor')
  department: string;
  avatarInitials: string;
  createdAt: string;
  isActive: boolean;
}

// ─── Default Users ────────────────────────────────────────────────────────────

const DEFAULT_USERS: User[] = [
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
];

const USER_PASSWORDS: Record<string, string> = {
  'admin@hulma.com': 'admin123',
  'marco.reyes@hulma.com': 'fleet123',
  'sandra.cruz@hulma.com': 'finance123',
  'jose.lim@hulma.com': 'procure123',
  'ana.santos@hulma.com': 'request123',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  currentUser: User | null;
  allUsers: User[];
  isAuthenticated: boolean;
  // roles snapshot passed from RolesProvider so permissions resolve dynamically
  roleDefinitions: RoleDefinition[];
  setRoleDefinitions: (roles: RoleDefinition[]) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
  const [passwords, setPasswords] = useState<Record<string, string>>(USER_PASSWORDS);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(DEFAULT_ROLES);

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem('fleet_user_id');
    if (saved) {
      const user = allUsers.find((u) => u.id === saved);
      if (user) setCurrentUser(user);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const user = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { success: false, error: 'No user found with that email address.' };
    if (!user.isActive) return { success: false, error: 'This account has been deactivated.' };
    if (passwords[user.email] !== password) return { success: false, error: 'Incorrect password.' };
    setCurrentUser(user);
    localStorage.setItem('fleet_user_id', user.id);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('fleet_user_id');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    // Find role definition by key
    const roleDef = roleDefinitions.find((r) => r.key === currentUser.role);
    if (!roleDef) return false;
    return roleDef.permissions.includes(permission);
  };

  const addUser = (
    userData: Omit<User, 'id' | 'avatarInitials' | 'createdAt'> & { password: string },
  ) => {
    const { password, ...rest } = userData;
    const initials = rest.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const newUser: User = {
      ...rest,
      id: `u-${Date.now()}`,
      avatarInitials: initials,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAllUsers((prev) => [...prev, newUser]);
    setPasswords((prev) => ({ ...prev, [newUser.email]: password }));
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const updated = { ...u, ...updates };
        if (updates.name) {
          updated.avatarInitials = updates.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        }
        return updated;
      }),
    );
    if (id === currentUser?.id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  const deleteUser = (id: string) => {
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated: !!currentUser,
        roleDefinitions,
        setRoleDefinitions,
        login,
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
