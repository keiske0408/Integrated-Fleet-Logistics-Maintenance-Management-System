import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { paths } from '@/api/generated-types';
import { useAuth, type User } from './AuthContext';
import { useRoles } from '@/features/roles/RolesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { apiFetch } from '@/lib/api';
import {
  UserPlus,
  Pencil,
  Trash2,
  X,
  Check,
  ShieldCheck,
  ShieldOff,
  Search,
  KeyRound,
} from 'lucide-react';
import { SignupApprovalQueue } from './SignupApprovalQueue';
import { FLEET_DEPARTMENTS } from './departments';
import { toBackendRole } from './backendRole';

type UserManagementView = 'users' | 'requests';

interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  createdAt: string;
  hasLocalPassword: boolean;
}

const FRONTEND_ROLE_ALIASES: Record<string, string> = {
  admin: 'system_admin',
  fleet_team: 'fleet_manager',
  procurement: 'procurement_officer',
  finance: 'finance_manager',
};

function toFrontendUser(user: BackendUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: FRONTEND_ROLE_ALIASES[user.role] ?? user.role,
    department: user.department,
    avatarInitials: user.name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
    createdAt: user.createdAt.slice(0, 10),
    isActive: user.status === 'active',
    hasLocalPassword: user.hasLocalPassword,
  };
}

interface UserFormData {
  name: string;
  email: string;
  role: string;
  department: string;
  password: string;
  isActive: boolean;
}

const EMPTY_FORM: UserFormData = {
  name: '',
  email: '',
  role: '',
  department: 'Fleet Operations',
  password: '',
  isActive: true,
};

