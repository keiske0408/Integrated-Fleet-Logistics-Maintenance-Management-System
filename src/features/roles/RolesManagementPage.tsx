import React, { useState } from 'react';
import { useRoles, type Permission, type RoleDefinition } from './RolesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Lock,
  Sparkles,
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

type View = 'list' | 'edit' | 'permissions';

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
  const {
    roles,
    addRole,
    updateRole,
    deleteRole,
    allPermissions,
    permissionGroups,
    permissionLabels,
    addSystemPermission,
    updateSystemPermission,
    deleteSystemPermission,
  } = useRoles();
  const { success: toastSuccess } = useToast();

  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New permission form state
  const [newPermKey, setNewPermKey] = useState('');
  const [newPermLabel, setNewPermLabel] = useState('');
  const [newPermGroup, setNewPermGroup] = useState('');
  const [editingPermKey, setEditingPermKey] = useState<string | null>(null);

  const showToast = (msg: string) => toastSuccess(msg);

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

  const selectAll = () => setForm((prev) => ({ ...prev, permissions: [...allPermissions] }));
  const clearAll = () => setForm((prev) => ({ ...prev, permissions: [] }));

  const handleCreatePermission = () => {
    if (!newPermKey || !newPermLabel || !newPermGroup) return;

    if (editingPermKey) {
      updateSystemPermission(editingPermKey, newPermLabel, newPermGroup);
      showToast(`System Permission "${newPermLabel}" updated.`);
    } else {
      addSystemPermission(newPermKey, newPermLabel, newPermGroup);
      showToast(`System Permission "${newPermLabel}" added.`);
    }

    setNewPermKey('');
    setNewPermLabel('');
    setNewPermGroup('');
    setEditingPermKey(null);
  };

  const handleEditPermission = (key: string, label: string, group: string) => {
    setEditingPermKey(key);
    setNewPermKey(key);
    setNewPermLabel(label);
    setNewPermGroup(group);
  };

  const handleCancelEditPermission = () => {
    setEditingPermKey(null);
    setNewPermKey('');
    setNewPermLabel('');
    setNewPermGroup('');
  };

  // ── List View ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 bg-muted/40 p-0.5 rounded-lg w-fit">
          <button
            onClick={() => setView('list')}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-card shadow-sm text-foreground border border-border"
          >
            Roles Overview
          </button>
          <button
            onClick={() => setView('permissions')}
            className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            System Permissions
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
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
            {
              label: 'System Roles',
              value: roles.filter((r) => r.isSystem).length,
              color: 'text-muted-foreground',
            },
            {
              label: 'Custom Roles',
              value: roles.filter((r) => !r.isSystem).length,
              color: 'text-primary',
            },
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
                    <span
                      className={`inline-flex w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full border ${role.color}`}
                    >
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
                    <span className="text-sm font-semibold text-foreground">
                      {role.permissions.length}
                    </span>
                    <span className="text-xs text-muted-foreground">/ {allPermissions.length}</span>
                    <div className="hidden md:flex h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${(role.permissions.length / allPermissions.length) * 100}%`,
                        }}
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
                    {!role.isSystem &&
                      (deleteConfirmId === role.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(role.id, role.label)}
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(role.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* (toast rendered globally) */}
      </div>
    );
  }

  // ── Permissions View ───────────────────────────────────────────────────────

  if (view === 'permissions') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 bg-muted/40 p-0.5 rounded-lg w-fit">
          <button
            onClick={() => setView('list')}
            className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Roles Overview
          </button>
          <button
            onClick={() => setView('permissions')}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-card shadow-sm text-foreground border border-border"
          >
            System Permissions
          </button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Permissions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage the master list of permissions available in the system.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground text-sm">
                {editingPermKey ? 'Edit Permission' : 'Add New Permission'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Only SuperAdmins should manage custom permissions.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="perm-key">Permission Key *</Label>
                <Input
                  id="perm-key"
                  value={newPermKey}
                  onChange={(e) => setNewPermKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. view:custom_reports"
                  className="font-mono text-xs"
                  required
                  disabled={!!editingPermKey}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perm-label">Display Label *</Label>
                <Input
                  id="perm-label"
                  value={newPermLabel}
                  onChange={(e) => setNewPermLabel(e.target.value)}
                  placeholder="e.g. View Custom Reports"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perm-group">Group Name *</Label>
                <Input
                  id="perm-group"
                  value={newPermGroup}
                  onChange={(e) => setNewPermGroup(e.target.value)}
                  placeholder="e.g. Reports & Analytics"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreatePermission}
                  disabled={!newPermKey || !newPermLabel || !newPermGroup}
                  className="w-full"
                >
                  {editingPermKey ? 'Save Changes' : 'Add Permission'}
                </Button>
                {editingPermKey && (
                  <Button variant="outline" onClick={handleCancelEditPermission}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPermissions.map((key) => {
                  const label = permissionLabels[key];
                  const group =
                    permissionGroups.find((g) => g.permissions.includes(key))?.label || 'Custom';
                  const isCore = [
                    'view:dashboard',
                    'view:fleet',
                    'view:users',
                    'view:roles',
                    'manage:roles',
                  ].includes(key);

                  return (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-xs">{key}</TableCell>
                      <TableCell className="font-medium text-sm">{label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {group}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isCore && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditPermission(key, label, group)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit Permission"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                deleteSystemPermission(key);
                                showToast(`Permission "${key}" deleted.`);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete Permission"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {isCore && (
                          <Lock
                            className="h-4 w-4 inline-block text-muted-foreground opacity-50"
                            aria-label="Core Permission"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* (toast rendered globally) */}
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
                  onChange={(e) =>
                    setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                  }
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
                      form.color === opt.value
                        ? 'ring-2 ring-white/40 scale-105'
                        : 'opacity-70 hover:opacity-100'
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
                <span
                  className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${form.color}`}
                >
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
                <Label htmlFor="role-system" className="text-muted-foreground">
                  Protected (cannot be deleted)
                </Label>
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
                <span className="font-semibold text-foreground">
                  {form.permissions.length} / {allPermissions.length}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(form.permissions.length / allPermissions.length) * 100}%` }}
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
              <button onClick={selectAll} className="text-xs text-primary hover:underline">
                Select All
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {permissionGroups.map((group) => {
              const groupSelected = group.permissions.filter((p) =>
                form.permissions.includes(p),
              ).length;
              const allGroupSelected = groupSelected === group.permissions.length;
              const someGroupSelected = groupSelected > 0 && !allGroupSelected;

              return (
                <div
                  key={group.label}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroupAll(group.permissions)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center border transition-all ${
                          allGroupSelected
                            ? 'bg-primary border-primary'
                            : someGroupSelected
                              ? 'bg-primary/30 border-primary'
                              : 'border-border bg-transparent'
                        }`}
                      >
                        {allGroupSelected && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                        {someGroupSelected && <div className="h-1.5 w-1.5 bg-primary rounded-sm" />}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{group.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {groupSelected}/{group.permissions.length}
                    </span>
                  </div>

                  {/* Permissions grid */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.permissions.map((perm) => {
                      const isSelected = form.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                            isSelected
                              ? 'bg-primary/5 border border-primary/20'
                              : 'border border-transparent'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-border bg-transparent'
                            }`}
                            onClick={() => togglePermission(perm)}
                          >
                            {isSelected && (
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {permissionLabels[perm]}
                            </p>
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
