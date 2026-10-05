import React, { useState, useMemo } from 'react';
import { useLov } from '@/features/lov';
import type {
  LovItem,
  LovAttribute,
  LovItemFormData,
  LovListFormData,
  LovAttributeType,
} from '@/features/lov';
import { useActivityLog } from '@/features/activity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Building2,
  Truck,
  Wrench,
  Package,
  Settings2,
  Search,
  Download,
  Database,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ListPlus,
  Columns,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';

// ─── Constants ────────────────────────────────────────────────────────────────

type Density = 'compact' | 'comfortable' | 'spacious';
type SortDir = 'asc' | 'desc' | null;
type ModalMode = 'item' | 'list' | 'attributes' | null;

const LIST_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DEPARTMENTS: Building2,
  VEHICLE_TYPES: Truck,
  MAINTENANCE_CATEGORIES: Wrench,
  VENDORS: Package,
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

const CATEGORY_COLORS: Record<string, string> = {
  heavy: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  special: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  light: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

// ─── Helper Components ────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : 'secondary'}
      className={
        active
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
          : 'bg-muted text-muted-foreground border border-border'
      }
    >
      {active ? '● Active' : '○ Inactive'}
    </Badge>
  );
}

function ActionButtons({
  onEdit,
  onDelete,
  confirmId,
  id,
  onConfirm,
  onCancel,
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
          <button
            onClick={onConfirm}
            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title="Confirm Delete"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SortableHead({
  children,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  children: React.ReactNode;
  field: string;
  sortField: string | null;
  sortDir: SortDir;
  onSort: (f: string) => void;
}) {
  const isActive = sortField === field;
  return (
    <th
      className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-muted-foreground">
          {isActive && sortDir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : isActive && sortDir === 'desc' ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40" />
          )}
        </span>
      </div>
    </th>
  );
}

// ─── Tweak Panel ──────────────────────────────────────────────────────────────

interface TweakSettings {
  density: Density;
  showCode: boolean;
  showStatus: boolean;
  attrVisibility: Record<string, boolean>;
  striped: boolean;
  bordered: boolean;
  highlightHover: boolean;
}

function defaultTweakForAttrs(attrs: LovAttribute[]): TweakSettings {
  const vis: Record<string, boolean> = {};
  attrs.forEach((a) => {
    vis[a.key] = a.showInGrid;
  });
  return {
    density: 'comfortable',
    showCode: true,
    showStatus: true,
    attrVisibility: vis,
    striped: false,
    bordered: true,
    highlightHover: true,
  };
}

function TweakPanel({
  settings,
  onChange,
  attributes,
  onClose,
}: {
  settings: TweakSettings;
  onChange: (s: TweakSettings) => void;
  attributes: LovAttribute[];
  onClose: () => void;
}) {
  const toggleBool = (key: keyof TweakSettings) => onChange({ ...settings, [key]: !settings[key] });

  const toggleAttr = (attrKey: string) =>
    onChange({
      ...settings,
      attrVisibility: { ...settings.attrVisibility, [attrKey]: !settings.attrVisibility[attrKey] },
    });

  const ToggleRow = ({
    label,
    checked,
    onToggle,
  }: {
    label: string;
    checked: boolean;
    onToggle: () => void;
  }) => (
    <label className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 cursor-pointer group">
      <span className="text-sm text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
      <div
        onClick={onToggle}
        className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </div>
    </label>
  );

  return (
    <div className="w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings2 className="h-4 w-4 text-primary" />
          Table Settings
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Density */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Row Density
          </p>
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Column Visibility
          </p>
          <ToggleRow
            label="Code / Key"
            checked={settings.showCode}
            onToggle={() => toggleBool('showCode')}
          />
          <ToggleRow
            label="Status"
            checked={settings.showStatus}
            onToggle={() => toggleBool('showStatus')}
          />
          {attributes.map((attr) => (
            <ToggleRow
              key={attr.key}
              label={attr.label}
              checked={settings.attrVisibility[attr.key] ?? true}
              onToggle={() => toggleAttr(attr.key)}
            />
          ))}
        </div>

        {/* Style */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Table Style
          </p>
          <ToggleRow
            label="Striped rows"
            checked={settings.striped}
            onToggle={() => toggleBool('striped')}
          />
          <ToggleRow
            label="Bordered cells"
            checked={settings.bordered}
            onToggle={() => toggleBool('bordered')}
          />
          <ToggleRow
            label="Highlight on hover"
            checked={settings.highlightHover}
            onToggle={() => toggleBool('highlightHover')}
          />
        </div>

        <button
          onClick={() => onChange(defaultTweakForAttrs(attributes))}
          className="w-full text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg py-2 transition-colors hover:bg-accent"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ─── Attribute Value Renderer ─────────────────────────────────────────────────

function AttrCell({
  value,
  attr,
}: {
  value: string | number | boolean | undefined;
  attr: LovAttribute;
}) {
  if (value === undefined || value === '')
    return <span className="text-muted-foreground/50">—</span>;

  if (attr.type === 'boolean') {
    return <span>{value ? '✓' : '✗'}</span>;
  }

  if (attr.type === 'number') {
    return (
      <span className="font-mono">
        {Number(value).toLocaleString()}
        {attr.key.includes('km') ? ' km' : ''}
      </span>
    );
  }

  if (attr.type === 'select' && attr.key === 'category') {
    const color = CATEGORY_COLORS[String(value)] || 'bg-muted text-muted-foreground border-border';
    return (
      <span
        className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold border capitalize ${color}`}
      >
        {String(value)}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ReferenceDataPage() {
  const {
    lists,
    getAttributes,
    getItems,
    syncError,
    addList,
    addItem,
    updateItem,
    deleteItem,
    addAttribute,
    updateAttribute,
    deleteAttribute,
  } = useLov();
  const { addLog } = useActivityLog();
  const { success: toastSuccess } = useToast();

  const activeLists = lists.filter((l) => l.status === 'active');
  const [activeTabCode, setActiveTabCode] = useState<string>(activeLists[0]?.code || '');
  const activeList = lists.find((l) => l.code === activeTabCode);
  const activeAttrs = getAttributes(activeTabCode);
  const activeItems = getItems(activeTabCode);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showTweak, setShowTweak] = useState(false);
  const [tweakMap, setTweakMap] = useState<Record<string, TweakSettings>>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page on tab, search, or sort change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTabCode, search, sortField, sortDir]);

  // Item form state
  const [itemForm, setItemForm] = useState<LovItemFormData>({
    code: '',
    label: '',
    status: 'active',
    attrs: {},
  });
  // List form state
  const [listForm, setListForm] = useState<LovListFormData>({
    code: '',
    name: '',
    description: '',
    supportsHierarchy: false,
  });
  // Attribute form state
  const [attrForm, setAttrForm] = useState<Omit<LovAttribute, 'id' | 'listCode'>>({
    key: '',
    label: '',
    type: 'text',
    required: false,
    showInGrid: true,
    sortOrder: 0,
    options: [],
  });
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [attrOptionsText, setAttrOptionsText] = useState('');

  const tweak = tweakMap[activeTabCode] || defaultTweakForAttrs(activeAttrs);
  const setTweak = (s: TweakSettings) => setTweakMap((prev) => ({ ...prev, [activeTabCode]: s }));

  const showToast = (msg: string) => toastSuccess(msg);

  // ── Filtering & Sorting ─────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let result = activeItems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((item) => {
        if (item.code.toLowerCase().includes(q)) return true;
        if (item.label.toLowerCase().includes(q)) return true;
        return Object.values(item.attrs).some((v) => String(v).toLowerCase().includes(q));
      });
    }
    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        const av =
          sortField === 'code'
            ? a.code
            : sortField === 'label'
              ? a.label
              : String(a.attrs[sortField] ?? '');
        const bv =
          sortField === 'code'
            ? b.code
            : sortField === 'label'
              ? b.label
              : String(b.attrs[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return result;
  }, [activeItems, search, sortField, sortDir]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, startIndex, endIndex]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortField(null);
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Tab switching ───────────────────────────────────────────────────────

  const switchTab = (code: string) => {
    setActiveTabCode(code);
    setEditingId(null);
    setDeleteConfirmId(null);
    setModalMode(null);
    setSortField(null);
    setSortDir(null);
    setSearch('');
  };

  // ── Item form handlers ──────────────────────────────────────────────────

  const resetItemForm = () => {
    setItemForm({ code: '', label: '', status: 'active', attrs: {} });
    setEditingId(null);
    setModalMode(null);
  };

  const openAddItem = () => {
    const defaultAttrs: Record<string, string | number | boolean> = {};
    activeAttrs.forEach((a) => {
      if (a.type === 'number') defaultAttrs[a.key] = 0;
      else if (a.type === 'boolean') defaultAttrs[a.key] = false;
      else defaultAttrs[a.key] = '';
    });
    setItemForm({ code: '', label: '', status: 'active', attrs: defaultAttrs });
    setEditingId(null);
    setModalMode('item');
  };

  const openEditItem = (item: LovItem) => {
    setItemForm({
      code: item.code,
      label: item.label,
      status: item.status,
      attrs: { ...item.attrs },
    });
    setEditingId(item.id);
    setModalMode('item');
  };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateItem(editingId, itemForm);
      addLog({
        module: 'Reference Data',
        action: 'Updated',
        subject: `${activeList?.name}: ${itemForm.label}`,
        description: `Updated "${itemForm.label}" (${itemForm.code}) in ${activeList?.name}.`,
        severity: 'info',
        user: 'Admin',
      });
      showToast(`"${itemForm.label}" updated.`);
    } else {
      addItem(activeTabCode, itemForm);
      addLog({
        module: 'Reference Data',
        action: 'Created',
        subject: `${activeList?.name}: ${itemForm.label}`,
        description: `Added "${itemForm.label}" (${itemForm.code}) to ${activeList?.name}.`,
        severity: 'info',
        user: 'Admin',
      });
      showToast(`"${itemForm.label}" added.`);
    }
    resetItemForm();
  };

  const handleDeleteItem = (item: LovItem) => {
    deleteItem(item.id);
    setDeleteConfirmId(null);
    addLog({
      module: 'Reference Data',
      action: 'Deleted',
      subject: `${activeList?.name}: ${item.label}`,
      description: `Removed "${item.label}" (${item.code}) from ${activeList?.name}.`,
      severity: 'warning',
      user: 'Admin',
    });
    showToast(`"${item.label}" deleted.`);
  };

  // ── List form handlers ──────────────────────────────────────────────────

  const openAddList = () => {
    setListForm({ code: '', name: '', description: '', supportsHierarchy: false });
    setModalMode('list');
  };

  const handleListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code =
      listForm.code ||
      listForm.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '');
    addList({ ...listForm, code });
    addLog({
      module: 'Reference Data',
      action: 'Created',
      subject: `List: ${listForm.name}`,
      description: `Created new reference data list "${listForm.name}" (${code}).`,
      severity: 'info',
      user: 'Admin',
    });
    showToast(`List "${listForm.name}" created.`);
    setModalMode(null);
    setActiveTabCode(code);
  };

  // ── Attribute form handlers ─────────────────────────────────────────────

  const openManageAttributes = () => {
    setAttrForm({
      key: '',
      label: '',
      type: 'text',
      required: false,
      showInGrid: true,
      sortOrder: activeAttrs.length,
      options: [],
    });
    setAttrOptionsText('');
    setEditingAttrId(null);
    setModalMode('attributes');
  };

  const openEditAttribute = (attr: LovAttribute) => {
    setAttrForm({
      key: attr.key,
      label: attr.label,
      type: attr.type,
      required: attr.required,
      showInGrid: attr.showInGrid,
      sortOrder: attr.sortOrder,
      options: attr.options,
    });
    setAttrOptionsText(attr.options.join(', '));
    setEditingAttrId(attr.id);
  };

  const handleAttrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts =
      attrForm.type === 'select'
        ? attrOptionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const key =
      attrForm.key ||
      attrForm.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '');
    if (editingAttrId) {
      updateAttribute(editingAttrId, { ...attrForm, key, options: opts });
      addLog({
        module: 'Reference Data',
        action: 'Updated',
        subject: `Attribute: ${attrForm.label}`,
        description: `Updated attribute "${attrForm.label}" on list ${activeList?.name}.`,
        severity: 'info',
        user: 'Admin',
      });
      showToast(`Attribute "${attrForm.label}" updated.`);
    } else {
      addAttribute(activeTabCode, { ...attrForm, key, options: opts });
      addLog({
        module: 'Reference Data',
        action: 'Created',
        subject: `Attribute: ${attrForm.label}`,
        description: `Added attribute "${attrForm.label}" to list ${activeList?.name}.`,
        severity: 'info',
        user: 'Admin',
      });
      showToast(`Attribute "${attrForm.label}" added.`);
    }
    setAttrForm({
      key: '',
      label: '',
      type: 'text',
      required: false,
      showInGrid: true,
      sortOrder: activeAttrs.length,
      options: [],
    });
    setAttrOptionsText('');
    setEditingAttrId(null);
  };

  const handleDeleteAttribute = (attr: LovAttribute) => {
    deleteAttribute(attr.id);
    addLog({
      module: 'Reference Data',
      action: 'Deleted',
      subject: `Attribute: ${attr.label}`,
      description: `Removed attribute "${attr.label}" from list ${activeList?.name}.`,
      severity: 'warning',
      user: 'Admin',
    });
    showToast(`Attribute "${attr.label}" removed.`);
  };

  // ── CSV Export ──────────────────────────────────────────────────────────

  const exportCSV = () => {
    const visibleAttrs = activeAttrs.filter((a) => tweak.attrVisibility[a.key] !== false);
    const header = ['Code', 'Name', ...visibleAttrs.map((a) => a.label), 'Active'].join(',');
    const rows = filteredItems.map((item) => {
      const attrValues = visibleAttrs.map((a) => `"${String(item.attrs[a.key] ?? '')}"`);
      return [`"${item.code}"`, `"${item.label}"`, ...attrValues, item.status === 'active'].join(
        ',',
      );
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTabCode.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV.');
  };

  // ── Visible attribute columns ───────────────────────────────────────────

  const visibleAttrs = activeAttrs.filter((a) => tweak.attrVisibility[a.key] !== false);
  const densityClass = DENSITY_PADDING[tweak.density];
  const cellClass = `${densityClass} ${tweak.bordered ? 'border-r border-border last:border-r-0' : ''}`;
  const rowClass = (i: number) =>
    `${tweak.striped && i % 2 === 1 ? 'bg-muted/20' : ''} ${tweak.highlightHover ? 'hover:bg-muted/40' : ''} transition-colors`;

  return (
    <div className="space-y-5 animate-fade-in">
      {syncError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {syncError}
        </p>
      )}
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
            id="btn-manage-attrs"
            variant="outline"
            onClick={openManageAttributes}
            className="gap-2"
            title="Manage columns / attributes for this list"
          >
            <Columns className="h-4 w-4" />
            <span className="hidden sm:inline">Attributes</span>
          </Button>
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
          <Button id="btn-add-ref" onClick={openAddItem} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add New</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs — dynamic from LOV lists */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-full sm:w-fit overflow-x-auto items-center">
            {activeLists.map((list) => {
              const Icon = LIST_ICONS[list.code] || Database;
              const isActive = activeTabCode === list.code;
              const count = getItems(list.code).length;
              return (
                <button
                  key={list.code}
                  id={`ref-tab-${list.code.toLowerCase()}`}
                  onClick={() => switchTab(list.code)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{list.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <button
              onClick={openAddList}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Create new reference data list"
            >
              <ListPlus className="h-4 w-4" />
            </button>
          </div>

          {/* Search toolbar */}
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
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {search && (
              <span className="text-xs text-muted-foreground">Showing filtered results</span>
            )}
          </div>

          {/* Dynamic Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full caption-bottom text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {tweak.showCode && (
                    <SortableHead
                      field="code"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    >
                      Code
                    </SortableHead>
                  )}
                  <SortableHead
                    field="label"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  >
                    {activeList?.name === 'Vendors'
                      ? 'Vendor Name'
                      : activeList?.name
                        ? `${activeList.name.replace(/s$/, '')} Name`
                        : 'Name'}
                  </SortableHead>
                  {visibleAttrs.map((attr) => (
                    <SortableHead
                      key={attr.key}
                      field={attr.key}
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    >
                      {attr.label}
                    </SortableHead>
                  ))}
                  {tweak.showStatus && (
                    <th className="h-10 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  <th className="h-10 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        2 +
                        visibleAttrs.length +
                        (tweak.showCode ? 1 : 0) +
                        (tweak.showStatus ? 1 : 0)
                      }
                      className="text-center text-muted-foreground py-10 text-sm"
                    >
                      No items found.
                    </td>
                  </tr>
                )}
                {paginatedItems.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 ${rowClass(i)}`}
                  >
                    {tweak.showCode && (
                      <td className={`px-4 font-mono text-xs text-muted-foreground ${cellClass}`}>
                        {item.code}
                      </td>
                    )}
                    <td className={`px-4 font-medium ${cellClass}`}>{item.label}</td>
                    {visibleAttrs.map((attr) => (
                      <td
                        key={attr.key}
                        className={`px-4 text-sm ${attr.type === 'number' ? 'font-mono' : 'text-muted-foreground'} ${cellClass}`}
                      >
                        <AttrCell value={item.attrs[attr.key]} attr={attr} />
                      </td>
                    ))}
                    {tweak.showStatus && (
                      <td className={`px-4 ${cellClass}`}>
                        <StatusBadge active={item.status === 'active'} />
                      </td>
                    )}
                    <td className={`px-4 text-right ${cellClass}`}>
                      <ActionButtons
                        onEdit={() => openEditItem(item)}
                        onDelete={() => setDeleteConfirmId(item.id)}
                        confirmId={deleteConfirmId}
                        id={item.id}
                        onConfirm={() => handleDeleteItem(item)}
                        onCancel={() => setDeleteConfirmId(null)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          </div>

          {/* Row count summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {totalItems} total {activeList?.name?.toLowerCase() || 'items'}
              {sortField && (
                <span className="ml-2 text-primary">
                  • Sorted by {sortField} ({sortDir})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Tweak Panel */}
        {showTweak && (
          <div className="shrink-0">
            <TweakPanel
              settings={tweak}
              onChange={setTweak}
              attributes={activeAttrs}
              onClose={() => setShowTweak(false)}
            />
          </div>
        )}
      </div>

      {/* ── Item Form Modal ── */}
      <Dialog
        open={modalMode === 'item'}
        onOpenChange={(isOpen) => !isOpen && resetItemForm()}
        className="max-w-md"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">
            {editingId ? 'Edit' : 'Add'} {activeList?.name?.replace(/s$/, '') || 'Item'}
          </h3>
          <button
            type="button"
            onClick={resetItemForm}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleItemSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lov-item-code">Code</Label>
              <Input
                id="lov-item-code"
                value={itemForm.code}
                onChange={(e) => setItemForm({ ...itemForm, code: e.target.value.toUpperCase() })}
                placeholder="UNIQUE_CODE"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lov-item-label">Name / Label</Label>
              <Input
                id="lov-item-label"
                value={itemForm.label}
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                placeholder="Display name"
                required
              />
            </div>
          </div>

          {/* Dynamic attribute fields */}
          {activeAttrs.map((attr) => (
            <div key={attr.key} className="space-y-1.5">
              <Label htmlFor={`lov-attr-${attr.key}`}>{attr.label}</Label>
              {attr.type === 'text' && (
                <Input
                  id={`lov-attr-${attr.key}`}
                  value={String(itemForm.attrs[attr.key] ?? '')}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      attrs: { ...itemForm.attrs, [attr.key]: e.target.value },
                    })
                  }
                  required={attr.required}
                />
              )}
              {attr.type === 'number' && (
                <Input
                  id={`lov-attr-${attr.key}`}
                  type="number"
                  value={Number(itemForm.attrs[attr.key] ?? 0)}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      attrs: { ...itemForm.attrs, [attr.key]: Number(e.target.value) },
                    })
                  }
                  required={attr.required}
                />
              )}
              {attr.type === 'boolean' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id={`lov-attr-${attr.key}`}
                    type="checkbox"
                    checked={!!itemForm.attrs[attr.key]}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        attrs: { ...itemForm.attrs, [attr.key]: e.target.checked },
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-muted-foreground">Enabled</span>
                </label>
              )}
              {attr.type === 'select' && (
                <Select
                  id={`lov-attr-${attr.key}`}
                  value={String(itemForm.attrs[attr.key] ?? '')}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      attrs: { ...itemForm.attrs, [attr.key]: e.target.value },
                    })
                  }
                >
                  <option value="">Select...</option>
                  {attr.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id="lov-item-active"
              type="checkbox"
              checked={itemForm.status === 'active'}
              onChange={(e) =>
                setItemForm({ ...itemForm, status: e.target.checked ? 'active' : 'inactive' })
              }
              className="rounded"
            />
            <Label htmlFor="lov-item-active" className="cursor-pointer">
              Active
            </Label>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={resetItemForm} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingId ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── New List Modal ── */}
      <Dialog
        open={modalMode === 'list'}
        onOpenChange={(isOpen) => !isOpen && setModalMode(null)}
        className="max-w-md"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">Create New List</h3>
          <button
            type="button"
            onClick={() => setModalMode(null)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleListSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lov-list-name">List Name</Label>
            <Input
              id="lov-list-name"
              value={listForm.name}
              onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
              placeholder="e.g. Nature of Request"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lov-list-code">Code (auto-generated if blank)</Label>
            <Input
              id="lov-list-code"
              value={listForm.code}
              onChange={(e) =>
                setListForm({
                  ...listForm,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                })
              }
              placeholder="NATURE_OF_REQUEST"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lov-list-desc">Description</Label>
            <Input
              id="lov-list-desc"
              value={listForm.description}
              onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
              placeholder="Short description"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={listForm.supportsHierarchy}
              onChange={(e) => setListForm({ ...listForm, supportsHierarchy: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-foreground">Supports hierarchy (parent/child items)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalMode(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create List
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Manage Attributes Modal ── */}
      <Dialog
        open={modalMode === 'attributes'}
        onOpenChange={(isOpen) => !isOpen && setModalMode(null)}
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">Attributes — {activeList?.name}</h3>
          <button
            type="button"
            onClick={() => setModalMode(null)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing attributes */}
        {activeAttrs.length > 0 && (
          <div className="space-y-2 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current Attributes
            </p>
            {activeAttrs.map((attr) => (
              <div
                key={attr.id}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">{attr.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs font-mono">{attr.key}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {attr.type}
                  </Badge>
                  {attr.required && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditAttribute(attr)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!activeList?.isSystem && (
                    <button
                      onClick={() => handleDeleteAttribute(attr)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / edit attribute form */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {editingAttrId ? 'Edit Attribute' : 'Add Attribute'}
          </p>
          <form onSubmit={handleAttrSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="attr-label">Label</Label>
                <Input
                  id="attr-label"
                  value={attrForm.label}
                  onChange={(e) => setAttrForm({ ...attrForm, label: e.target.value })}
                  placeholder="Display Name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attr-type">Type</Label>
                <Select
                  id="attr-type"
                  value={attrForm.type}
                  onChange={(e) =>
                    setAttrForm({ ...attrForm, type: e.target.value as LovAttributeType })
                  }
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="select">Select (dropdown)</option>
                </Select>
              </div>
            </div>

            {attrForm.type === 'select' && (
              <div className="space-y-1.5">
                <Label htmlFor="attr-options">Options (comma-separated)</Label>
                <Input
                  id="attr-options"
                  value={attrOptionsText}
                  onChange={(e) => setAttrOptionsText(e.target.value)}
                  placeholder="light, medium, heavy, special"
                  required
                />
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={attrForm.required}
                  onChange={(e) => setAttrForm({ ...attrForm, required: e.target.checked })}
                  className="rounded"
                />
                Required
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={attrForm.showInGrid}
                  onChange={(e) => setAttrForm({ ...attrForm, showInGrid: e.target.checked })}
                  className="rounded"
                />
                Show in table
              </label>
            </div>

            <div className="flex gap-3">
              {editingAttrId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingAttrId(null);
                    setAttrForm({
                      key: '',
                      label: '',
                      type: 'text',
                      required: false,
                      showInGrid: true,
                      sortOrder: activeAttrs.length,
                      options: [],
                    });
                    setAttrOptionsText('');
                  }}
                  className="flex-1"
                >
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" className="flex-1">
                {editingAttrId ? 'Update Attribute' : 'Add Attribute'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* (toast rendered globally) */}
    </div>
  );
}
