import React, { useState } from 'react';
import {
  useReferenceData,
  type Department,
  type VehicleType,
  type MaintenanceCategory,
  type Vendor,
} from './ReferenceDataContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../ui/table';
import {
  Plus, Pencil, Trash2, X, Check, Building2, Truck, Wrench, Package,
  Settings2, Columns, AlignJustify, AlignLeft, Search, Download, Filter,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = 'departments' | 'vehicle_types' | 'maintenance_categories' | 'vendors';
type Density = 'compact' | 'comfortable' | 'spacious';
type SortDir = 'asc' | 'desc' | null;

interface TweakSettings {
  density: Density;
  showCode: boolean;
  showStatus: boolean;
  showHead: boolean;       // departments: head column
  showCategory: boolean;   // vehicle types: category column
  showPmsKm: boolean;      // vehicle types: pms km column
  showDescription: boolean;// categories: description column
  showContact: boolean;    // vendors: contact person
  showPhone: boolean;      // vendors: phone
  showSpecialization: boolean; // vendors: specialization
  striped: boolean;
  bordered: boolean;
  highlightHover: boolean;
  showCreatedAt: boolean;
}

const DEFAULT_TWEAK: TweakSettings = {
  density: 'comfortable',
  showCode: true,
  showStatus: true,
  showHead: true,
  showCategory: true,
  showPmsKm: true,
  showDescription: true,
  showContact: true,
  showPhone: true,
  showSpecialization: true,
  striped: false,
  bordered: true,
  highlightHover: true,
  showCreatedAt: false,
};

const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
};

const DENSITY_PADDING: Record<Density, string> = {
  compact: 'py-1.5',
  comfortable: 'py-3',
  spacious: 'py-5',
};

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : 'secondary'}
      className={active
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
        : 'bg-muted text-muted-foreground border border-border'}
    >
      {active ? '● Active' : '○ Inactive'}
    </Badge>
  );
}

// ─── Action Buttons ────────────────────────────────────────────────────────────

function ActionButtons({
  onEdit, onDelete, confirmId, id, onConfirm, onCancel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  confirmId: string | null;
  id: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onEdit}
        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        title="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {confirmId === id ? (
        <>
          <button onClick={onConfirm} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors" title="Confirm Delete">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors" title="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortableHead({
  children, field, sortField, sortDir, onSort,
}: {
  children: React.ReactNode;
  field: string;
  sortField: string | null;
  sortDir: SortDir;
  onSort: (f: string) => void;
}) {
  const isActive = sortField === field;
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-muted-foreground">
          {isActive && sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> :
           isActive && sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> :
           <ChevronsUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </div>
    </TableHead>
  );
}

// ─── Tweak Panel ──────────────────────────────────────────────────────────────

