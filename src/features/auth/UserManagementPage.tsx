import React, { useState } from 'react';
import { useAuth, type User } from './AuthContext';
import { useRoles } from '@/features/roles/RolesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  UserPlus, Pencil, Trash2, X, Check, ShieldCheck, ShieldOff, Search,
} from 'lucide-react';
import { SignupApprovalQueue } from './SignupApprovalQueue';

// Roles now come dynamically from RolesContext

const DEPARTMENTS = [
  'Fleet Operations', 'Logistics & Dispatch', 'Finance & Accounting',
  'Procurement', 'Human Resources', 'Information Technology', 'Administration', 'Field Operations',
];

interface UserFormData {
  name: string;
  email: string;
  role: string;
  department: string;
  password: string;
  isActive: boolean;
}

const EMPTY_FORM: UserFormData = {
  name: '', email: '', role: '', department: 'Fleet Operations',
  password: '', isActive: true,
};

export function UserManagementPage() {
  const { allUsers, currentUser, addUser, updateUser, deleteUser } = useAuth();
  const { roles } = useRoles();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = allUsers.filter((u) =>
    [u.name, u.email, u.role, u.department].some((v) =>
      v.toLowerCase().includes(search.toLowerCase()),
    ),
  );

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const updates: Partial<User> = {
        name: form.name,
        role: form.role,
        department: form.department,
        isActive: form.isActive,
      };
      updateUser(editingId, updates);
      showToast(`User "${form.name}" updated successfully.`);
    } else {
      if (!form.password) return;
      addUser({ ...form });
      showToast(`User "${form.name}" created successfully.`);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const user = allUsers.find((u) => u.id === id);
    deleteUser(id);
    setDeleteConfirmId(null);
    showToast(`User "${user?.name}" removed.`);
  };

  const toggleActive = (user: User) => {
    updateUser(user.id, { isActive: !user.isActive });
    showToast(`User "${user.name}" ${user.isActive ? 'deactivated' : 'activated'}.`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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

      {currentUser?.role === 'system_admin' && <SignupApprovalQueue />}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: allUsers.length, color: 'text-foreground' },
          { label: 'Active', value: allUsers.filter((u) => u.isActive).length, color: 'text-emerald-400' },
          { label: 'Inactive', value: allUsers.filter((u) => !u.isActive).length, color: 'text-muted-foreground' },
          { label: 'Roles in Use', value: new Set(allUsers.map((u) => u.role)).size, color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

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
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                No users found.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((user) => (
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
                    <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleDef?.color || 'bg-muted text-muted-foreground border-border'}`}>
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
                <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border' : ''}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    title={user.isActive ? 'Deactivate' : 'Activate'}
                    onClick={() => toggleActive(user)}
                    disabled={user.id === currentUser?.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {user.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                {editingId ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Full Name</Label>
                <Input id="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-email">Email Address</Label>
                <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@hulma.com" required disabled={!!editingId} />
                {editingId && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}
              </div>

              {!editingId && (
                <div className="space-y-1.5">
                  <Label htmlFor="user-password">Temporary Password</Label>
                  <Input id="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required minLength={6} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="user-role">Role</Label>
                <Select id="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-department">Department</Label>
                <Select id="user-department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
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

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingId ? 'Save Changes' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-card border border-border text-foreground text-sm rounded-xl shadow-2xl animate-slide-up flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