export function UserManagementPage() {
  const { currentUser, logout } = useAuth();
  const { roles } = useRoles();
  const { success: toastSuccess } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [activeView, setActiveView] = useState<UserManagementView>('users');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  function closePasswordDialog() {
    setPasswordUser(null);
    setNewPassword('');
    setPasswordConfirmation('');
    setPasswordError('');
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordUser || currentUser?.role !== 'system_admin' || passwordBusy) return;
    if (newPassword !== passwordConfirmation) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    try {
      const body: NonNullable<
        paths['/api/auth/local/password']['post']['requestBody']
      >['content']['application/json'] = { userId: passwordUser.id, password: newPassword };
      const response = await apiFetch('/api/auth/local/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Unable to change password.');
      }
      toastSuccess(`Local password updated for ${passwordUser.name}.`);
      const changedSelf = passwordUser.id === currentUser.id;
      closePasswordDialog();
      if (changedSelf) logout();
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Unable to change password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = users.filter((u) =>
    [u.name, u.email, u.role, u.department].some((v) =>
      v.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedUsers = React.useMemo(() => {
    return filtered.slice(startIndex, endIndex);
  }, [filtered, startIndex, endIndex]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await apiFetch('/api/users');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to load users.');
      setUsers((result as BackendUser[]).map(toFrontendUser));
    } catch (cause) {
      setUsersError(cause instanceof Error ? cause.message : 'Unable to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM, role: roles[0]?.key || 'department_requester' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (user: User) => {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      password: '',
      isActive: user.isActive,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsersError('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: toBackendRole(form.role),
        department: form.department,
        status: form.isActive ? 'active' : 'inactive',
      };
      const response = await apiFetch(
        editingId ? `/api/users/${encodeURIComponent(editingId)}` : '/api/users',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.error ?? 'Unable to save user.');

      if (!editingId) {
        const provision = await apiFetch('/api/auth/local/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: result.id, password: form.password }),
        });
        if (!provision.ok) {
          await apiFetch(`/api/users/${encodeURIComponent(result.id)}`, { method: 'DELETE' });
          const provisionError = await provision.json();
          throw new Error(provisionError.error ?? 'Unable to provision local credentials.');
        }
      }

      await loadUsers();
      toastSuccess(`User "${form.name}" ${editingId ? 'updated' : 'created'} successfully.`);
      setShowForm(false);
      setEditingId(null);
    } catch (cause) {
      setUsersError(cause instanceof Error ? cause.message : 'Unable to save user.');
    }
  };

  const handleDelete = async (id: string) => {
    const user = users.find((item) => item.id === id);
    const response = await apiFetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      setUsersError('Unable to remove user.');
      return;
    }
    await loadUsers();
    setDeleteConfirmId(null);
    toastSuccess(`User "${user?.name}" removed.`);
  };

  const toggleActive = async (user: User) => {
    const response = await apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        role: toBackendRole(user.role),
        department: user.department,
        status: user.isActive ? 'inactive' : 'active',
      }),
    });
    if (!response.ok) {
      setUsersError('Unable to update account status.');
      return;
    }
    await loadUsers();
    toastSuccess(`User "${user.name}" ${user.isActive ? 'deactivated' : 'activated'}.`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div
        role="tablist"
        aria-label="User management sections"
        className="flex items-center gap-2 bg-muted/40 p-0.5 rounded-lg w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'users'}
          onClick={() => setActiveView('users')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeView === 'users' ? 'bg-card shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Users
        </button>
        {currentUser?.role === 'system_admin' && (
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'requests'}
            onClick={() => setActiveView('requests')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeView === 'requests' ? 'bg-card shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Signup Requests
          </button>
        )}
      </div>

      {activeView === 'users' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage system users and their role-based access permissions.
            </p>
          </div>
          <Button id="btn-add-user" onClick={openAddForm} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      )}

      {activeView === 'requests' ? (
        <SignupApprovalQueue />
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: users.length, color: 'text-foreground' },
              {
                label: 'Active',
                value: users.filter((u) => u.isActive).length,
                color: 'text-emerald-400',
              },
              {
                label: 'Inactive',
                value: users.filter((u) => !u.isActive).length,
                color: 'text-muted-foreground',
              },
              {
                label: 'Roles in Use',
                value: new Set(users.map((u) => u.role)).size,
                color: 'text-primary',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {usersError && (
            <p role="alert" className="text-sm text-destructive">
              {usersError}
            </p>
          )}

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="user-search"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    {usersLoading ? 'Loading users...' : 'No users found.'}
                  </TableCell>
                </TableRow>
              )}
              {paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{user.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {user.id === currentUser?.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                          You
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const roleDef = roles.find((r) => r.key === user.role);
                      return (
                        <span
                          className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleDef?.color || 'bg-muted text-muted-foreground border-border'}`}
                        >
                          {roleDef?.label || user.role}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {user.department}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {user.createdAt}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isActive ? 'default' : 'secondary'}
                      className={
                        user.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border'
                          : ''
                      }
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {currentUser?.role === 'system_admin' && (
                        <button
                          type="button"
                          aria-label={`Change local password for ${user.name}`}
                          title={
                            user.hasLocalPassword
                              ? 'Change Fleet-local password'
                              : 'No Fleet-local password; Microsoft or unprovisioned account'
                          }
                          disabled={!user.isActive || !user.hasLocalPassword}
                          onClick={() => {
                            closePasswordDialog();
                            setPasswordUser(user);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActive(user)}
                        disabled={user.id === currentUser?.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {user.isActive ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        title="Edit"
                        onClick={() => openEditForm(user)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deleteConfirmId === user.id ? (
                        <>
                          <button
                            title="Confirm Delete"
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            title="Cancel"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          title="Delete"
                          onClick={() => setDeleteConfirmId(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border px-3 py-1 bg-card/60">
            <Pagination
              currentPage={safeCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        </>
      )}

      {passwordUser &&
        currentUser?.role === 'system_admin' &&
        createPortal(
          <Dialog
            open
            onClose={() => {
              if (!passwordBusy) closePasswordDialog();
            }}
            closeOnBackdropClick={!passwordBusy}
            closeOnEscape={!passwordBusy}
            showCloseButton={!passwordBusy}
            className="max-w-md"
          >
            <h2 className="text-lg font-semibold mb-1">Change Local Password</h2>
            <p className="text-sm text-muted-foreground mb-4">{passwordUser.name}</p>
            <form
              aria-label="Change local password"
              onSubmit={(event) => void changePassword(event)}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="admin-new-password">New Password</Label>
                <Input
                  id="admin-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                  disabled={passwordBusy}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                  disabled={passwordBusy}
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
              </div>
              {passwordError && (
                <p role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={passwordBusy}
                  onClick={closePasswordDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordBusy}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {passwordBusy ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </Dialog>,
          document.body,
        )}

      {/* Form Modal */}
      <Dialog
        open={activeView === 'users' && showForm}
        onOpenChange={setShowForm}
        className="max-w-md"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">
            {editingId ? 'Edit User' : 'Add New User'}
          </h3>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Full Name</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Dela Cruz"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email Address</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@hulma.com"
              required
              disabled={!!editingId}
            />
            {editingId && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed after creation.
              </p>
            )}
          </div>

          {!editingId && (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Temporary Password</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 12 characters"
                required
                minLength={12}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-department">Department</Label>
            <Select
              id="user-department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {FLEET_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="user-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="user-active">Account is active</Label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-4 border-t border-border/50 [&>button]:w-full [&>button]:sm:w-auto [&>button]:flex-1">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingId ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