function TweakPanel({
  settings, onChange, activeTab, onClose,
}: {
  settings: TweakSettings;
  onChange: (s: TweakSettings) => void;
  activeTab: ActiveTab;
  onClose: () => void;
}) {
  const toggle = (key: keyof TweakSettings) =>
    onChange({ ...settings, [key]: !settings[key] });

  const CheckRow = ({
    label, k,
  }: { label: string; k: keyof TweakSettings }) => (
    <label className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 cursor-pointer group">
      <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
      <div
        onClick={() => toggle(k)}
        className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${
          settings[k] ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          settings[k] ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </div>
    </label>
  );

  return (
    <div className="w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings2 className="h-4 w-4 text-primary" />
          Table Settings
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Density */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Row Density</p>
          <div className="grid grid-cols-3 gap-1.5 bg-muted/40 p-1 rounded-lg">
            {(['compact', 'comfortable', 'spacious'] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => onChange({ ...settings, density: d })}
                className={`py-1.5 rounded-md text-xs font-medium transition-all ${
                  settings.density === d
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {DENSITY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Column Visibility */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Column Visibility</p>
          <CheckRow label="Code / Key" k="showCode" />
          <CheckRow label="Status" k="showStatus" />
          {activeTab === 'departments' && <CheckRow label="Department Head" k="showHead" />}
          {activeTab === 'vehicle_types' && (
            <>
              <CheckRow label="Category" k="showCategory" />
              <CheckRow label="PMS Interval" k="showPmsKm" />
            </>
          )}
          {activeTab === 'maintenance_categories' && (
            <CheckRow label="Description" k="showDescription" />
          )}
          {activeTab === 'vendors' && (
            <>
              <CheckRow label="Contact Person" k="showContact" />
              <CheckRow label="Phone" k="showPhone" />
              <CheckRow label="Specialization" k="showSpecialization" />
            </>
          )}
        </div>

        {/* Style options */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Table Style</p>
          <CheckRow label="Striped rows" k="striped" />
          <CheckRow label="Bordered cells" k="bordered" />
          <CheckRow label="Highlight on hover" k="highlightHover" />
        </div>

        {/* Reset */}
        <button
          onClick={() => onChange(DEFAULT_TWEAK)}
          className="w-full text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg py-2 transition-colors hover:bg-accent"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function ReferenceDataPage() {
  const {
    departments, addDepartment, updateDepartment, deleteDepartment,
    vehicleTypes, addVehicleType, updateVehicleType, deleteVehicleType,
    maintenanceCategories, addMaintenanceCategory, updateMaintenanceCategory, deleteMaintenanceCategory,
    vendors, addVendor, updateVendor, deleteVendor,
  } = useReferenceData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('departments');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showTweak, setShowTweak] = useState(false);
  const [tweak, setTweak] = useState<TweakSettings>(DEFAULT_TWEAK);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Forms
  const [deptForm, setDeptForm] = useState<Omit<Department, 'id'>>({ code: '', name: '', head: '', isActive: true });
  const [vtForm, setVtForm] = useState<Omit<VehicleType, 'id'>>({ code: '', label: '', category: 'light', pmsIntervalKm: 5000, isActive: true });
  const [mcForm, setMcForm] = useState<Omit<MaintenanceCategory, 'id'>>({ code: '', name: '', description: '', isActive: true });
  const [vendorForm, setVendorForm] = useState<Omit<Vendor, 'id'>>({ name: '', contactPerson: '', phone: '', specialization: '', isActive: true });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const resetForms = () => {
    setEditingId(null); setShowForm(false);
    setDeptForm({ code: '', name: '', head: '', isActive: true });
    setVtForm({ code: '', label: '', category: 'light', pmsIntervalKm: 5000, isActive: true });
    setMcForm({ code: '', name: '', description: '', isActive: true });
    setVendorForm({ name: '', contactPerson: '', phone: '', specialization: '', isActive: true });
  };

  const openAdd = () => { resetForms(); setShowForm(true); };

  const openEdit = (item: any) => {
    const { id, ...rest } = item;
    setEditingId(id);
    if (activeTab === 'departments') setDeptForm(rest);
    if (activeTab === 'vehicle_types') setVtForm(rest);
    if (activeTab === 'maintenance_categories') setMcForm(rest);
    if (activeTab === 'vendors') setVendorForm(rest);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'departments') {
      editingId ? (updateDepartment(editingId, deptForm), showToast(`"${deptForm.name}" updated.`))
                : (addDepartment(deptForm), showToast(`"${deptForm.name}" added.`));
    } else if (activeTab === 'vehicle_types') {
      editingId ? (updateVehicleType(editingId, vtForm), showToast(`"${vtForm.label}" updated.`))
                : (addVehicleType(vtForm), showToast(`"${vtForm.label}" added.`));
    } else if (activeTab === 'maintenance_categories') {
      editingId ? (updateMaintenanceCategory(editingId, mcForm), showToast(`"${mcForm.name}" updated.`))
                : (addMaintenanceCategory(mcForm), showToast(`"${mcForm.name}" added.`));
    } else if (activeTab === 'vendors') {
      editingId ? (updateVendor(editingId, vendorForm), showToast(`"${vendorForm.name}" updated.`))
                : (addVendor(vendorForm), showToast(`"${vendorForm.name}" added.`));
    }
    resetForms();
  };

  const handleDelete = (id: string, name: string) => {
    if (activeTab === 'departments') deleteDepartment(id);
    else if (activeTab === 'vehicle_types') deleteVehicleType(id);
    else if (activeTab === 'maintenance_categories') deleteMaintenanceCategory(id);
    else if (activeTab === 'vendors') deleteVendor(id);
    setDeleteConfirmId(null);
    showToast(`"${name}" deleted.`);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortField(null);
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortFn = (a: any, b: any) => {
    if (!sortField || !sortDir) return 0;
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  };

  // ── Filtered & sorted data ─────────────────────────────────────────────────
  const filterFn = (item: any) =>
    Object.values(item).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));

  const filteredDepts = departments.filter(filterFn).sort(sortFn);
  const filteredVts = vehicleTypes.filter(filterFn).sort(sortFn);
  const filteredMcs = maintenanceCategories.filter(filterFn).sort(sortFn);
  const filteredVendors = vendors.filter(filterFn).sort(sortFn);

  const TABS = [
    { id: 'departments' as ActiveTab, label: 'Departments', icon: Building2, count: departments.length },
    { id: 'vehicle_types' as ActiveTab, label: 'Vehicle Types', icon: Truck, count: vehicleTypes.length },
    { id: 'maintenance_categories' as ActiveTab, label: 'Maintenance', icon: Wrench, count: maintenanceCategories.length },
    { id: 'vendors' as ActiveTab, label: 'Vendors', icon: Package, count: vendors.length },
  ];

  const densityClass = DENSITY_PADDING[tweak.density];

  const rowClass = (i: number) =>
    `${tweak.striped && i % 2 === 1 ? 'bg-muted/20' : ''} ${tweak.highlightHover ? 'hover:bg-muted/40' : ''} transition-colors`;

  const cellClass = `${densityClass} ${tweak.bordered ? 'border-r border-border last:border-r-0' : ''}`;

  // CSV Export
  const exportCSV = () => {
    let rows: string[] = [];
    if (activeTab === 'departments') {
      rows = ['Code,Name,Head,Active', ...filteredDepts.map((d) => `${d.code},${d.name},${d.head},${d.isActive}`)];
    } else if (activeTab === 'vehicle_types') {
      rows = ['Code,Label,Category,PMS KM,Active', ...filteredVts.map((v) => `${v.code},${v.label},${v.category},${v.pmsIntervalKm},${v.isActive}`)];
    } else if (activeTab === 'maintenance_categories') {
      rows = ['Code,Name,Description,Active', ...filteredMcs.map((m) => `${m.code},${m.name},${m.description},${m.isActive}`)];
    } else {
      rows = ['Name,Contact,Phone,Specialization,Active', ...filteredVendors.map((v) => `${v.name},${v.contactPerson},${v.phone},${v.specialization},${v.isActive}`)];
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeTab}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV.');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reference Data</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage master data used in dropdowns and selections throughout the system.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            id="btn-tweak-ui"
            variant="outline"
            onClick={() => setShowTweak(!showTweak)}
            className={`gap-2 ${showTweak ? 'border-primary text-primary bg-primary/5' : ''}`}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Customize</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button id="btn-add-ref" onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add New</span>
          </Button>
        </div>
      </div>

      {/* Main content with optional tweak panel */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`ref-tab-${tab.id}`}
                  onClick={() => { setActiveTab(tab.id); resetForms(); setDeleteConfirmId(null); setSortField(null); setSortDir(null); setSearch(''); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toolbar: search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="ref-search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {search && (
              <span className="text-xs text-muted-foreground">
                Showing filtered results
              </span>
            )}
          </div>

          {/* ── Departments Table ── */}
          {activeTab === 'departments' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {tweak.showCode && (
                      <SortableHead field="code" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                        Code
                      </SortableHead>
                    )}
                    <SortableHead field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Department Name
                    </SortableHead>
                    {tweak.showHead && (
                      <SortableHead field="head" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                        Head
                      </SortableHead>
                    )}
                    {tweak.showStatus && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>}
                    <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepts.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No departments found.</td></tr>
                  )}
                  {filteredDepts.map((d, i) => (
                    <tr key={d.id} className={`border-b border-border last:border-0 ${rowClass(i)}`}>
                      {tweak.showCode && <td className={`px-4 font-mono text-xs text-muted-foreground ${cellClass}`}>{d.code}</td>}
                      <td className={`px-4 font-medium ${cellClass}`}>{d.name}</td>
                      {tweak.showHead && <td className={`px-4 text-sm text-muted-foreground ${cellClass}`}>{d.head}</td>}
                      {tweak.showStatus && <td className={`px-4 ${cellClass}`}><StatusBadge active={d.isActive} /></td>}
                      <td className={`px-4 text-right ${cellClass}`}>
                        <ActionButtons onEdit={() => openEdit(d)} onDelete={() => setDeleteConfirmId(d.id)} confirmId={deleteConfirmId} id={d.id} onConfirm={() => handleDelete(d.id, d.name)} onCancel={() => setDeleteConfirmId(null)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Vehicle Types Table ── */}
          {activeTab === 'vehicle_types' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {tweak.showCode && (
                      <SortableHead field="code" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Code</SortableHead>
                    )}
                    <SortableHead field="label" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Label</SortableHead>
                    {tweak.showCategory && (
                      <SortableHead field="category" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Category</SortableHead>
                    )}
                    {tweak.showPmsKm && (
                      <SortableHead field="pmsIntervalKm" sortField={sortField} sortDir={sortDir} onSort={handleSort}>PMS Interval</SortableHead>
                    )}
                    {tweak.showStatus && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>}
                    <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVts.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No vehicle types found.</td></tr>
                  )}
                  {filteredVts.map((v, i) => (
                    <tr key={v.id} className={`border-b border-border last:border-0 ${rowClass(i)}`}>
                      {tweak.showCode && <td className={`px-4 font-mono text-xs text-muted-foreground ${cellClass}`}>{v.code}</td>}
                      <td className={`px-4 font-medium ${cellClass}`}>{v.label}</td>
                      {tweak.showCategory && (
                        <td className={`px-4 ${cellClass}`}>
                          <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold border capitalize ${
                            v.category === 'heavy' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            v.category === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            v.category === 'special' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>{v.category}</span>
                        </td>
                      )}
                      {tweak.showPmsKm && <td className={`px-4 text-sm font-mono ${cellClass}`}>{v.pmsIntervalKm.toLocaleString()} km</td>}
                      {tweak.showStatus && <td className={`px-4 ${cellClass}`}><StatusBadge active={v.isActive} /></td>}
                      <td className={`px-4 text-right ${cellClass}`}>
                        <ActionButtons onEdit={() => openEdit(v)} onDelete={() => setDeleteConfirmId(v.id)} confirmId={deleteConfirmId} id={v.id} onConfirm={() => handleDelete(v.id, v.label)} onCancel={() => setDeleteConfirmId(null)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Maintenance Categories Table ── */}
          {activeTab === 'maintenance_categories' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {tweak.showCode && (
                      <SortableHead field="code" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Code</SortableHead>
                    )}
                    <SortableHead field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Category Name</SortableHead>
                    {tweak.showDescription && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>}
                    {tweak.showStatus && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>}
                    <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMcs.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-10 text-sm">No categories found.</td></tr>
                  )}
                  {filteredMcs.map((m, i) => (
                    <tr key={m.id} className={`border-b border-border last:border-0 ${rowClass(i)}`}>
                      {tweak.showCode && <td className={`px-4 font-mono text-xs text-muted-foreground ${cellClass}`}>{m.code}</td>}
                      <td className={`px-4 font-medium ${cellClass}`}>{m.name}</td>
                      {tweak.showDescription && <td className={`px-4 text-sm text-muted-foreground max-w-xs ${cellClass}`}>{m.description}</td>}
                      {tweak.showStatus && <td className={`px-4 ${cellClass}`}><StatusBadge active={m.isActive} /></td>}
                      <td className={`px-4 text-right ${cellClass}`}>
                        <ActionButtons onEdit={() => openEdit(m)} onDelete={() => setDeleteConfirmId(m.id)} confirmId={deleteConfirmId} id={m.id} onConfirm={() => handleDelete(m.id, m.name)} onCancel={() => setDeleteConfirmId(null)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Vendors Table ── */}
          {activeTab === 'vendors' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <SortableHead field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Vendor Name</SortableHead>
                    {tweak.showContact && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Person</th>}
                    {tweak.showPhone && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>}
                    {tweak.showSpecialization && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specialization</th>}
                    {tweak.showStatus && <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>}
                    <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No vendors found.</td></tr>
                  )}
                  {filteredVendors.map((v, i) => (
                    <tr key={v.id} className={`border-b border-border last:border-0 ${rowClass(i)}`}>
                      <td className={`px-4 font-medium ${cellClass}`}>{v.name}</td>
                      {tweak.showContact && <td className={`px-4 text-sm text-muted-foreground ${cellClass}`}>{v.contactPerson}</td>}
                      {tweak.showPhone && <td className={`px-4 text-sm font-mono ${cellClass}`}>{v.phone}</td>}
                      {tweak.showSpecialization && <td className={`px-4 text-sm text-muted-foreground ${cellClass}`}>{v.specialization}</td>}
                      {tweak.showStatus && <td className={`px-4 ${cellClass}`}><StatusBadge active={v.isActive} /></td>}
                      <td className={`px-4 text-right ${cellClass}`}>
                        <ActionButtons onEdit={() => openEdit(v)} onDelete={() => setDeleteConfirmId(v.id)} confirmId={deleteConfirmId} id={v.id} onConfirm={() => handleDelete(v.id, v.name)} onCancel={() => setDeleteConfirmId(null)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Row count */}
          <p className="text-xs text-muted-foreground">
            {activeTab === 'departments' && `${filteredDepts.length} of ${departments.length} departments`}
            {activeTab === 'vehicle_types' && `${filteredVts.length} of ${vehicleTypes.length} vehicle types`}
            {activeTab === 'maintenance_categories' && `${filteredMcs.length} of ${maintenanceCategories.length} categories`}
            {activeTab === 'vendors' && `${filteredVendors.length} of ${vendors.length} vendors`}
            {sortField && <span className="ml-2 text-primary">• Sorted by {sortField} ({sortDir})</span>}
          </p>
        </div>

        {/* Tweak Panel */}
        {showTweak && (
          <div className="shrink-0">
            <TweakPanel
              settings={tweak}
              onChange={setTweak}
              activeTab={activeTab}
              onClose={() => setShowTweak(false)}
            />
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForms} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                {editingId ? 'Edit' : 'Add'}{' '}
                {TABS.find((t) => t.id === activeTab)?.label.replace(/s$/, '')}
              </h3>
              <button onClick={resetForms} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === 'departments' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-dept-code">Code</Label>
                      <Input id="ref-dept-code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} placeholder="HR" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-dept-head">Department Head</Label>
                      <Input id="ref-dept-head" value={deptForm.head} onChange={(e) => setDeptForm({ ...deptForm, head: e.target.value })} placeholder="Juan Dela Cruz" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-dept-name">Department Name</Label>
                    <Input id="ref-dept-name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Human Resources" required />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input id="ref-dept-active" type="checkbox" checked={deptForm.isActive} onChange={(e) => setDeptForm({ ...deptForm, isActive: e.target.checked })} className="rounded" />
                    <Label htmlFor="ref-dept-active" className="cursor-pointer">Active</Label>
                  </label>
                </>
              )}

              {activeTab === 'vehicle_types' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-vt-code">Code</Label>
                      <Input id="ref-vt-code" value={vtForm.code} onChange={(e) => setVtForm({ ...vtForm, code: e.target.value.toUpperCase() })} placeholder="VAN" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-vt-pms">PMS Interval (km)</Label>
                      <Input id="ref-vt-pms" type="number" value={vtForm.pmsIntervalKm} onChange={(e) => setVtForm({ ...vtForm, pmsIntervalKm: Number(e.target.value) })} required min={100} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-vt-label">Label</Label>
                    <Input id="ref-vt-label" value={vtForm.label} onChange={(e) => setVtForm({ ...vtForm, label: e.target.value })} placeholder="Commuter Van" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-vt-cat">Category</Label>
                    <Select id="ref-vt-cat" value={vtForm.category} onChange={(e) => setVtForm({ ...vtForm, category: e.target.value as any })}>
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="heavy">Heavy</option>
                      <option value="special">Special Equipment</option>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input id="ref-vt-active" type="checkbox" checked={vtForm.isActive} onChange={(e) => setVtForm({ ...vtForm, isActive: e.target.checked })} className="rounded" />
                    <Label htmlFor="ref-vt-active" className="cursor-pointer">Active</Label>
                  </label>
                </>
              )}

              {activeTab === 'maintenance_categories' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-mc-code">Code</Label>
                    <Input id="ref-mc-code" value={mcForm.code} onChange={(e) => setMcForm({ ...mcForm, code: e.target.value.toUpperCase() })} placeholder="PMS" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-mc-name">Category Name</Label>
                    <Input id="ref-mc-name" value={mcForm.name} onChange={(e) => setMcForm({ ...mcForm, name: e.target.value })} placeholder="Preventive Maintenance" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-mc-desc">Description</Label>
                    <Input id="ref-mc-desc" value={mcForm.description} onChange={(e) => setMcForm({ ...mcForm, description: e.target.value })} placeholder="Short description..." />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input id="ref-mc-active" type="checkbox" checked={mcForm.isActive} onChange={(e) => setMcForm({ ...mcForm, isActive: e.target.checked })} className="rounded" />
                    <Label htmlFor="ref-mc-active" className="cursor-pointer">Active</Label>
                  </label>
                </>
              )}

              {activeTab === 'vendors' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-ven-name">Vendor / Shop Name</Label>
                    <Input id="ref-ven-name" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Auto Service Center" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-ven-contact">Contact Person</Label>
                      <Input id="ref-ven-contact" value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} placeholder="Juan Cruz" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-ven-phone">Phone</Label>
                      <Input id="ref-ven-phone" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="09XXXXXXXXX" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-ven-spec">Specialization</Label>
                    <Input id="ref-ven-spec" value={vendorForm.specialization} onChange={(e) => setVendorForm({ ...vendorForm, specialization: e.target.value })} placeholder="Brakes & Tires" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input id="ref-ven-active" type="checkbox" checked={vendorForm.isActive} onChange={(e) => setVendorForm({ ...vendorForm, isActive: e.target.checked })} className="rounded" />
                    <Label htmlFor="ref-ven-active" className="cursor-pointer">Active</Label>
                  </label>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForms} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">{editingId ? 'Save Changes' : 'Add Entry'}</Button>
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
