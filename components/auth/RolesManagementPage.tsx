import React, { useState } from 'react';
import {
  useRoles,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ALL_PERMISSIONS,
  type Permission,
  type RoleDefinition,
} from './RolesContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  Plus, Pencil, Trash2, X, Check, ShieldCheck, ChevronRight,
  ChevronLeft, Lock, Sparkles,
} from 'lucide-react';

const BADGE_COLOR_OPTIONS = [
  { label: 'Violet', value: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  { label: 'Blue', value: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { label: 'Cyan', value: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { label: 'Emerald', value: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: 'Amber', value: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { label: 'Orange', value: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { label: 'Rose', value: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { label: 'Slate', value: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
];

type View = 'list' | 'edit';

interface RoleFormState {
  key: string;
  label: string;
  description: string;
  color: string;
  permissions: Permission[];
  isSystem: boolean;
}

const EMPTY_FORM: RoleFormState = {
  key: '',
  label: '',
  description: '',
  color: BADGE_COLOR_OPTIONS[1].value,
  permissions: ['view:dashboard'],
  isSystem: false,
};

export function RolesManagementPage() {
  const { roles, addRole, updateRole, deleteRole } = useRoles();

  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setView('edit');
  };

  const openEdit = (role: RoleDefinition) => {
    setForm({
      key: role.key,
      label: role.label,
      description: role.description,
      color: role.color,
      permissions: [...role.permissions],
      isSystem: role.isSystem,
    });
    setEditingId(role.id);
    setView('edit');
  };

  const handleSave = () => {
    if (!form.label.trim()) return;
    if (editingId) {
      updateRole(editingId, form);
      showToast(`Role "${form.label}" updated.`);
    } else {
      const key = form.key || form.label.toLowerCase().replace(/\s+/g, '_');
      addRole({ ...form, key });
      showToast(`Role "${form.label}" created.`);
    }
    setView('list');
    setEditingId(null);
  };

  const handleDelete = (id: string, label: string) => {
    deleteRole(id);
    setDeleteConfirmId(null);
    showToast(`Role "${label}" deleted.`);
  };

  const togglePermission = (perm: Permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleGroupAll = (groupPerms: Permission[]) => {
    const allSelected = groupPerms.every((p) => form.permissions.includes(p));
    if (allSelected) {
      setForm((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !groupPerms.includes(p)),
      }));
    } else {
      const combined = Array.from(new Set([...form.permissions, ...groupPerms]));
      setForm((prev) => ({ ...prev, permissions: combined }));
    }
  };

  const selectAll = () => setForm((prev) => ({ ...prev, permissions: [...ALL_PERMISSIONS] }));
  const clearAll = () => setForm((prev) => ({ ...prev, permissions: [] }));

  // ── List View ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Roles Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Define roles and customize which pages and actions each role can access.
            </p>
          </div>
          <Button id="btn-add-role" onClick={openAdd} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Roles', value: roles.length, color: 'text-foreground' },
            { label: 'System Roles', value: roles.filter((r) => r.isSystem).length, color: 'text-muted-foreground' },
            { label: 'Custom Roles', value: roles.filter((r) => !r.isSystem).length, color: 'text-primary' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Roles table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full border ${role.color}`}>
                      {role.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{role.key}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-xs truncate">
                  {role.description}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{role.permissions.length}</span>
                    <span className="text-xs text-muted-foreground">/ {ALL_PERMISSIONS.length}</span>
                    <div className="hidden md:flex h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(role.permissions.length / ALL_PERMISSIONS.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {role.isSystem ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      <span>System</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="h-3 w-3" />
                      <span>Custom</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Edit Permissions"
                      onClick={() => openEdit(role)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!role.isSystem && (
                      deleteConfirmId === role.id ? (
                        <>
                          <button onClick={() => handleDelete(role.id, role.label)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(role.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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

  // ── Edit / Create View ─────────────────────────────────────────────────────

  const editingRole = editingId ? roles.find((r) => r.id === editingId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Roles
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {editingId ? `Edit: ${editingRole?.label}` : 'Create New Role'}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Role info */}
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Role Info</h3>

            <div className="space-y-1.5">
              <Label htmlFor="role-label">Role Name *</Label>
              <Input
                id="role-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Maintenance Supervisor"
                required
              />
            </div>

            {!editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="role-key">Role Key (auto-generated if empty)</Label>
                <Input
                  id="role-key"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="maintenance_supervisor"
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <textarea
                id="role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what this role can do..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Badge color picker */}
            <div className="space-y-2">
              <Label>Badge Color</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => setForm({ ...form, color: opt.value })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${opt.value} ${
                      form.color === opt.value ? 'ring-2 ring-white/40 scale-105' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-2">
                <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${form.color}`}>
                  {form.label || 'Role Name'}
                </span>
              </div>
            </div>

            {/* System role toggle */}
            {!editingRole?.isSystem && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="role-system"
                  type="checkbox"
                  checked={form.isSystem}
                  onChange={(e) => setForm({ ...form, isSystem: e.target.checked })}
                  className="rounded border-border"
                />
                <Label htmlFor="role-system" className="text-muted-foreground">Protected (cannot be deleted)</Label>
              </div>
            )}
            {editingRole?.isSystem && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                This is a system role. You can edit permissions but cannot delete it.
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">Permission Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-semibold text-foreground">{form.permissions.length} / {ALL_PERMISSIONS.length}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(form.permissions.length / ALL_PERMISSIONS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setView('list')} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 gap-2" disabled={!form.label.trim()}>
              <ShieldCheck className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </div>

        {/* Right: Permission matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Permission Matrix</h3>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary hover:underline">Select All</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear All</button>
            </div>
          </div>

          <div className="space-y-3">
            {PERMISSION_GROUPS.map((group) => {
              const groupSelected = group.permissions.filter((p) => form.permissions.includes(p)).length;
              const allGroupSelected = groupSelected === group.permissions.length;
              const someGroupSelected = groupSelected > 0 && !allGroupSelected;

              return (
                <div key={group.label} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroupAll(group.permissions)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all ${
                        allGroupSelected
                          ? 'bg-primary border-primary'
                          : someGroupSelected
                          ? 'bg-primary/30 border-primary'
                          : 'border-border bg-transparent'
                      }`}>
                        {allGroupSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        {someGroupSelected && <div className="h-1.5 w-1.5 bg-primary rounded-sm" />}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{group.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{groupSelected}/{group.permissions.length}</span>
                  </div>

                  {/* Permissions grid */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.permissions.map((perm) => {
                      const isSelected = form.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                              isSelected ? 'bg-primary border-primary' : 'border-border bg-transparent'
                            }`}
                            onClick={() => togglePermission(perm)}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{PERMISSION_LABELS[perm]}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{perm}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
