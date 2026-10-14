import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Copy,
  Download,
  GripVertical,
  Eye,
  Save,
  Send,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Undo2,
  Redo2,
  Plus,
  Search,
  SlidersHorizontal,
  Sliders,
  X,
  Layers,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  ListFilter,
  CheckSquare,
  Database,
  Truck,
  Info,
  ShieldCheck,
  GitBranch,
  Lock,
  ArrowLeft,
  AlertTriangle,
  Edit3,
  FolderKanban,
  Check,
  CheckCircle2,
  Tag,
  GitCompare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  ConfirmDialog,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FormRenderer } from './FormRenderer';
import { WorkflowDiagramPreview } from './WorkflowDiagramPreview';
import { TSRF_V1, TSRF_WORKFLOW } from './seed';
import { useLov } from '@/features/lov';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { validateFormDefinition, validateFormWorkflow, pruneWorkflowForFields } from './validation';
import { projectFormForRoleStage } from './preview';
import type {
  FieldType,
  FormDefinition,
  FormField,
  FormWorkflow,
  StageFieldPermission,
  SystemStatusCategory,
} from './types';
import type { FieldRule, RuleOperator } from './rules';
import { moveFieldWithinSections } from './reorder';
import { parseFormDefinitionImport } from './importSchema';
import { diffFormDefinitions, diffFormWorkflows } from './versionDiff';
import { resolveDraftSaveRequest } from './draftPersistence';
import { VersionReadAccess } from './VersionReadAccess';
import { createEditorHistory, editorHistoryReducer } from './editorHistory';
import { formatFieldOptions, parseFieldOptions } from './fieldConfiguration';

const PALETTE: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'select', label: 'Select' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'repeater', label: 'Repeater' },
  { type: 'lookup', label: 'LOV Lookup' },
  { type: 'entity_lookup', label: 'Fleet Vehicle' },
  { type: 'notice', label: 'Notice' },
];

const PALETTE_META: Record<
  FieldType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  text: { label: 'Text Input', icon: Type, description: 'Single line text' },
  textarea: { label: 'Long Text', icon: AlignLeft, description: 'Multi-line notes' },
  number: { label: 'Number', icon: Hash, description: 'Numeric values' },
  date: { label: 'Date', icon: Calendar, description: 'Calendar picker' },
  time: { label: 'Time', icon: Clock, description: 'Time selector' },
  select: { label: 'Select Dropdown', icon: ListFilter, description: 'Predefined choices' },
  checkbox: { label: 'Checkbox', icon: CheckSquare, description: 'Yes / No toggle' },
  repeater: { label: 'Repeater Table', icon: Layers, description: 'Dynamic row items' },
  lookup: { label: 'LOV Lookup', icon: Database, description: 'System reference data' },
  entity_lookup: { label: 'Fleet Vehicle', icon: Truck, description: 'Vehicle / driver records' },
  notice: { label: 'Notice Banner', icon: Info, description: 'Read-only guidance' },
};
const WORKFLOW_ROLES = [
  'department_requester',
  'approver',
  'finance',
  'fleet_team',
  'procurement',
  'admin',
];
const STATUS_CATEGORIES: SystemStatusCategory[] = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

function flattenPermissionFields(
  fields: FormField[],
  prefix = '',
): Array<{ key: string; label: string }> {
  return fields.flatMap((field) => {
    const key = prefix ? `${prefix}.${field.key}` : field.key;
    return [
      { key, label: `${prefix ? `${prefix} / ` : ''}${field.label}` },
      ...flattenPermissionFields(field.rowFields ?? [], key),
    ];
  });
}

function collectFieldIds(fields: FormField[]): string[] {
  return fields.flatMap((field) => [field.id, ...collectFieldIds(field.rowFields ?? [])]);
}

function extractAllFieldKeys(def: FormDefinition | null | undefined): Set<string> {
  if (!def || !Array.isArray(def.sections)) return new Set();
  const keys = new Set<string>();
  const collect = (fieldsList: FormField[], prefix = '') => {
    fieldsList.forEach((f) => {
      const fullKey = prefix ? `${prefix}.${f.key}` : f.key;
      keys.add(fullKey);
      if (Array.isArray(f.rowFields)) {
        collect(f.rowFields, fullKey);
      }
    });
  };
  def.sections.forEach((sec) => {
    if (Array.isArray(sec.fields)) {
      collect(sec.fields);
    }
  });
  return keys;
}

export interface FormDirectoryItem {
  id: string;
  key: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  versionCount: number;
  publishedVersion: number | null;
  publishedVersionName: string | null;
  hasDraft: boolean;
  latestVersion: number;
}

function cloneDefinition(): FormDefinition {
  return structuredClone(TSRF_V1);
}

export function FormBuilderPage() {
  const {
    formKey: routeFormKey,
    version: routeVersion,
    role: routeRole,
    stage: routeStage,
  } = useParams<{
    formKey?: string;
    version?: string;
    role?: string;
    stage?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const activeFormKey = routeFormKey ?? searchParams.get('form') ?? 'tsrf';
  const basePath =
    activeFormKey !== 'tsrf'
      ? `/form-builder/forms/${encodeURIComponent(activeFormKey)}`
      : '/form-builder';

  const [availableForms, setAvailableForms] = useState<FormDirectoryItem[]>([]);
  const [formsDirectoryOpen, setFormsDirectoryOpen] = useState(false);
  const [formsDirectorySearch, setFormsDirectorySearch] = useState('');
  const [formsDirectoryFilter, setFormsDirectoryFilter] = useState<'all' | 'published' | 'draft'>(
    'all',
  );
  const [formsDirectorySort, setFormsDirectorySort] = useState<
    'name-asc' | 'name-desc' | 'versions'
  >('name-asc');
  const [formToDelete, setFormToDelete] = useState<FormDirectoryItem | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);
  const [newFormModalOpen, setNewFormModalOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormKey, setNewFormKey] = useState('');
  const [newFormVersionName, setNewFormVersionName] = useState('');
  const [newFormTemplate, setNewFormTemplate] = useState<'blank' | 'inspection' | 'tsrf'>('blank');
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  const loadAvailableForms = useCallback(async () => {
    try {
      const response = await apiFetch('/api/forms');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAvailableForms(data);
        }
      }
    } catch {
      // silently ignore fallback
    }
  }, []);

  useEffect(() => {
    void loadAvailableForms();
  }, [loadAvailableForms]);

  const deleteForm = async () => {
    if (!formToDelete) return;
    if (formToDelete.key === 'tsrf') {
      toastWarning('The TSRF template is a core system form and cannot be deleted.');
      setFormToDelete(null);
      return;
    }
    setIsDeletingForm(true);
    try {
      const response = await apiFetch(
        `/api/forms/${encodeURIComponent(formToDelete.id || formToDelete.key)}`,
        {
          method: 'DELETE',
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toastError(data.error || 'Failed to delete form template.');
        return;
      }
      toastSuccess(`Form "${formToDelete.name}" deleted successfully.`);
      const deletedKey = formToDelete.key;
      setFormToDelete(null);
      await loadAvailableForms();
      if (deletedKey === activeFormKey) {
        navigate('/form-builder');
      }
    } catch (error) {
      toastError((error as Error).message || 'Failed to delete form template.');
    } finally {
      setIsDeletingForm(false);
    }
  };

  const allFormsList = React.useMemo(() => {
    const list = [...availableForms];
    if (!list.some((f) => f.key === 'tsrf')) {
      list.unshift({
        id: 'tsrf-def',
        key: 'tsrf',
        name: 'Transportation Service Request Form',
        versionCount: 1,
        publishedVersion: 1,
        publishedVersionName: 'Standard',
        hasDraft: false,
        latestVersion: 1,
      });
    }
    return list;
  }, [availableForms]);

  const formsDirectoryCounts = React.useMemo(() => {
    const total = allFormsList.length;
    const published = allFormsList.filter((f) => Boolean(f.publishedVersion)).length;
    const draft = allFormsList.filter((f) => !f.publishedVersion).length;
    return { total, published, draft };
  }, [allFormsList]);

  const filteredFormsDirectory = React.useMemo(() => {
    let list = [...allFormsList];

    // Status filter
    if (formsDirectoryFilter === 'published') {
      list = list.filter((f) => Boolean(f.publishedVersion));
    } else if (formsDirectoryFilter === 'draft') {
      list = list.filter((f) => !f.publishedVersion);
    }

    // Text search filter
    if (formsDirectorySearch.trim()) {
      const q = formsDirectorySearch.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (f.publishedVersionName && f.publishedVersionName.toLowerCase().includes(q)),
      );
    }

    // Sorting
    if (formsDirectorySort === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (formsDirectorySort === 'versions') {
      list.sort((a, b) => b.versionCount - a.versionCount);
    } else {
      list.sort((a, b) => {
        if (a.key === 'tsrf') return -1;
        if (b.key === 'tsrf') return 1;
        const isTestA = a.key.startsWith('test-form-') || a.key.startsWith('invalid-form-');
        const isTestB = b.key.startsWith('test-form-') || b.key.startsWith('invalid-form-');
        if (isTestA !== isTestB) return isTestA ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }

    return list;
  }, [allFormsList, formsDirectoryFilter, formsDirectorySearch, formsDirectorySort]);

  const switchForm = (targetKey: string) => {
    if (targetKey === activeFormKey) {
      setFormsDirectoryOpen(false);
      return;
    }
    if (saving || editRevision > savedRevisionRef.current) {
      toastWarning('Save current changes before switching forms.');
      return;
    }
    setFormsDirectoryOpen(false);
    const targetPath =
      targetKey === 'tsrf'
        ? '/form-builder'
        : `/form-builder/forms/${encodeURIComponent(targetKey)}`;
    navigate(targetPath);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewFormTitle(val);
    if (!isKeyManuallyEdited) {
      const slug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setNewFormKey(slug);
    }
  };

  const handleCreateNewForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = newFormTitle.trim();
    const key = newFormKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    if (!title) {
      toastWarning('Please enter a form name.');
      return;
    }
    if (!key) {
      toastWarning('Please enter a valid form key (identifier).');
      return;
    }

    setIsCreatingForm(true);
    try {
      let initialSchema: FormDefinition;
      let initialWorkflow: FormWorkflow;

      if (newFormTemplate === 'tsrf') {
        initialSchema = {
          ...structuredClone(TSRF_V1),
          key,
          name: title,
          version: 1,
          versionName: newFormVersionName.trim() || 'v1 Initial Release',
          status: 'draft',
        };
        initialWorkflow = structuredClone(TSRF_WORKFLOW);
      } else if (newFormTemplate === 'inspection') {
        initialSchema = {
          key,
          name: title,
          version: 1,
          versionName: newFormVersionName.trim() || 'v1 Initial Release',
          status: 'draft',
          sections: [
            {
              id: 'sec-vehicle',
              title: 'Vehicle & Inspection Information',
              description: 'Select the fleet vehicle and record the initial reading.',
              fields: [
                {
                  id: `field-${Date.now()}-1`,
                  key: 'assignedVehicleId',
                  type: 'entity_lookup',
                  label: 'Vehicle Plate Number',
                  section: 'sec-vehicle',
                  required: true,
                  dataSource: {
                    kind: 'entity',
                    entity: 'vehicles',
                    valueField: 'id',
                    labelField: 'plateNumber',
                  },
                  width: 'half',
                },
                {
                  id: `field-${Date.now()}-2`,
                  key: 'odometerReading',
                  type: 'number',
                  label: 'Current Odometer (KM)',
                  section: 'sec-vehicle',
                  required: true,
                  placeholder: 'e.g. 52000',
                  width: 'half',
                },
              ],
            },
            {
              id: 'sec-checklist',
              title: 'Roadworthiness Checklist',
              description: 'Confirm physical checks before vehicle departure.',
              fields: [
                {
                  id: `field-${Date.now()}-3`,
                  key: 'brakesCheck',
                  type: 'checkbox',
                  label: 'Brakes & parking brake working properly',
                  section: 'sec-checklist',
                  required: true,
                  width: 'half',
                },
                {
                  id: `field-${Date.now()}-4`,
                  key: 'tiresCheck',
                  type: 'checkbox',
                  label: 'Tires pressure and condition inspected',
                  section: 'sec-checklist',
                  required: true,
                  width: 'half',
                },
                {
                  id: `field-${Date.now()}-5`,
                  key: 'lightsCheck',
                  type: 'checkbox',
                  label: 'All headlights, signals and hazards working',
                  section: 'sec-checklist',
                  required: true,
                  width: 'half',
                },
                {
                  id: `field-${Date.now()}-6`,
                  key: 'fluidsCheck',
                  type: 'checkbox',
                  label: 'Engine oil, coolant, and brake fluid checked',
                  section: 'sec-checklist',
                  required: true,
                  width: 'half',
                },
                {
                  id: `field-${Date.now()}-7`,
                  key: 'remarks',
                  type: 'textarea',
                  label: 'Inspector Remarks / Notes',
                  section: 'sec-checklist',
                  placeholder: 'Optional notes on vehicle condition or remarks...',
                  width: 'full',
                },
              ],
            },
          ],
        };
        initialWorkflow = {
          initialStage: 'submitted',
          stages: [
            { id: 'draft', label: 'Draft', statusCategory: 'draft' },
            { id: 'submitted', label: 'Submitted', statusCategory: 'in_review' },
            { id: 'approved', label: 'Approved', statusCategory: 'approved' },
            { id: 'completed', label: 'Completed', statusCategory: 'completed' },
          ],
          transitions: [
            {
              from: 'draft',
              to: 'submitted',
              roles: ['driver', 'department_requester', 'superadmin'],
              action: 'Submit',
            },
            {
              from: 'submitted',
              to: 'approved',
              roles: ['fleet_manager', 'superadmin'],
              action: 'Approve',
            },
            {
              from: 'approved',
              to: 'completed',
              roles: ['logistics_officer', 'fleet_manager', 'superadmin'],
              action: 'Complete',
            },
          ],
          cutoff: {
            time: '16:00',
            timezone: 'Asia/Manila',
            latePolicy: 'flag',
          },
        };
      } else {
        // Blank starter
        initialSchema = {
          key,
          name: title,
          version: 1,
          versionName: newFormVersionName.trim() || 'v1 Initial Release',
          status: 'draft',
          sections: [
            {
              id: 'sec-general',
              title: 'General Information',
              description: 'Initial intake fields for this form.',
              fields: [
                {
                  id: `field-${Date.now()}-1`,
                  key: 'title',
                  type: 'text',
                  label: 'Form Title / Subject',
                  section: 'sec-general',
                  required: true,
                  placeholder: 'Enter subject or title...',
                  width: 'full',
                },
              ],
            },
          ],
        };
        initialWorkflow = {
          initialStage: 'submitted',
          stages: [
            { id: 'draft', label: 'Draft', statusCategory: 'draft' },
            { id: 'submitted', label: 'Submitted', statusCategory: 'in_review' },
            { id: 'approved', label: 'Approved', statusCategory: 'approved' },
            { id: 'completed', label: 'Completed', statusCategory: 'completed' },
          ],
          transitions: [
            {
              from: 'draft',
              to: 'submitted',
              roles: ['department_requester', 'superadmin'],
              action: 'Submit',
            },
            {
              from: 'submitted',
              to: 'approved',
              roles: ['approver', 'department_head', 'superadmin'],
              action: 'Approve',
            },
            {
              from: 'approved',
              to: 'completed',
              roles: ['logistics_officer', 'superadmin'],
              action: 'Complete',
            },
          ],
          cutoff: {
            time: '16:00',
            timezone: 'Asia/Manila',
            latePolicy: 'flag',
          },
        };
      }

      const response = await apiFetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          name: title,
          versionName: initialSchema.versionName,
          schema: initialSchema,
          workflow: initialWorkflow,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to create new form.');
      }

      toastSuccess(`Form "${title}" created successfully!`);
      setNewFormModalOpen(false);
      setFormsDirectoryOpen(false);
      setNewFormTitle('');
      setNewFormKey('');
      setNewFormVersionName('');
      setIsKeyManuallyEdited(false);

      await loadAvailableForms();
      navigate(`/form-builder/forms/${encodeURIComponent(key)}`);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to create form.');
    } finally {
      setIsCreatingForm(false);
    }
  };

  const [editorHistory, dispatchEditorHistory] = useReducer(
    editorHistoryReducer,
    {
      definition: cloneDefinition(),
      workflow: structuredClone(TSRF_WORKFLOW),
    },
    createEditorHistory,
  );
  const definition = editorHistory.present.definition;
  const workflow = editorHistory.present.workflow;
  const [editRevision, setEditRevision] = useState(0);
  const [isDefinitionLoaded, setIsDefinitionLoaded] = useState(false);
  const savedRevisionRef = useRef(0);
  const autosaveErrorRevisionRef = useRef<number | null>(null);
  const saveDraftRef = useRef<(automatic: boolean, revision: number) => Promise<void>>(
    async () => undefined,
  );
  const setDefinition = (update: React.SetStateAction<FormDefinition>) => {
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'update',
      update: (snapshot) => ({
        ...snapshot,
        definition: typeof update === 'function' ? update(snapshot.definition) : update,
      }),
    });
  };
  const setWorkflow = (update: React.SetStateAction<FormWorkflow>) => {
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'update',
      update: (snapshot) => ({
        ...snapshot,
        workflow: typeof update === 'function' ? update(snapshot.workflow) : update,
      }),
    });
  };
  const [selectedId, setSelectedId] = useState(definition.sections[1]?.fields[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'canvas' | 'workflow' | 'permissions'>('canvas');
  const [sidebarTab, setSidebarTab] = useState<'palette' | 'outline'>('palette');
  const [paletteSearch, setPaletteSearch] = useState('');
  const [inspectorTab, setInspectorTab] = useState<'settings' | 'logic' | 'governance'>('settings');
  const [permissionFieldSearch, setPermissionFieldSearch] = useState('');
  const [mobileStudioView, setMobileStudioView] = useState<'canvas' | 'palette' | 'properties'>(
    'canvas',
  );
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRetireConfirmModal, setShowRetireConfirmModal] = useState(false);
  const [restrictedStagesToConfirm, setRestrictedStagesToConfirm] = useState<string[]>([]);
  const [showRestrictedConfirm, setShowRestrictedConfirm] = useState(false);
  const [retiredKeysToConfirm, setRetiredKeysToConfirm] = useState<string[]>([]);
  const [fieldToDeletePrompt, setFieldToDeletePrompt] = useState<{
    field: FormField;
    sectionId: string;
  } | null>(null);
  const [sectionToDeletePrompt, setSectionToDeletePrompt] = useState<{
    sectionId: string;
    title: string;
    publishedFieldKeys: string[];
  } | null>(null);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);

  const selectFieldAndScroll = (fieldId: string) => {
    setSelectedId(fieldId);
    if (window.innerWidth < 1024) {
      setMobileStudioView('properties');
    }
    propertiesPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [preview, setPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [publishedFieldIds, setPublishedFieldIds] = useState<Set<string>>(() => new Set());
  const [publishedBaseline, setPublishedBaseline] = useState<FormDefinition | null>(null);
  const [publishedWorkflowBaseline, setPublishedWorkflowBaseline] = useState<FormWorkflow | null>(
    null,
  );
  const publishedFieldKeys = React.useMemo(
    () => extractAllFieldKeys(publishedBaseline),
    [publishedBaseline],
  );
  const [availableVersions, setAvailableVersions] = useState<
    Array<{ id?: string; version: number; status: string; versionName?: string | null }>
  >([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showRenameFormModal, setShowRenameFormModal] = useState(false);
  const [showEditVersionNameModal, setShowEditVersionNameModal] = useState(false);
  const [showActivateVersionModal, setShowActivateVersionModal] = useState(false);
  const [isActivatingVersion, setIsActivatingVersion] = useState(false);
  const [editingFormName, setEditingFormName] = useState(definition.name);
  const [editingVersionName, setEditingVersionName] = useState(definition.versionName ?? '');
  const [isUpdatingFormName, setIsUpdatingFormName] = useState(false);
  const [isUpdatingVersionName, setIsUpdatingVersionName] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [permissionRole, setPermissionRole] = useState('department_requester');
  const [permissionStageId, setPermissionStageId] = useState('dispatch_assignment');
  const { lists } = useLov();
  const { currentUser } = useAuth();
  const fields = definition.sections.flatMap((section) => section.fields);
  const selectedField = fields.find((field) => field.id === selectedId);
  const permissionFields = flattenPermissionFields(fields);
  const selectedPermissionStage =
    workflow.stages.find((stage) => stage.id === permissionStageId) ?? workflow.stages[0];
  const previewProjection = selectedPermissionStage
    ? projectFormForRoleStage(definition, selectedPermissionStage, permissionRole)
    : { definition, fieldAccess: {} };
  const versionChanges =
    definition.status === 'draft' && publishedBaseline
      ? [
          ...diffFormDefinitions(publishedBaseline, definition),
          ...diffFormWorkflows(publishedWorkflowBaseline, workflow),
        ]
      : [];
  const previewUrl = (role: string, stageId: string) =>
    `${basePath}/preview/${encodeURIComponent(role)}/${encodeURIComponent(stageId)}${routeVersion ? `/${encodeURIComponent(routeVersion)}` : ''}`;
  const openPreview = () => {
    const stageId = selectedPermissionStage?.id ?? workflow.initialStage;
    navigate(previewUrl(permissionRole, stageId));
  };
  const leavePreview = () => {
    setPreview(false);
    navigate(routeVersion ? `${basePath}/versions/${routeVersion}` : basePath);
  };
  const selectVersion = (version: string) => {
    if (saving || editRevision > savedRevisionRef.current) {
      toastWarning('Save the current changes before switching versions.');
      return;
    }
    navigate(version === 'working' ? basePath : `${basePath}/versions/${version}`);
  };

  useEffect(() => {
    if (!isDefinitionLoaded) return;
    if (!routeRole && !routeStage) {
      setPreview(false);
      return;
    }
    if (
      !routeRole ||
      !routeStage ||
      !WORKFLOW_ROLES.includes(routeRole) ||
      !workflow.stages.some((stage) => stage.id === routeStage)
    ) {
      navigate(basePath, { replace: true });
      return;
    }
    setPermissionRole(routeRole);
    setPermissionStageId(routeStage);
    setPreview(true);
  }, [basePath, isDefinitionLoaded, navigate, routeRole, routeStage, workflow.stages]);

  useEffect(() => {
    let cancelled = false;
    setIsDefinitionLoaded(false);
    apiFetch(`/api/forms/${encodeURIComponent(activeFormKey)}`)
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Unable to load saved form versions.');
        return response.json();
      })
      .then((saved) => {
        if (cancelled) return;
        if (!saved) {
          setIsDefinitionLoaded(true);
          return;
        }
        setDefinitionId(saved.id);
        const versions = [...saved.versions].sort((a, b) => b.version - a.version);
        setAvailableVersions(
          versions.map((version) => ({
            id: version.id,
            version: version.version,
            status: version.status,
            versionName: version.versionName ?? version.schema?.versionName ?? null,
          })),
        );
        const published = versions.find((version) => version.status === 'published');
        setPublishedWorkflowBaseline(published?.workflow ?? null);
        setPublishedBaseline(
          published?.schema
            ? {
                ...published.schema,
                name: saved.name || published.schema.name,
                version: published.version,
                versionName: published.versionName ?? published.schema.versionName ?? null,
                status: 'published',
              }
            : null,
        );
        setPublishedFieldIds(
          published?.schema
            ? new Set(
                collectFieldIds(
                  published.schema.sections.flatMap(
                    (section: { fields?: FormField[] }) => section.fields ?? [],
                  ),
                ),
              )
            : new Set(),
        );
        const activeDraft = versions.find((version) => version.status === 'draft');
        const requestedVersion = routeVersion
          ? versions.find((version) => String(version.version) === routeVersion)
          : undefined;
        if (routeVersion && !requestedVersion) {
          toastWarning(`Form version ${routeVersion} was not found.`);
        }
        const selected =
          requestedVersion ??
          activeDraft ??
          versions.find((version) => version.status === 'published');
        if (selected?.schema) {
          savedRevisionRef.current = 0;
          setEditRevision(0);
          const resolvedVersionName = selected.versionName ?? selected.schema?.versionName ?? null;
          dispatchEditorHistory({
            type: 'reset',
            snapshot: {
              definition: {
                ...selected.schema,
                name: saved.name || selected.schema.name,
                version: selected.version,
                versionName: resolvedVersionName,
                status: selected.status,
              },
              workflow: selected.workflow?.stages
                ? selected.workflow
                : structuredClone(TSRF_WORKFLOW),
            },
          });
          setSelectedVersionId(selected.id ?? null);
          setDraftVersionId(selected.status === 'draft' ? selected.id : null);
          setSelectedId(
            selected.schema.sections[1]?.fields[0]?.id ??
              selected.schema.sections[0]?.fields[0]?.id ??
              '',
          );
        }
        setIsDefinitionLoaded(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toastError(error instanceof Error ? error.message : 'Unable to load form definition.');
          setIsDefinitionLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, activeFormKey, routeVersion]);

  const saveDraft = async (automatic = false, revision = editRevision) => {
    if (saving || saveInFlightRef.current) return;
    const saveRequest = resolveDraftSaveRequest({
      loaded: isDefinitionLoaded,
      definitionId,
      draftVersionId,
      hasChanges: revision > savedRevisionRef.current,
    });
    if (!saveRequest) {
      if (!automatic)
        toastWarning(isDefinitionLoaded ? 'No unsaved changes.' : 'Wait for the form to load.');
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const draft = { ...definition, status: 'draft' as const };
      const response = await apiFetch(saveRequest.url, {
        method: saveRequest.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: draft.key,
          name: draft.name,
          versionName: draft.versionName,
          schema: draft,
          workflow,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save draft.');

      // Safely extract version metadata whether returned as an object or top-level row
      const versionObj =
        typeof result.version === 'object' && result.version !== null ? result.version : result;
      const versionNum =
        typeof result.version === 'number'
          ? result.version
          : typeof versionObj?.version === 'number'
            ? versionObj.version
            : (definition.version ?? 1);
      const savedVersionId =
        (typeof versionObj?.id === 'string' ? versionObj.id : undefined) ?? result.id;
      const resolvedDefId =
        result.formDefinitionId ??
        versionObj?.formDefinitionId ??
        (typeof result.version === 'object' ? result.id : definitionId);

      if (resolvedDefId) setDefinitionId(resolvedDefId);
      if (savedVersionId) {
        setDraftVersionId(savedVersionId);
        setSelectedVersionId(savedVersionId);
      }

      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      autosaveErrorRevisionRef.current = null;

      dispatchEditorHistory({
        type: 'replace-present',
        update: (snapshot) => ({
          ...snapshot,
          definition: { ...snapshot.definition, version: versionNum, status: 'draft' },
        }),
      });

      setAvailableVersions((prev) => {
        const exists = prev.some((v) => v.version === versionNum);
        if (exists) {
          return prev.map((v) =>
            v.version === versionNum
              ? { ...v, id: savedVersionId, status: 'draft', versionName: draft.versionName }
              : v,
          );
        }
        return [
          {
            id: savedVersionId,
            version: versionNum,
            status: 'draft',
            versionName: draft.versionName,
          },
          ...prev,
        ].sort((a, b) => b.version - a.version);
      });

      if (!automatic) {
        toastSuccess(`Draft v${versionNum} saved successfully.`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to save draft.';
      if (automatic) {
        autosaveErrorRevisionRef.current = revision;
        toastError(`Autosave failed: ${detail}`);
      } else {
        toastError(detail);
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };
  saveDraftRef.current = saveDraft;

  useEffect(() => {
    if (
      !isDefinitionLoaded ||
      saving ||
      editRevision <= savedRevisionRef.current ||
      autosaveErrorRevisionRef.current === editRevision
    ) {
      return;
    }
    const revision = editRevision;
    const timer = window.setTimeout(() => {
      void saveDraftRef.current(true, revision);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editRevision, isDefinitionLoaded, saving]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editRevision > savedRevisionRef.current || saving) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editRevision, saving]);

  const removeFieldDirectly = (fieldId: string) => {
    let removedFieldLabel: string | null = null;
    const updatedSections = definition.sections.map((s) => {
      const match = s.fields.find((f) => f.id === fieldId);
      if (match) removedFieldLabel = match.label;
      return {
        ...s,
        fields: s.fields.filter((f) => f.id !== fieldId),
      };
    });
    const updatedDefinition = { ...definition, sections: updatedSections };
    const allRemainingFields = updatedSections.flatMap((s) => s.fields);
    const pruned = pruneWorkflowForFields(workflow, allRemainingFields);
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'apply',
      snapshot: { definition: updatedDefinition, workflow: pruned.workflow },
    });
    if (selectedId === fieldId) {
      setSelectedId('');
    }
    toastSuccess(removedFieldLabel ? `Field "${removedFieldLabel}" removed.` : 'Field removed.');
  };

  const publish = async (bypassRetireCheck = false, acknowledgeRestrictedStages: string[] = []) => {
    const pruned = pruneWorkflowForFields(workflow, fields);
    const activeWorkflow = pruned.workflow;
    if (pruned.modified) {
      setWorkflow(activeWorkflow);
    }
    const errors = [
      ...validateFormDefinition(definition, new Set(lists.map((list) => list.code))),
      ...validateFormWorkflow(activeWorkflow, fields),
    ];
    if (errors.length) {
      toastWarning(errors.join(' '));
      return;
    }
    if (!draftVersionId) {
      toastWarning('Save a draft before publishing.');
      return;
    }
    if (editRevision > savedRevisionRef.current) {
      toastWarning('Wait for the current draft changes to save before publishing.');
      return;
    }

    const currentPublishedKeys = extractAllFieldKeys(publishedBaseline);
    const currentKeys = extractAllFieldKeys(definition);
    const retiredKeys = [...currentPublishedKeys].filter((k) => !currentKeys.has(k));

    if (!bypassRetireCheck && retiredKeys.length > 0) {
      setRetiredKeysToConfirm(retiredKeys);
      setShowRetireConfirmModal(true);
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(draftVersionId)}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acknowledgeRestrictedStages,
            ...(retiredKeys.length > 0
              ? { confirmRetiredKeys: retiredKeys, acknowledgeFieldRetirement: true }
              : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.code === 'RESTRICTED_STAGE_ACCESS' && Array.isArray(result.restrictedStages)) {
          setRestrictedStagesToConfirm(result.restrictedStages);
          setShowRestrictedConfirm(true);
          return;
        }
        if (
          result.canRetire &&
          Array.isArray(result.removedKeys) &&
          result.removedKeys.length > 0
        ) {
          setRetiredKeysToConfirm(result.removedKeys);
          setShowRetireConfirmModal(true);
          return;
        }
        throw new Error(result.error ?? 'Unable to publish form.');
      }
      const published = {
        ...definition,
        version: result.version,
        versionName: result.versionName ?? definition.versionName,
        status: 'published' as const,
      };
      savedRevisionRef.current = editRevision;
      dispatchEditorHistory({
        type: 'reset',
        snapshot: { definition: published, workflow: activeWorkflow },
      });
      setPublishedBaseline(published);
      setPublishedWorkflowBaseline(activeWorkflow);
      setPublishedFieldIds(new Set(collectFieldIds(fields)));
      setDraftVersionId(null);
      setShowRetireConfirmModal(false);
      setShowRestrictedConfirm(false);

      setAvailableVersions((prev) =>
        prev
          .map((v) => {
            if (v.version === result.version)
              return { ...v, status: 'published', versionName: published.versionName };
            if (v.status === 'published') return { ...v, status: 'archived' };
            return v;
          })
          .sort((a, b) => b.version - a.version),
      );

      const retiredNote =
        result.retiredKeys && result.retiredKeys.length > 0
          ? ` (Retired fields: ${result.retiredKeys.join(', ')})`
          : '';
      toastSuccess(`Form v${result.version} published successfully!${retiredNote}`);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to publish form.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!draftVersionId) {
      toastWarning('No active draft version selected to delete.');
      return;
    }
    setIsDeletingDraft(true);
    try {
      const response = await apiFetch(`/api/forms/versions/${encodeURIComponent(draftVersionId)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to delete draft.');

      const deletedVer = result.deletedVersion ?? definition.version;
      toastSuccess(`Draft v${deletedVer} deleted successfully.`);

      const remainingVersions = availableVersions.filter((v) => v.version !== deletedVer);
      setAvailableVersions(remainingVersions);
      setShowDeleteConfirm(false);
      setDraftVersionId(null);

      // Navigate to latest published version if available, or base form-builder
      const latestPublished = remainingVersions.find((v) => v.status === 'published');
      const latestDraft = remainingVersions.find((v) => v.status === 'draft');
      const nextTarget = latestPublished ?? latestDraft;
      if (nextTarget) {
        navigate(`${basePath}/versions/${nextTarget.version}`);
      } else {
        navigate(basePath);
      }
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to delete draft.');
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const publishedVersionsList = React.useMemo(
    () => availableVersions.filter((v) => v.status === 'published'),
    [availableVersions],
  );
  const draftVersionsList = React.useMemo(
    () => availableVersions.filter((v) => v.status === 'draft'),
    [availableVersions],
  );
  const archivedVersionsList = React.useMemo(
    () => availableVersions.filter((v) => v.status === 'archived'),
    [availableVersions],
  );

  const handleRenameForm = async () => {
    const trimmed = editingFormName.trim();
    if (!trimmed) {
      toastWarning('Form template name cannot be empty.');
      return;
    }
    setIsUpdatingFormName(true);
    try {
      if (definitionId || activeFormKey) {
        const targetId = definitionId || activeFormKey;
        const response = await apiFetch(`/api/forms/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to rename form template.');
        }
      }
      dispatchEditorHistory({
        type: 'apply',
        snapshot: {
          definition: {
            ...definition,
            name: trimmed,
          },
          workflow,
        },
      });
      setEditRevision((rev) => rev + 1);
      setShowRenameFormModal(false);
      await loadAvailableForms();
      toastSuccess(`Form renamed to "${trimmed}".`);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to rename form.');
    } finally {
      setIsUpdatingFormName(false);
    }
  };

  const handleEditVersionName = async () => {
    const trimmed = editingVersionName.trim() || null;
    setIsUpdatingVersionName(true);
    try {
      const currentVerId = draftVersionId || selectedVersionId;
      if (currentVerId) {
        const response = await apiFetch(`/api/forms/versions/${encodeURIComponent(currentVerId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionName: trimmed }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update release label.');
        }
      }
      dispatchEditorHistory({
        type: 'apply',
        snapshot: {
          definition: {
            ...definition,
            versionName: trimmed ?? undefined,
          },
          workflow,
        },
      });
      setEditRevision((rev) => rev + 1);
      setAvailableVersions((prev) =>
        prev.map((v) => (v.version === definition.version ? { ...v, versionName: trimmed } : v)),
      );
      setShowEditVersionNameModal(false);
      await loadAvailableForms();
      toastSuccess(
        trimmed ? `Version release label set to "${trimmed}".` : 'Version release label cleared.',
      );
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to update release label.');
    } finally {
      setIsUpdatingVersionName(false);
    }
  };

  const handleSetActiveVersion = async () => {
    const targetId = selectedVersionId || draftVersionId;
    if (!targetId) return;
    setIsActivatingVersion(true);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(targetId)}/activate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate version.');
      }
      toastSuccess(`Version v${definition.version} is now the active live form template.`);
      setShowActivateVersionModal(false);

      // Clear the draft pointer – this version is now published, not a draft.
      setDraftVersionId(null);

      // Update status without bumping editRevision (which would trigger autosave)
      dispatchEditorHistory({
        type: 'replace-present',
        update: (snapshot) => ({
          ...snapshot,
          definition: { ...snapshot.definition, status: 'published' },
        }),
      });

      // Sync savedRevision so autosave doesn't re-trigger for the status-only change
      savedRevisionRef.current = editRevision;
      autosaveErrorRevisionRef.current = null;

      setAvailableVersions((prev) =>
        prev.map((v) => {
          if (v.id === targetId || v.version === definition.version) {
            return { ...v, status: 'published' };
          }
          if (v.status === 'published') {
            return { ...v, status: 'archived' };
          }
          return v;
        }),
      );
      await loadAvailableForms();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to activate form version.');
    } finally {
      setIsActivatingVersion(false);
    }
  };

  const undoEdit = () => {
    if (editorHistory.past.length === 0) return;
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({ type: 'undo' });
  };
  const redoEdit = () => {
    if (editorHistory.future.length === 0) return;
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({ type: 'redo' });
  };
  const updateField = (updates: Partial<FormField>) =>
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === selectedId ? { ...field, ...updates } : field,
        ),
      })),
    }));
  const updateRules = (rules: FieldRule[]) => updateField({ rules });
  const updateWorkflow = (updates: Partial<FormWorkflow>) =>
    setWorkflow((current) => ({ ...current, ...updates }));
  const updateStage = (index: number, updates: Partial<FormWorkflow['stages'][number]>) =>
    updateWorkflow({
      stages: workflow.stages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...updates } : stage,
      ),
    });
  const updateTransition = (index: number, updates: Partial<FormWorkflow['transitions'][number]>) =>
    updateWorkflow({
      transitions: workflow.transitions.map((transition, transitionIndex) =>
        transitionIndex === index ? { ...transition, ...updates } : transition,
      ),
    });
  const updateFieldPermission = (fieldKey: string, permission: '' | 'edit' | 'read' | 'hidden') => {
    if (!selectedPermissionStage) return;
    const stageIndex = workflow.stages.findIndex(
      (stage) => stage.id === selectedPermissionStage.id,
    );
    const currentFieldPermissions = selectedPermissionStage.fieldPermissions ?? {};
    const currentRoles = currentFieldPermissions[fieldKey] ?? {};
    const nextRoles = { ...currentRoles };
    if (permission) nextRoles[permissionRole] = permission;
    else delete nextRoles[permissionRole];
    const nextFieldPermissions = { ...currentFieldPermissions };
    if (Object.keys(nextRoles).length) nextFieldPermissions[fieldKey] = nextRoles;
    else delete nextFieldPermissions[fieldKey];
    updateStage(stageIndex, { fieldPermissions: nextFieldPermissions });
  };
  const addField = (type: FieldType, targetSectionId?: string) => {
    let sectionId = targetSectionId;
    if (!sectionId) {
      sectionId = selectedField ? selectedField.section : definition.sections[0]?.id;
    }
    const count = fields.filter((item) => item.type === type).length + 1;
    const baseKey = `${type}_${count}`;
    const field: FormField = {
      id: `field-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      key: baseKey,
      type,
      label: `New ${type.replace(/^[a-z]/, (m) => m.toUpperCase())}`,
      section: sectionId || 'trip-details',
      width: 'half',
      required: false,
      ...(type === 'select' ? { options: [{ value: 'option_1', label: 'Option 1' }] } : {}),
      ...(type === 'repeater'
        ? {
            minRows: 0,
            rowFields: [
              {
                id: `field-${Date.now()}-row-1`,
                key: 'item',
                type: 'text' as const,
                label: 'Item',
                section: sectionId || 'trip-details',
              },
            ],
          }
        : {}),
      ...(type === 'entity_lookup'
        ? {
            dataSource: {
              kind: 'entity' as const,
              entity: 'vehicles' as const,
              valueField: 'id' as const,
              labelField: 'plateNumber' as const,
            },
          }
        : {}),
    };
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, fields: [...section.fields, field] } : section,
      ),
    }));
    setSelectedId(field.id);
    if (window.innerWidth < 1024) {
      setMobileStudioView('canvas');
    }
    propertiesPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateField = (fieldId: string) => {
    setDefinition((current) => {
      let createdField: FormField | null = null;
      const newSections = current.sections.map((sec) => {
        const idx = sec.fields.findIndex((f) => f.id === fieldId);
        if (idx === -1) return sec;
        const target = sec.fields[idx];
        const newId = `field-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newKey = `${target.key}_copy_${Math.floor(Math.random() * 1000)}`;
        createdField = {
          ...structuredClone(target),
          id: newId,
          key: newKey,
          label: `${target.label} (Copy)`,
        };
        const updatedFields = [...sec.fields];
        updatedFields.splice(idx + 1, 0, createdField);
        return { ...sec, fields: updatedFields };
      });
      if (createdField) {
        setSelectedId((createdField as FormField).id);
        propertiesPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return { ...current, sections: newSections };
    });
  };
  const moveField = (targetId: string, toSectionId?: string) => {
    if (!draggedId || draggedId === targetId) return;
    setDefinition((current) => {
      let sourceSectionIndex = -1;
      let sourceFieldIndex = -1;
      let targetSectionIndex = -1;
      let targetFieldIndex = -1;

      current.sections.forEach((s, sIdx) => {
        const fIdx = s.fields.findIndex((f) => f.id === draggedId);
        if (fIdx >= 0) {
          sourceSectionIndex = sIdx;
          sourceFieldIndex = fIdx;
        }
        if (toSectionId) {
          if (s.id === toSectionId) {
            targetSectionIndex = sIdx;
          }
        } else {
          const tIdx = s.fields.findIndex((f) => f.id === targetId);
          if (tIdx >= 0) {
            targetSectionIndex = sIdx;
            targetFieldIndex = tIdx;
          }
        }
      });

      if (sourceSectionIndex < 0 || targetSectionIndex < 0) return current;

      const newSections = [...current.sections];
      const sourceSection = { ...newSections[sourceSectionIndex] };
      sourceSection.fields = [...sourceSection.fields];

      const [movedField] = sourceSection.fields.splice(sourceFieldIndex, 1);
      movedField.section = newSections[targetSectionIndex].id;

      if (sourceSectionIndex === targetSectionIndex) {
        if (toSectionId && targetFieldIndex === -1) {
          sourceSection.fields.push(movedField);
        } else {
          sourceSection.fields.splice(targetFieldIndex, 0, movedField);
        }
        newSections[sourceSectionIndex] = sourceSection;
      } else {
        const targetSection = { ...newSections[targetSectionIndex] };
        targetSection.fields = [...targetSection.fields];
        if (toSectionId && targetFieldIndex === -1) {
          targetSection.fields.push(movedField);
        } else {
          targetSection.fields.splice(targetFieldIndex, 0, movedField);
        }
        newSections[sourceSectionIndex] = sourceSection;
        newSections[targetSectionIndex] = targetSection;
      }

      return { ...current, sections: newSections };
    });
    setDraggedId(null);
  };
  const moveFieldByOffset = (fieldId: string, offset: -1 | 1) =>
    setDefinition((current) => ({
      ...current,
      sections: moveFieldWithinSections(current.sections, fieldId, offset),
    }));

  const addSection = () => {
    const newSectionId = `section-${Date.now()}`;
    setDefinition((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: newSectionId,
          title: 'New Section',
          fields: [],
        },
      ],
    }));
  };

  const updateSection = (id: string, updates: Partial<{ title: string; description: string }>) => {
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...updates } : section,
      ),
    }));
  };

  const performRemoveSection = (id: string) => {
    const targetSection = definition.sections.find((section) => section.id !== id);
    const sectionTitle = targetSection?.title || 'Section';
    const updatedSections = definition.sections.filter((section) => section.id !== id);
    const updatedDefinition = { ...definition, sections: updatedSections };
    const allRemainingFields = updatedSections.flatMap((s) => s.fields);
    const pruned = pruneWorkflowForFields(workflow, allRemainingFields);
    autosaveErrorRevisionRef.current = null;
    setEditRevision((revision) => revision + 1);
    dispatchEditorHistory({
      type: 'apply',
      snapshot: { definition: updatedDefinition, workflow: pruned.workflow },
    });
    if (
      targetSection?.fields.some((f) => f.id === selectedId) ||
      !allRemainingFields.some((f) => f.id === selectedId)
    ) {
      setSelectedId('');
    }
    toastSuccess(`Section "${sectionTitle}" removed.`);
  };

  const removeSection = (id: string) => {
    const targetSection = definition.sections.find((s) => s.id === id);
    const publishedFieldsInSection =
      targetSection?.fields.filter((f) => publishedFieldKeys.has(f.key)) ?? [];
    if (publishedFieldsInSection.length > 0) {
      setSectionToDeletePrompt({
        sectionId: id,
        title: targetSection?.title || 'Untitled Section',
        publishedFieldKeys: publishedFieldsInSection.map((f) => f.key),
      });
      return;
    }
    performRemoveSection(id);
  };

  const moveSectionByOffset = (sectionId: string, offset: -1 | 1) => {
    setDefinition((current) => {
      const idx = current.sections.findIndex((s) => s.id === sectionId);
      if (idx < 0 || idx + offset < 0 || idx + offset >= current.sections.length) return current;
      const next = [...current.sections];
      const [moved] = next.splice(idx, 1);
      next.splice(idx + offset, 0, moved);
      return { ...current, sections: next };
    });
  };

  const handleDragOverScroll = (e: React.DragEvent) => {
    e.preventDefault();
    const container = (e.currentTarget.closest('main') || document.documentElement) as HTMLElement;
    const rect = container.getBoundingClientRect();
    const buffer = 100;
    const speed = 20;

    if (e.clientY - rect.top < buffer) {
      container.scrollBy({ top: -speed, behavior: 'auto' });
    } else if (rect.bottom - e.clientY < buffer) {
      container.scrollBy({ top: speed, behavior: 'auto' });
    }
  };

  const setAllFieldPermissions = (access: '' | 'edit' | 'read' | 'hidden') => {
    if (!selectedPermissionStage) return;
    const nextPermissions: Record<string, Record<string, StageFieldPermission>> = {};
    const current = selectedPermissionStage.fieldPermissions ?? {};
    permissionFields.forEach((field) => {
      const fieldRoles = { ...(current[field.key] ?? {}) };
      if (access) {
        fieldRoles[permissionRole] = access;
      } else {
        delete fieldRoles[permissionRole];
      }
      if (Object.keys(fieldRoles).length > 0) {
        nextPermissions[field.key] = fieldRoles;
      }
    });
    const stageIndex = workflow.stages.findIndex((s) => s.id === selectedPermissionStage.id);
    if (stageIndex >= 0) {
      updateStage(stageIndex, { fieldPermissions: nextPermissions });
    }
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${definition.key}-v${definition.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const result = parseFormDefinitionImport(
        await file.text(),
        new Set(lists.map((list) => list.code)),
      );
      if (!result.definition) {
        toastWarning(result.errors.join(' '));
        return;
      }
      if (result.definition.key !== definition.key) {
        toastWarning(
          `This file is for "${result.definition.key}"; the current form is "${definition.key}".`,
        );
        return;
      }
      const imported = {
        ...result.definition,
        version: definition.version,
        status: 'draft' as const,
      };
      setDefinition(imported);
      setSelectedId(
        imported.sections.find((section) => section.fields.length > 0)?.fields[0].id ?? '',
      );
      toastSuccess('Schema imported locally. Save Draft to persist the changes.');
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Unable to read the JSON file.');
    }
  };

  if (preview)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Preview: {definition.name}</h1>
          <Button variant="outline" onClick={leavePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Back to Design
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="min-w-48">
            <label htmlFor="preview-stage" className="mb-1 block text-xs font-semibold">
              Workflow stage
            </label>
            <Select
              id="preview-stage"
              value={selectedPermissionStage?.id ?? ''}
              onChange={(event) => {
                const stageId = event.target.value;
                setPermissionStageId(stageId);
                navigate(previewUrl(permissionRole, stageId));
              }}
            >
              {workflow.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-48">
            <label htmlFor="preview-role" className="mb-1 block text-xs font-semibold">
              Role
            </label>
            <Select
              id="preview-role"
              value={permissionRole}
              onChange={(event) => {
                const role = event.target.value;
                setPermissionRole(role);
                navigate(previewUrl(role, selectedPermissionStage?.id ?? workflow.initialStage));
              }}
            >
              {WORKFLOW_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FormRenderer
          definition={previewProjection.definition}
          fieldAccess={previewProjection.fieldAccess}
          onSubmit={() => undefined}
          submitLabel="Preview"
        />
      </div>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Forms Directory & Switcher Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormsDirectoryOpen(true)}
            className="h-8 gap-2 px-3 text-xs font-semibold border-border/80 bg-background hover:bg-muted/60 shadow-sm"
            title="Browse all forms in directory"
          >
            <FolderKanban className="h-3.5 w-3.5 text-primary" />
            <span>All Forms</span>
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
              {allFormsList.length}
            </span>
          </Button>

          <span className="text-muted-foreground/40 font-light">/</span>

          <div className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-1 text-xs">
            <span className="font-semibold text-foreground max-w-[200px] sm:max-w-xs truncate">
              {definition.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50">
              {definition.key}
            </span>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setNewFormTitle('');
            setNewFormKey('');
            setNewFormVersionName('');
            setIsKeyManuallyEdited(false);
            setNewFormModalOpen(true);
          }}
          className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Form
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{definition.name}</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingFormName(definition.name);
                setShowRenameFormModal(true);
              }}
              title="Rename Master Form Template"
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Rename Form
            </Button>
            {definition.key !== 'tsrf' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs text-red-600 border-red-500/30 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-950/30"
                onClick={() => {
                  const target = availableForms.find((f) => f.key === definition.key) ?? {
                    id: definition.key,
                    key: definition.key,
                    name: definition.name,
                    versionCount: availableVersions.length || 1,
                    publishedVersion: publishedBaseline?.version ?? null,
                    publishedVersionName: definition.versionName ?? null,
                    hasDraft: Boolean(draftVersionId),
                    latestVersion: definition.version ?? 1,
                  };
                  setFormToDelete(target);
                }}
                title="Delete Form Template"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Form
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
              v{definition.version ?? 'draft'}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold capitalize ${
                definition.status === 'published'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : definition.status === 'draft'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-muted-foreground/30 bg-muted text-muted-foreground'
              }`}
            >
              {definition.status}
            </Badge>
            {definition.versionName && (
              <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs border border-primary/20">
                <Tag className="h-3 w-3" />
                {definition.versionName}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => {
                setEditingVersionName(definition.versionName ?? '');
                setShowEditVersionNameModal(true);
              }}
              title="Set friendly release name for this version"
            >
              <Tag className="h-3 w-3" />
              {definition.versionName ? 'Edit Label' : 'Tag Release'}
            </Button>
          </div>
        </div>

        {/* Studio Command Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Version Picker & Activation */}
          {availableVersions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="form-version" className="sr-only">
                Form version
              </label>
              <Select
                id="form-version"
                value={routeVersion ?? 'working'}
                onChange={(event) => selectVersion(event.target.value)}
                className="text-xs h-9 min-w-[210px] bg-background border-border/70"
              >
                <option value="working">Current working version</option>

                {publishedVersionsList.length > 0 && (
                  <optgroup label="Live Published Release">
                    {publishedVersionsList.map((item) => (
                      <option key={item.version} value={item.version}>
                        {item.versionName
                          ? `${item.versionName} (v${item.version})`
                          : `v${item.version}`}{' '}
                        [Live]
                      </option>
                    ))}
                  </optgroup>
                )}

                {draftVersionsList.length > 0 && (
                  <optgroup label="Working Drafts">
                    {draftVersionsList.map((item) => (
                      <option key={item.version} value={item.version}>
                        {item.versionName
                          ? `${item.versionName} (v${item.version})`
                          : `v${item.version}`}{' '}
                        [Draft]
                      </option>
                    ))}
                  </optgroup>
                )}

                {archivedVersionsList.length > 0 && (
                  <optgroup label="Archived Releases">
                    {archivedVersionsList.map((item) => (
                      <option key={item.version} value={item.version}>
                        {item.versionName
                          ? `${item.versionName} (v${item.version})`
                          : `v${item.version}`}{' '}
                        [Archived]
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>

              {definition.status !== 'published' && (selectedVersionId || draftVersionId) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivateVersionModal(true)}
                  disabled={isActivatingVersion || saving}
                  className="h-9 gap-1.5 px-3 text-xs font-semibold text-emerald-700 border-emerald-600/40 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 shadow-xs"
                  title={`Set version v${definition.version} as the active live template`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Set as Active
                </Button>
              )}
            </div>
          )}

          <div className="h-5 w-px bg-border/60 hidden sm:block mx-0.5" />

          {/* Canvas Tools */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium"
              onClick={openPreview}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="Undo"
              aria-label="Undo"
              disabled={editorHistory.past.length === 0}
              onClick={undoEdit}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="Redo"
              aria-label="Redo"
              disabled={editorHistory.future.length === 0}
              onClick={redoEdit}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border/60 hidden sm:block mx-0.5" />

          {/* Import / Export */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium"
              onClick={exportJson}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Import form definition JSON"
              onChange={importJson}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
          </div>

          <div className="h-5 w-px bg-border/60 hidden sm:block mx-0.5" />

          {/* Actions & Lifecycle */}
          <div className="flex items-center gap-1.5">
            {definition.status === 'draft' && Boolean(draftVersionId) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || isDeletingDraft}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Draft
              </Button>
            )}

            <Button
              size="sm"
              variant={
                editRevision > savedRevisionRef.current || !definitionId ? 'default' : 'outline'
              }
              className="h-9 gap-1.5 text-xs min-w-[88px]"
              onClick={() => void saveDraft()}
              disabled={
                saving ||
                !isDefinitionLoaded ||
                (Boolean(definitionId) && editRevision <= savedRevisionRef.current)
              }
            >
              <Save className="h-3.5 w-3.5" />
              {saving
                ? 'Saving...'
                : editRevision > savedRevisionRef.current || !definitionId
                  ? 'Save Draft'
                  : 'Saved'}
            </Button>

            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={() => void publish()}
              disabled={
                saving ||
                definition.status === 'published' ||
                editRevision > savedRevisionRef.current
              }
            >
              <Send className="h-3.5 w-3.5" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Draft Confirmation Modal */}
      <ConfirmDialog
        open={showRestrictedConfirm}
        onOpenChange={setShowRestrictedConfirm}
        onCancel={() => setShowRestrictedConfirm(false)}
        onConfirm={() => void publish(true, restrictedStagesToConfirm)}
        variant="warning"
        icon={ShieldCheck}
        title="Confirm Restricted Requestor Access"
        confirmText="Publish with Restricted Access"
        cancelText="Review Permissions"
        isLoading={saving}
      >
        <p className="text-sm">Missing permissions will hide request fields in these stages:</p>
        <ul className="list-disc pl-5 text-sm">
          {restrictedStagesToConfirm.map((stage) => (
            <li key={stage}>{stage}</li>
          ))}
        </ul>
      </ConfirmDialog>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void deleteDraft()}
        variant="destructive"
        icon={Trash2}
        title={`Delete Draft v${definition.version}?`}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 border border-red-500/20">
            v{definition.version} Draft
          </span>
        }
        confirmText="Delete Draft"
        cancelText="Cancel"
        isLoading={isDeletingDraft}
        className="max-w-md sm:max-w-lg"
      >
        <div className="space-y-3.5">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete this draft? Any unsaved edits or customizations in{' '}
            <strong className="text-foreground font-semibold">draft v{definition.version}</strong>{' '}
            will be permanently wiped.
          </p>

          <div className="rounded-xl border border-border/80 bg-muted/40 p-3 sm:p-3.5 space-y-1.5 text-xs">
            <div className="font-semibold text-foreground truncate">
              {definition.name || 'Form Draft'}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-mono">v{definition.version} (draft)</span>
              <span>·</span>
              <span>
                {definition.sections.length} section{definition.sections.length === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span>
                {fields.length} field{fields.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/10 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span className="leading-relaxed">
              Published baseline and historical form submissions are unaffected. This draft cannot
              be recovered once removed.
            </span>
          </div>
        </div>
      </ConfirmDialog>

      {/* Confirm Field Retirement Modal */}
      <ConfirmDialog
        open={showRetireConfirmModal}
        onOpenChange={setShowRetireConfirmModal}
        onCancel={() => setShowRetireConfirmModal(false)}
        onConfirm={() => void publish(true)}
        variant="warning"
        icon={ShieldCheck}
        title="Confirm Field Retirement"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
            v{definition.version} Release
          </span>
        }
        description={
          <>
            Publishing v{definition.version} will decommission{' '}
            <strong className="text-foreground font-semibold">
              {retiredKeysToConfirm.length} published field
              {retiredKeysToConfirm.length === 1 ? '' : 's'}
            </strong>
            .
          </>
        }
        confirmText={`Acknowledge & Publish v${definition.version}`}
        cancelText="Cancel"
        isLoading={saving}
        className="max-w-lg sm:max-w-xl"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-3.5 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Fields being retired in this release:
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto overscroll-contain pr-1">
              {retiredKeysToConfirm.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30"
                >
                  <Lock className="h-3 w-3 opacity-60" />
                  {key}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground bg-card border border-border/70 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
              <span>
                <strong className="text-foreground">Historical Data Preserved:</strong> All previous
                submissions retain their data for these fields for audit and compliance.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
              <span>
                <strong className="text-foreground">Clean Future Submissions:</strong> New
                submissions under version {definition.version} will no longer show or require these
                fields.
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      {/* Rename Form Template Modal */}
      <ConfirmDialog
        open={showRenameFormModal}
        onOpenChange={setShowRenameFormModal}
        onCancel={() => setShowRenameFormModal(false)}
        onConfirm={() => void handleRenameForm()}
        variant="primary"
        icon={Edit3}
        title="Rename Form Template"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20 font-mono">
            {definition.key}
          </span>
        }
        description="Update the master form template title. This change updates the name across system navigation, forms directories, and all versions."
        confirmText={isUpdatingFormName ? 'Saving...' : 'Save Form Name'}
        cancelText="Cancel"
        isLoading={isUpdatingFormName}
        className="max-w-md sm:max-w-lg"
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-form-name" className="text-xs font-semibold text-foreground">
              Form Template Name
            </label>
            <Input
              id="edit-form-name"
              value={editingFormName}
              onChange={(e) => setEditingFormName(e.target.value)}
              placeholder="e.g. Transportation Service Request Form"
              className="h-9 text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Master title for this form definition across the application.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Form Identifier (Key):</span>
              <span className="font-mono font-semibold text-foreground">{definition.key}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Version:</span>
              <span className="font-semibold text-foreground">
                v{definition.version ?? 'draft'} ({definition.status})
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      {/* Edit Version Release Label Modal */}
      <ConfirmDialog
        open={showEditVersionNameModal}
        onOpenChange={setShowEditVersionNameModal}
        onCancel={() => setShowEditVersionNameModal(false)}
        onConfirm={() => void handleEditVersionName()}
        variant="primary"
        icon={Tag}
        title={`Release Label for v${definition.version ?? 'draft'}`}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
            v{definition.version ?? 'draft'} · {definition.status}
          </span>
        }
        description="Give this specific version snapshot a friendly release tag (e.g. 'Standard', 'Q4 2026 Audit Revision'). This helps identify this release in audit logs, diffs, and reports."
        confirmText={isUpdatingVersionName ? 'Saving...' : 'Save Release Label'}
        cancelText="Cancel"
        isLoading={isUpdatingVersionName}
        className="max-w-md sm:max-w-lg"
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-version-name" className="text-xs font-semibold text-foreground">
              Version / Release Name
            </label>
            <Input
              id="edit-version-name"
              value={editingVersionName}
              onChange={(e) => setEditingVersionName(e.target.value)}
              placeholder="e.g. Standard, Q4 2026 Audit Revision, Phase 2"
              className="h-9 text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Descriptive release tag for this version snapshot. Leave empty to use default version
              number.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Form Template:</span>
              <span className="font-semibold text-foreground">{definition.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Target Version:</span>
              <span className="font-mono font-semibold text-foreground">
                v{definition.version ?? 'draft'}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      {/* Set as Active Confirmation Modal */}
      <ConfirmDialog
        open={showActivateVersionModal}
        onOpenChange={setShowActivateVersionModal}
        onCancel={() => setShowActivateVersionModal(false)}
        onConfirm={() => void handleSetActiveVersion()}
        variant="primary"
        icon={CheckCircle2}
        title={`Set Version v${definition.version ?? 'draft'} as Active?`}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            v{definition.version ?? 'draft'} · {definition.status}
          </span>
        }
        description={`Promote version v${definition.version ?? 'draft'} to become the active live published template. Any currently published version will be archived.`}
        confirmText={isActivatingVersion ? 'Activating...' : 'Set as Active'}
        cancelText="Cancel"
        isLoading={isActivatingVersion}
        className="max-w-md sm:max-w-lg"
      >
        <div className="space-y-3 py-2 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            New requests submitted by users will immediately use the schema and workflow from{' '}
            <strong className="text-foreground">Version v{definition.version}</strong>
            {definition.versionName ? ` ("${definition.versionName}")` : ''}.
          </p>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-1">
            <div className="flex justify-between">
              <span>Form Template:</span>
              <span className="font-semibold text-foreground">{definition.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Version to Activate:</span>
              <span className="font-semibold text-foreground">
                v{definition.version} {definition.versionName ? `(${definition.versionName})` : ''}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      {/* Forms Directory Modal */}
      <Dialog
        open={formsDirectoryOpen}
        onOpenChange={setFormsDirectoryOpen}
        className="max-w-2xl sm:max-w-3xl"
      >
        <DialogHeader className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold">Forms Directory</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Browse, search, and switch between form definitions across the system.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setFormsDirectoryOpen(false);
                setNewFormTitle('');
                setNewFormKey('');
                setNewFormVersionName('');
                setIsKeyManuallyEdited(false);
                setNewFormModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              New Form
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Search bar & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search forms by name, key, or release..."
                value={formsDirectorySearch}
                onChange={(e) => setFormsDirectorySearch(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-background"
              />
              {formsDirectorySearch && (
                <button
                  type="button"
                  onClick={() => setFormsDirectorySearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
              <Select
                value={formsDirectorySort}
                onChange={(e) =>
                  setFormsDirectorySort(e.target.value as 'name-asc' | 'name-desc' | 'versions')
                }
                className="h-9 text-xs bg-background w-full sm:w-auto min-w-[130px]"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="versions">Most Versions</option>
              </Select>
            </div>
          </div>

          {/* Filter Pills & Result Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setFormsDirectoryFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  formsDirectoryFilter === 'all'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All ({formsDirectoryCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setFormsDirectoryFilter('published')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5',
                  formsDirectoryFilter === 'published'
                    ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Published ({formsDirectoryCounts.published})
              </button>
              <button
                type="button"
                onClick={() => setFormsDirectoryFilter('draft')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5',
                  formsDirectoryFilter === 'draft'
                    ? 'bg-background text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Draft Only ({formsDirectoryCounts.draft})
              </button>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <span>
                Showing {filteredFormsDirectory.length} of {allFormsList.length}
              </span>
              {(formsDirectorySearch || formsDirectoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setFormsDirectorySearch('');
                    setFormsDirectoryFilter('all');
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Forms List Grid */}
          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1 overscroll-contain">
            {filteredFormsDirectory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    No forms match your criteria
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting the filter keyword or resetting active filters.
                  </p>
                </div>
                {(formsDirectorySearch || formsDirectoryFilter !== 'all') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormsDirectorySearch('');
                      setFormsDirectoryFilter('all');
                    }}
                    className="h-8 text-xs"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              filteredFormsDirectory.map((form) => {
                const isCurrent = form.key === definition.key;
                return (
                  <div
                    key={form.key}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 transition-all text-left',
                      isCurrent
                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-border/80 hover:bg-muted/30',
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">
                          {form.name}
                        </span>
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                          {form.key}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {form.publishedVersion ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />v
                            {form.publishedVersion} Published
                            {form.publishedVersionName ? ` (${form.publishedVersionName})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Draft only (v{form.latestVersion})
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          {form.versionCount} version{form.versionCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20">
                          <Check className="h-3 w-3" />
                          Currently Editing
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => switchForm(form.key)}
                          className="h-8 text-xs font-medium"
                        >
                          Switch to Form
                        </Button>
                      )}

                      {form.key !== 'tsrf' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormToDelete(form);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title={`Delete form template "${form.name}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span
                          className="text-[10px] font-semibold text-muted-foreground/50 uppercase px-1.5 py-0.5 rounded border border-border/40 select-none"
                          title="Core system form cannot be deleted"
                        >
                          System
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>

      {/* Delete Form Confirmation Modal */}
      {formToDelete && (
        <ConfirmDialog
          open={Boolean(formToDelete)}
          onOpenChange={(open) => !open && setFormToDelete(null)}
          onCancel={() => setFormToDelete(null)}
          onConfirm={() => void deleteForm()}
          variant="destructive"
          icon={Trash2}
          title={`Delete Form "${formToDelete.name}"?`}
          badge={
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 border border-red-500/20 font-mono">
              {formToDelete.key}
            </span>
          }
          confirmText="Delete Form"
          cancelText="Cancel"
          isLoading={isDeletingForm}
          className="max-w-md sm:max-w-lg"
        >
          <div className="space-y-3.5">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{formToDelete.name}</strong>? This will
              permanently remove the form template, all schema configurations, and its{' '}
              <strong className="text-foreground">{formToDelete.versionCount} version(s)</strong>.
            </p>

            {formToDelete.key === activeFormKey && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  This form is currently open in the editor. Upon deletion, you will be redirected
                  back to the default Transportation Service Request Form.
                </span>
              </div>
            )}

            <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Form Key:</span>
                <span className="font-mono font-semibold text-foreground">{formToDelete.key}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Versions:</span>
                <span className="font-semibold text-foreground">{formToDelete.versionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-semibold text-foreground">
                  {formToDelete.publishedVersion
                    ? `Published (v${formToDelete.publishedVersion})`
                    : 'Draft only'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>
                <strong>Audit Protection:</strong> If this form has existing workflow submissions,
                deletion is blocked by policy to preserve enterprise audit records.
              </span>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {/* Create New Form Modal */}
      <Dialog
        open={newFormModalOpen}
        onOpenChange={setNewFormModalOpen}
        className="max-w-lg sm:max-w-xl"
      >
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Create New Form</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Set up a new form definition with its key, release name, and starting template.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleCreateNewForm} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label htmlFor="new-form-name" className="text-xs font-semibold text-foreground">
              Form Name *
            </label>
            <Input
              id="new-form-name"
              value={newFormTitle}
              onChange={handleTitleChange}
              placeholder="e.g. Vehicle Pre-Trip Inspection"
              required
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-form-key" className="text-xs font-semibold text-foreground">
              Form Identifier (Slug / Key) *
            </label>
            <Input
              id="new-form-key"
              value={newFormKey}
              onChange={(e) => {
                setIsKeyManuallyEdited(true);
                setNewFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'));
              }}
              placeholder="e.g. vehicle_pre_trip_inspection"
              required
              className="h-9 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Unique slug used for URL routes, submissions, and API endpoints. Letters, numbers, and
              underscores only.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="new-form-version-name"
              className="text-xs font-semibold text-foreground"
            >
              Initial Release Name
            </label>
            <Input
              id="new-form-version-name"
              value={newFormVersionName}
              onChange={(e) => setNewFormVersionName(e.target.value)}
              placeholder="e.g. Initial v1, 2026 Q4 Launch"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">Starting Template</label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div
                onClick={() => setNewFormTemplate('blank')}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 text-left transition-all',
                  newFormTemplate === 'blank'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <div className="font-semibold text-xs text-foreground flex items-center justify-between">
                  <span>Blank Form</span>
                  {newFormTemplate === 'blank' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Clean canvas with 1 initial section.
                </p>
              </div>

              <div
                onClick={() => setNewFormTemplate('inspection')}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 text-left transition-all',
                  newFormTemplate === 'inspection'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <div className="font-semibold text-xs text-foreground flex items-center justify-between">
                  <span>Inspection</span>
                  {newFormTemplate === 'inspection' && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Vehicle lookup, odometer & checklist.
                </p>
              </div>

              <div
                onClick={() => setNewFormTemplate('tsrf')}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 text-left transition-all',
                  newFormTemplate === 'tsrf'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <div className="font-semibold text-xs text-foreground flex items-center justify-between">
                  <span>TSRF Clone</span>
                  {newFormTemplate === 'tsrf' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Full multi-stop fleet request workflow.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewFormModalOpen(false)}
              disabled={isCreatingForm}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreatingForm || !newFormTitle.trim() || !newFormKey.trim()}
              className="h-9 text-xs font-semibold"
            >
              {isCreatingForm ? 'Creating...' : 'Create Form'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Field Deletion / Retirement Prompt Modal */}
      {fieldToDeletePrompt && (
        <ConfirmDialog
          open={Boolean(fieldToDeletePrompt)}
          onOpenChange={(open) => !open && setFieldToDeletePrompt(null)}
          onCancel={() => setFieldToDeletePrompt(null)}
          onConfirm={() => {
            removeFieldDirectly(fieldToDeletePrompt.field.id);
            setFieldToDeletePrompt(null);
          }}
          variant="warning"
          icon={Lock}
          title="Remove Published Field?"
          badge={
            publishedBaseline?.version ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <Lock className="h-2.5 w-2.5" /> v{publishedBaseline.version} Published
              </span>
            ) : undefined
          }
          confirmText="Remove from Draft"
          cancelText="Cancel"
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-3.5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <span className="text-sm font-semibold text-foreground break-words">
                  "{fieldToDeletePrompt.field.label}"
                </span>
                <code className="text-xs font-mono px-2 py-0.5 rounded bg-background border border-border text-foreground shrink-0 w-fit">
                  {fieldToDeletePrompt.field.key}
                </code>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This field is part of published baseline{' '}
                <strong>v{publishedBaseline?.version}</strong>.
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/60">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">⚠️</span>
                <p className="leading-relaxed">
                  Removing it from this draft will{' '}
                  <strong className="text-foreground">schedule it for retirement</strong> when you
                  publish this release.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                <p className="leading-relaxed">
                  <strong className="text-foreground">Historical data preserved:</strong> Existing
                  submissions will retain all past values for audit and compliance.
                </p>
              </div>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {/* Section Deletion with Published Fields Confirmation Modal */}
      {sectionToDeletePrompt && (
        <ConfirmDialog
          open={Boolean(sectionToDeletePrompt)}
          onOpenChange={(open) => !open && setSectionToDeletePrompt(null)}
          onCancel={() => setSectionToDeletePrompt(null)}
          onConfirm={() => {
            performRemoveSection(sectionToDeletePrompt.sectionId);
            setSectionToDeletePrompt(null);
          }}
          variant="warning"
          icon={Lock}
          title={`Remove Section "${sectionToDeletePrompt.title}"?`}
          confirmText="Remove Section & Retire Fields"
          cancelText="Cancel"
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-3.5 space-y-2">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This section contains {sectionToDeletePrompt.publishedFieldKeys.length} published
                field
                {sectionToDeletePrompt.publishedFieldKeys.length === 1 ? '' : 's'}:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {sectionToDeletePrompt.publishedFieldKeys.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  >
                    <Lock className="h-3 w-3 opacity-60" />
                    {key}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/60">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">⚠️</span>
                <p className="leading-relaxed">
                  Removing this section will schedule these published fields for retirement upon
                  publishing.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                <p className="leading-relaxed">
                  Existing submissions will retain all past values for audit and compliance.
                </p>
              </div>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {definition.status === 'draft' && publishedBaseline && (
        <details className="group rounded-xl border border-border/70 bg-card/40 px-3.5 py-2 text-xs transition-colors hover:border-border">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 font-medium text-foreground select-none">
            <div className="flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>
                Draft v{definition.version ?? 'draft'} compared with Live v
                {publishedBaseline.version}
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                versionChanges.length === 0
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {versionChanges.length === 0
                ? 'No changes'
                : `${versionChanges.length} change${versionChanges.length === 1 ? '' : 's'}`}
            </span>
          </summary>
          {versionChanges.length === 0 ? (
            <p className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              This draft schema and workflow currently match published live v
              {publishedBaseline.version}.
            </p>
          ) : (
            <ul className="mt-2 pt-2 border-t border-border/50 space-y-1.5 text-xs text-muted-foreground">
              {versionChanges.map((change, index) => (
                <li
                  key={`${change.kind}-${change.path}-${index}`}
                  className="flex items-start gap-1.5"
                >
                  <span className="font-semibold text-foreground capitalize">{change.action}</span>
                  <span>
                    {change.kind}{' '}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">
                      {change.path}
                    </code>
                  </span>
                  {change.details && change.details.length > 0 && (
                    <span className="text-muted-foreground">({change.details.join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      {/* Primary Builder Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('canvas')}
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
            activeTab === 'canvas'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Form Canvas</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] ${
              activeTab === 'canvas'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {fields.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('workflow')}
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
            activeTab === 'workflow'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          <span>Workflow & Stages</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] ${
              activeTab === 'workflow'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {workflow.stages.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
            activeTab === 'permissions'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Stage Field Access</span>
        </button>
      </div>

      {activeTab === 'canvas' && (
        <>
          {/* Mobile / Tablet Studio Switcher (Visible only below 1024px) */}
          <div className="flex lg:hidden items-center justify-between gap-1 p-1 bg-muted/60 rounded-xl border border-border/70 mb-3">
            <button
              type="button"
              onClick={() => setMobileStudioView('canvas')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all ${
                mobileStudioView === 'canvas'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Canvas</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px]">
                {fields.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileStudioView('palette')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all ${
                mobileStudioView === 'palette'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Components</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px]">
                {PALETTE.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileStudioView('properties')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all ${
                mobileStudioView === 'properties'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Properties</span>
              {selectedField && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_340px] items-start gap-5">
            {/* Left Column: Component Library & Structure Outline */}
            <div
              className={`sticky top-0 self-start max-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ${
                mobileStudioView === 'palette' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <div className="p-3 border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Components
                  </h3>
                  <div className="flex rounded-md bg-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSidebarTab('palette')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        sidebarTab === 'palette'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Library
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('outline')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        sidebarTab === 'outline'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Outline
                    </button>
                  </div>
                </div>
                {sidebarTab === 'palette' && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={paletteSearch}
                      onChange={(e) => setPaletteSearch(e.target.value)}
                      placeholder="Filter components..."
                      className="h-7 pl-8 text-xs bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {sidebarTab === 'palette' ? (
                  PALETTE.filter(
                    (item) =>
                      item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                      item.type.toLowerCase().includes(paletteSearch.toLowerCase()),
                  ).map((item) => {
                    const meta = PALETTE_META[item.type] || {
                      label: item.label,
                      icon: Type,
                      description: '',
                    };
                    const Icon = meta.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('field-type', item.type);
                        }}
                        className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-left text-sm transition-all hover:border-primary/50 hover:bg-muted/40 cursor-grab active:cursor-grabbing shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-none truncate">
                              {meta.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-40 group-hover:opacity-100"
                          title={`Add ${meta.label}`}
                          onClick={() => addField(item.type)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-3 p-1">
                    {definition.sections.map((sec, secIdx) => (
                      <div key={sec.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full text-left flex items-center justify-between text-xs font-semibold py-1 px-1.5 rounded hover:bg-muted/50"
                        >
                          <span className="truncate">
                            §{secIdx + 1} {sec.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.2 rounded">
                            {sec.fields.length}
                          </span>
                        </button>
                        <div className="pl-3 space-y-0.5 border-l border-border/60 ml-2">
                          {sec.fields.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectFieldAndScroll(f.id)}
                              className={`w-full text-left text-[11px] py-1 px-1.5 rounded truncate transition-colors ${
                                selectedId === f.id
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Center Column: Canvas */}
            <div
              className={`space-y-4 min-w-0 pb-16 ${
                mobileStudioView === 'canvas' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h2 className="text-base font-semibold">Form Canvas</h2>
                  <p className="text-xs text-muted-foreground">
                    {definition.sections.length}{' '}
                    {definition.sections.length === 1 ? 'section' : 'sections'} · {fields.length}{' '}
                    {fields.length === 1 ? 'field' : 'fields'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addSection}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Section
                </Button>
              </div>

              {definition.sections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  id={section.id}
                  className="space-y-3 rounded-xl border border-border bg-card p-4 transition-all shadow-sm hover:shadow"
                  onDragOver={(e) => {
                    handleDragOverScroll(e);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const type = e.dataTransfer.getData('field-type') as FieldType;
                    if (type) {
                      addField(type, section.id);
                    } else if (draggedId) {
                      moveField(draggedId, section.id);
                    }
                  }}
                >
                  {/* Section Header */}
                  <div className="flex items-start justify-between gap-3 group border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="flex h-6 px-2 items-center justify-center rounded bg-primary/10 text-primary text-xs font-semibold shrink-0">
                        § {sectionIndex + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          className="font-semibold bg-transparent border-transparent hover:border-input focus-visible:border-input text-base h-8 px-2 -ml-2"
                        />
                        <Input
                          value={section.description ?? ''}
                          onChange={(e) =>
                            updateSection(section.id, { description: e.target.value })
                          }
                          placeholder="Add a description for this section..."
                          className="text-xs text-muted-foreground bg-transparent border-transparent hover:border-input focus-visible:border-input h-6 px-2 -ml-2"
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={sectionIndex === 0}
                        onClick={() => moveSectionByOffset(section.id, -1)}
                        title="Move section up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={sectionIndex === definition.sections.length - 1}
                        onClick={() => moveSectionByOffset(section.id, 1)}
                        title="Move section down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeSection(section.id)}
                        title="Remove section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Fields List */}
                  <div className="space-y-2 min-h-10">
                    {section.fields.map((field, fieldIndex) => {
                      const isSelected = selectedId === field.id;
                      const meta = PALETTE_META[field.type] || { icon: Type, label: field.type };
                      const Icon = meta.icon;
                      return (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedId(field.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const type = e.dataTransfer.getData('field-type') as FieldType;
                            if (type) {
                              addField(type, section.id);
                            } else {
                              moveField(field.id);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectFieldAndScroll(field.id);
                          }}
                          className={`group flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/40 shadow-sm'
                              : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/20'
                          }`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{field.label}</span>
                              {field.required && (
                                <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.2 rounded">
                                  Required
                                </span>
                              )}
                              {field.rules && field.rules.length > 0 && (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                                  {field.rules.length} {field.rules.length === 1 ? 'rule' : 'rules'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono text-[11px] bg-muted/50 px-1 rounded">
                                {field.key}
                              </span>
                              {publishedFieldKeys.has(field.key) && (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                  title="Published field. Removing this will schedule it for retirement upon publishing."
                                >
                                  <Lock className="h-2.5 w-2.5" /> Published
                                </span>
                              )}
                              <span>·</span>
                              <span className="capitalize">{field.type.replaceAll('_', ' ')}</span>
                              <span>·</span>
                              <span className="capitalize">{field.width ?? 'half'} width</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={`Move ${field.label} up`}
                              disabled={fieldIndex === 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                moveFieldByOffset(field.id, -1);
                              }}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={`Move ${field.label} down`}
                              disabled={fieldIndex === section.fields.length - 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                moveFieldByOffset(field.id, 1);
                              }}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Duplicate field"
                              onClick={(event) => {
                                event.stopPropagation();
                                duplicateField(field.id);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title={
                                publishedFieldKeys.has(field.key)
                                  ? 'Retire published field'
                                  : 'Remove field'
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                if (publishedFieldKeys.has(field.key)) {
                                  setFieldToDeletePrompt({ field, sectionId: section.id });
                                } else {
                                  removeFieldDirectly(field.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {section.fields.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground bg-muted/5 gap-1">
                        <Copy className="h-4 w-4 opacity-40" />
                        <span>Drag components here from the library, or click Add Field below</span>
                      </div>
                    )}

                    {/* Inline Add Field Button */}
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed hover:border-primary hover:text-primary transition-all text-xs h-8"
                        onClick={() => addField('text', section.id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Field to {section.title}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Properties Inspector (Sticky!) */}
            <div
              ref={propertiesPanelRef}
              className={`sticky top-0 self-start max-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ${
                mobileStudioView === 'properties' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {selectedField ? (
                <>
                  {/* Sticky Header with Field Name, Key, Actions */}
                  <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0 flex items-center gap-2">
                      {(() => {
                        const meta = PALETTE_META[selectedField.type] || {
                          icon: Type,
                          label: selectedField.type,
                        };
                        const Icon = meta.icon;
                        return (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate leading-none">
                          {selectedField.label}
                        </h3>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
                          {selectedField.key}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="lg:hidden h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileStudioView('canvas')}
                      >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        Canvas
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Duplicate field"
                        onClick={() => duplicateField(selectedField.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title={
                          publishedFieldKeys.has(selectedField.key)
                            ? 'Retire published field'
                            : 'Delete field'
                        }
                        onClick={() => {
                          if (publishedFieldKeys.has(selectedField.key)) {
                            setFieldToDeletePrompt({
                              field: selectedField,
                              sectionId: selectedField.section,
                            });
                          } else {
                            removeFieldDirectly(selectedField.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Close properties"
                        onClick={() => setSelectedId('')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Sub-tabs: Settings | Logic & Data | Governance */}
                  <div className="flex border-b border-border px-3 pt-1 shrink-0 bg-muted/5 gap-1">
                    <button
                      type="button"
                      onClick={() => setInspectorTab('settings')}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                        inspectorTab === 'settings'
                          ? 'border-primary text-primary font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      General
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorTab('logic')}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1 ${
                        inspectorTab === 'logic'
                          ? 'border-primary text-primary font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Data & Logic
                      {selectedField.rules && selectedField.rules.length > 0 && (
                        <span className="rounded-full bg-primary/20 text-primary text-[10px] px-1 font-semibold">
                          {selectedField.rules.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorTab('governance')}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                        inspectorTab === 'governance'
                          ? 'border-primary text-primary font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Governance
                    </button>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {inspectorTab === 'settings' && (
                      <div className="space-y-3.5 animate-fade-in">
                        <div>
                          <label className="mb-1 block text-xs font-semibold">Label</label>
                          <Input
                            value={selectedField.label}
                            onChange={(event) => updateField({ label: event.target.value })}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold">Field Key</label>
                            {(publishedFieldKeys.has(selectedField.key) ||
                              publishedFieldIds.has(selectedField.id)) && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                <Lock className="h-3 w-3" /> Published (Locked)
                              </span>
                            )}
                          </div>
                          <Input
                            value={selectedField.key}
                            disabled={
                              publishedFieldKeys.has(selectedField.key) ||
                              publishedFieldIds.has(selectedField.id)
                            }
                            onChange={(event) => updateField({ key: event.target.value })}
                            className="font-mono text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {publishedFieldKeys.has(selectedField.key) ||
                            publishedFieldIds.has(selectedField.id)
                              ? 'Immutable to preserve historical submissions and schema integrity.'
                              : 'Unique key used in submissions and reporting.'}
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold">Field Type</label>
                          <Select
                            value={selectedField.type}
                            onChange={(event) => {
                              const type = event.target.value as FieldType;
                              updateField({
                                type,
                                dataSource:
                                  type === 'entity_lookup'
                                    ? {
                                        kind: 'entity',
                                        entity: 'vehicles',
                                        valueField: 'id',
                                        labelField: 'plateNumber',
                                      }
                                    : undefined,
                                options:
                                  type === 'select' ? (selectedField.options ?? []) : undefined,
                                rowFields:
                                  type === 'repeater' ? (selectedField.rowFields ?? []) : undefined,
                                minRows:
                                  type === 'repeater' ? (selectedField.minRows ?? 0) : undefined,
                              });
                            }}
                          >
                            {PALETTE.map((item) => (
                              <option key={item.type} value={item.type}>
                                {item.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {['text', 'textarea', 'number', 'date', 'time'].includes(
                          selectedField.type,
                        ) && (
                          <div>
                            <label
                              htmlFor="field-placeholder"
                              className="mb-1 block text-xs font-semibold"
                            >
                              Placeholder Text
                            </label>
                            <Input
                              id="field-placeholder"
                              value={selectedField.placeholder ?? ''}
                              placeholder="Enter hint..."
                              onChange={(event) => updateField({ placeholder: event.target.value })}
                            />
                          </div>
                        )}
                        {selectedField.type !== 'notice' && selectedField.type !== 'repeater' && (
                          <div>
                            <label
                              htmlFor="field-width"
                              className="mb-1 block text-xs font-semibold"
                            >
                              Field Width
                            </label>
                            <Select
                              id="field-width"
                              value={selectedField.width ?? 'half'}
                              onChange={(event) =>
                                updateField({ width: event.target.value as FormField['width'] })
                              }
                            >
                              <option value="half">Half Width (2 columns)</option>
                              <option value="full">Full Width (1 column)</option>
                            </Select>
                          </div>
                        )}
                        <div className="pt-1">
                          <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-xs font-medium cursor-pointer hover:bg-muted/30">
                            <input
                              type="checkbox"
                              className="rounded border-input text-primary focus:ring-primary"
                              checked={selectedField.required ?? false}
                              onChange={(event) => updateField({ required: event.target.checked })}
                            />
                            <div>
                              <p className="leading-none">Required Field</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Mark as mandatory before stage submission.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {inspectorTab === 'logic' && (
                      <div className="space-y-4 animate-fade-in">
                        {selectedField.type === 'select' && (
                          <div>
                            <label
                              htmlFor="field-options"
                              className="mb-1 block text-xs font-semibold"
                            >
                              Options (one per line)
                            </label>
                            <textarea
                              id="field-options"
                              rows={5}
                              value={formatFieldOptions(selectedField.options)}
                              onChange={(event) =>
                                updateField({ options: parseFieldOptions(event.target.value) })
                              }
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                          </div>
                        )}

                        {selectedField.type === 'repeater' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label
                                  htmlFor="repeater-min-rows"
                                  className="mb-1 block text-xs font-semibold"
                                >
                                  Min Rows
                                </label>
                                <Input
                                  id="repeater-min-rows"
                                  type="number"
                                  min={0}
                                  value={selectedField.minRows ?? 0}
                                  onChange={(event) =>
                                    updateField({
                                      minRows:
                                        event.target.value === '' ? 0 : Number(event.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="repeater-max-rows"
                                  className="mb-1 block text-xs font-semibold"
                                >
                                  Max Rows
                                </label>
                                <Input
                                  id="repeater-max-rows"
                                  type="number"
                                  min={selectedField.minRows ?? 0}
                                  value={selectedField.maxRows ?? ''}
                                  onChange={(event) =>
                                    updateField({
                                      maxRows:
                                        event.target.value === ''
                                          ? undefined
                                          : Number(event.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold">
                                Repeater Row Columns
                              </label>
                              {selectedField.rowFields?.map((rowField, index) => (
                                <div key={rowField.id} className="flex items-center gap-1.5">
                                  <Input
                                    aria-label={`Repeater field ${index + 1} label`}
                                    value={rowField.label}
                                    className="text-xs h-8"
                                    onChange={(event) =>
                                      updateField({
                                        rowFields: selectedField.rowFields?.map(
                                          (item, itemIndex) =>
                                            itemIndex === index
                                              ? { ...item, label: event.target.value }
                                              : item,
                                        ),
                                      })
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    title={`Remove ${rowField.label}`}
                                    onClick={() =>
                                      updateField({
                                        rowFields: selectedField.rowFields?.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-7 border-dashed"
                                onClick={() =>
                                  updateField({
                                    rowFields: [
                                      ...(selectedField.rowFields ?? []),
                                      {
                                        id: `${selectedField.id}-row-${Date.now()}`,
                                        key: `item_${(selectedField.rowFields?.length ?? 0) + 1}`,
                                        type: 'text',
                                        label: 'New row field',
                                        section: selectedField.section,
                                      },
                                    ],
                                  })
                                }
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Row Field
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedField.type === 'lookup' && (
                          <div>
                            <label
                              htmlFor="field-lov-source"
                              className="mb-1 block text-xs font-semibold"
                            >
                              Reference Data List
                            </label>
                            <Select
                              id="field-lov-source"
                              value={
                                selectedField.dataSource?.kind === 'lov'
                                  ? selectedField.dataSource.listCode
                                  : ''
                              }
                              onChange={(event) =>
                                updateField({
                                  dataSource: event.target.value
                                    ? { kind: 'lov', listCode: event.target.value }
                                    : undefined,
                                })
                              }
                            >
                              <option value="">Choose a list</option>
                              {lists.map((list) => (
                                <option key={list.code} value={list.code}>
                                  {list.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        {selectedField.type === 'entity_lookup' && (
                          <div>
                            <label
                              htmlFor="field-entity-source"
                              className="mb-1 block text-xs font-semibold"
                            >
                              Entity Source
                            </label>
                            <Select
                              id="field-entity-source"
                              value={
                                selectedField.dataSource?.kind === 'entity'
                                  ? selectedField.dataSource.entity
                                  : 'vehicles'
                              }
                              onChange={(event) =>
                                updateField({
                                  dataSource:
                                    event.target.value === 'drivers'
                                      ? {
                                          kind: 'entity',
                                          entity: 'drivers',
                                          valueField: 'id',
                                          labelField: 'name',
                                        }
                                      : {
                                          kind: 'entity',
                                          entity: 'vehicles',
                                          valueField: 'id',
                                          labelField: 'plateNumber',
                                        },
                                })
                              }
                            >
                              <option value="vehicles">Active fleet vehicles</option>
                              <option value="drivers">Active drivers</option>
                            </Select>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              The submitted value will be the selected entity record ID.
                            </p>
                          </div>
                        )}

                        {/* Conditional Rules Section */}
                        <div className="space-y-2.5 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">Conditional Visibility</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                const source = fields.find(
                                  (field) =>
                                    field.id !== selectedId &&
                                    !['notice', 'repeater'].includes(field.type),
                                );
                                if (!source) return;
                                updateRules([
                                  ...(selectedField.rules ?? []),
                                  {
                                    when: { field: source.key, operator: 'exists' },
                                    show: true,
                                    required: false,
                                    enabled: true,
                                  },
                                ]);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Rule
                            </Button>
                          </div>

                          {(selectedField.rules ?? []).map((rule, index) => {
                            const ruleId = `${selectedField.id}-rule-${index}`;
                            const setRule = (updates: Partial<FieldRule>) =>
                              updateRules(
                                (selectedField.rules ?? []).map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, ...updates } : item,
                                ),
                              );
                            return (
                              <div
                                key={ruleId}
                                className="space-y-2.5 rounded-lg border border-border p-3 bg-muted/20 text-xs"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label
                                      htmlFor={`${ruleId}-field`}
                                      className="mb-1 block text-[10px] font-semibold text-muted-foreground"
                                    >
                                      When Field
                                    </label>
                                    <Select
                                      id={`${ruleId}-field`}
                                      className="h-7 text-xs"
                                      value={rule.when.field}
                                      onChange={(event) =>
                                        setRule({
                                          when: { ...rule.when, field: event.target.value },
                                        })
                                      }
                                    >
                                      {fields
                                        .filter(
                                          (field) =>
                                            field.id !== selectedId &&
                                            !['notice', 'repeater'].includes(field.type),
                                        )
                                        .map((field) => (
                                          <option key={field.id} value={field.key}>
                                            {field.label}
                                          </option>
                                        ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <label
                                      htmlFor={`${ruleId}-operator`}
                                      className="mb-1 block text-[10px] font-semibold text-muted-foreground"
                                    >
                                      Condition
                                    </label>
                                    <Select
                                      id={`${ruleId}-operator`}
                                      className="h-7 text-xs"
                                      value={rule.when.operator}
                                      onChange={(event) =>
                                        setRule({
                                          when: {
                                            ...rule.when,
                                            operator: event.target.value as RuleOperator,
                                          },
                                        })
                                      }
                                    >
                                      <option value="exists">Has a value</option>
                                      <option value="eq">Equals</option>
                                      <option value="neq">Does not equal</option>
                                      <option value="in">Is one of</option>
                                      <option value="not_in">Is not one of</option>
                                    </Select>
                                  </div>
                                </div>
                                {rule.when.operator !== 'exists' && (
                                  <div>
                                    <label
                                      htmlFor={`${ruleId}-value`}
                                      className="mb-1 block text-[10px] font-semibold text-muted-foreground"
                                    >
                                      Match Value
                                    </label>
                                    <Input
                                      id={`${ruleId}-value`}
                                      className="h-7 text-xs"
                                      value={
                                        Array.isArray(rule.when.value)
                                          ? rule.when.value.join(', ')
                                          : String(rule.when.value ?? '')
                                      }
                                      onChange={(event) =>
                                        setRule({
                                          when: {
                                            ...rule.when,
                                            value: ['in', 'not_in'].includes(rule.when.operator)
                                              ? event.target.value
                                                  .split(',')
                                                  .map((value) => value.trim())
                                                  .filter(Boolean)
                                              : event.target.value,
                                          },
                                        })
                                      }
                                      placeholder={
                                        ['in', 'not_in'].includes(rule.when.operator)
                                          ? 'value1, value2'
                                          : 'Enter value'
                                      }
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-1.5 pt-1">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-input text-primary"
                                      checked={rule.show !== false}
                                      onChange={(event) => setRule({ show: event.target.checked })}
                                    />
                                    Show when matched
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-input text-primary"
                                      checked={rule.required ?? false}
                                      onChange={(event) =>
                                        setRule({ required: event.target.checked })
                                      }
                                    />
                                    Require when matched
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-input text-primary"
                                      checked={rule.enabled !== false}
                                      onChange={(event) =>
                                        setRule({ enabled: event.target.checked })
                                      }
                                    />
                                    Editable when matched
                                  </label>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive h-6 text-xs w-full justify-center hover:bg-destructive/10"
                                  onClick={() =>
                                    updateRules(
                                      (selectedField.rules ?? []).filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                >
                                  Remove Rule
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {inspectorTab === 'governance' && (
                      <div className="space-y-3 animate-fade-in text-xs">
                        <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                          <input
                            type="checkbox"
                            className="rounded border-input text-primary mt-0.5"
                            checked={selectedField.meta?.reportable ?? false}
                            onChange={(event) =>
                              updateField({
                                meta: { ...selectedField.meta, reportable: event.target.checked },
                              })
                            }
                          />
                          <div>
                            <p className="font-medium text-foreground">Expose in Reports</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Allows this field to appear as a dedicated column in fleet exports and
                              BI charts.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                          <input
                            type="checkbox"
                            className="rounded border-input text-primary mt-0.5"
                            checked={selectedField.meta?.pii ?? false}
                            onChange={(event) =>
                              updateField({
                                meta: { ...selectedField.meta, pii: event.target.checked },
                              })
                            }
                          />
                          <div>
                            <p className="font-medium text-foreground">Personal Data (PII)</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Flags this field for GDPR/privacy audit masking and compliance
                              policies.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-4 my-auto">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <SlidersHorizontal className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">No Field Selected</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                      Click any field in the canvas to inspect its settings, or add a field from the
                      library.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-left text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Form:</span>
                      <span className="font-medium">{definition.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version:</span>
                      <span className="font-medium">
                        v{definition.version ?? 'draft'} ({definition.status})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sections:</span>
                      <span className="font-medium">{definition.sections.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Fields:</span>
                      <span className="font-medium">{fields.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Workflow & Lifecycle Tab */}
      {activeTab === 'workflow' && (
        <div className="space-y-6 animate-fade-in">
          {/* Workflow Approval Flow Diagram Preview */}
          <WorkflowDiagramPreview
            workflow={workflow}
            fields={fields}
            onSelectStage={(stageId) => {
              const el = document.getElementById(`stage-label-${stageId}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el?.focus();
            }}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Stages</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define approval and handling states
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const id = `stage_${Date.now()}`;
                      updateWorkflow({
                        stages: [
                          ...workflow.stages,
                          { id, label: 'New Stage', statusCategory: 'in_review' },
                        ],
                      });
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Stage
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label
                      htmlFor="workflow-initial-stage"
                      className="mb-1 block text-xs font-semibold"
                    >
                      Initial Entry Stage
                    </label>
                    <Select
                      id="workflow-initial-stage"
                      value={workflow.initialStage}
                      onChange={(event) => updateWorkflow({ initialStage: event.target.value })}
                    >
                      {workflow.stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2.5">
                    {workflow.stages.map((stage, index) => (
                      <div
                        key={stage.id}
                        id={`stage-card-${stage.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto] gap-2 items-end rounded-lg border border-border p-3 bg-card transition-all"
                      >
                        <div>
                          <label
                            htmlFor={`stage-label-${stage.id}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            Stage label
                          </label>
                          <Input
                            id={`stage-label-${stage.id}`}
                            value={stage.label}
                            onChange={(event) => updateStage(index, { label: event.target.value })}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`stage-id-${stage.id}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            Stage key
                          </label>
                          <Input
                            id={`stage-id-${stage.id}`}
                            value={stage.id}
                            onChange={(event) => {
                              const oldId = stage.id;
                              const nextId = event.target.value;
                              updateStage(index, { id: nextId });
                              updateWorkflow({
                                initialStage:
                                  workflow.initialStage === oldId ? nextId : workflow.initialStage,
                                transitions: workflow.transitions.map((item) => ({
                                  ...item,
                                  from: item.from === oldId ? nextId : item.from,
                                  to: item.to === oldId ? nextId : item.to,
                                })),
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`stage-category-${stage.id}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            Status
                          </label>
                          <Select
                            id={`stage-category-${stage.id}`}
                            value={stage.statusCategory}
                            onChange={(event) =>
                              updateStage(index, {
                                statusCategory: event.target.value as SystemStatusCategory,
                              })
                            }
                          >
                            {STATUS_CATEGORIES.map((status) => (
                              <option key={status} value={status}>
                                {status.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Remove stage"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={workflow.stages.length <= 1}
                          onClick={() => {
                            const remaining = workflow.stages.filter(
                              (_, stageIndex) => stageIndex !== index,
                            );
                            updateWorkflow({
                              stages: remaining,
                              initialStage:
                                workflow.initialStage === stage.id
                                  ? remaining[0].id
                                  : workflow.initialStage,
                              transitions: workflow.transitions.filter(
                                (item) => item.from !== stage.id && item.to !== stage.id,
                              ),
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Daily Cut-off Policy</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set same-day dispatch cutoff requirements
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="cutoff-time" className="mb-1 block text-xs font-semibold">
                        Cut-off time
                      </label>
                      <Input
                        id="cutoff-time"
                        type="time"
                        value={workflow.cutoff.time}
                        onChange={(event) =>
                          updateWorkflow({
                            cutoff: { ...workflow.cutoff, time: event.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="cutoff-timezone" className="mb-1 block text-xs font-semibold">
                        Timezone
                      </label>
                      <Input
                        id="cutoff-timezone"
                        value={workflow.cutoff.timezone}
                        onChange={(event) =>
                          updateWorkflow({
                            cutoff: { ...workflow.cutoff, timezone: event.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="cutoff-policy" className="mb-1 block text-xs font-semibold">
                        Late policy
                      </label>
                      <Select
                        id="cutoff-policy"
                        value={workflow.cutoff.latePolicy}
                        onChange={(event) =>
                          updateWorkflow({
                            cutoff: {
                              ...workflow.cutoff,
                              latePolicy: event.target
                                .value as FormWorkflow['cutoff']['latePolicy'],
                            },
                          })
                        }
                      >
                        <option value="flag">Flag late</option>
                        <option value="flag_and_exception_approval">
                          Flag and require exception approval
                        </option>
                      </Select>
                    </div>
                  </div>
                  {workflow.cutoff.latePolicy === 'flag_and_exception_approval' && (
                    <div>
                      <label
                        htmlFor="cutoff-exception-stage"
                        className="mb-1 block text-xs font-semibold"
                      >
                        Exception review stage
                      </label>
                      <Select
                        id="cutoff-exception-stage"
                        value={workflow.cutoff.exceptionStage ?? ''}
                        onChange={(event) =>
                          updateWorkflow({
                            cutoff: { ...workflow.cutoff, exceptionStage: event.target.value },
                          })
                        }
                      >
                        {workflow.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Transitions</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Authorized stage progressions and requirements
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={workflow.stages.length < 2}
                    onClick={() =>
                      updateWorkflow({
                        transitions: [
                          ...workflow.transitions,
                          { from: workflow.stages[0].id, to: workflow.stages[1].id, roles: [] },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Transition
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workflow.transitions.map((transition, index) => (
                    <div
                      key={`${transition.from}-${transition.to}-${index}`}
                      className="space-y-2.5 rounded-lg border border-border p-3.5 bg-card"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`transition-from-${index}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            From Stage
                          </label>
                          <Select
                            id={`transition-from-${index}`}
                            value={transition.from}
                            onChange={(event) =>
                              updateTransition(index, { from: event.target.value })
                            }
                          >
                            {workflow.stages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label
                            htmlFor={`transition-to-${index}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            To Stage
                          </label>
                          <Select
                            id={`transition-to-${index}`}
                            value={transition.to}
                            onChange={(event) =>
                              updateTransition(index, { to: event.target.value })
                            }
                          >
                            {workflow.stages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-xs font-semibold">Allowed Roles</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                          {WORKFLOW_ROLES.map((role) => (
                            <label key={role} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                className="rounded border-input text-primary"
                                checked={transition.roles.includes(role)}
                                onChange={(event) =>
                                  updateTransition(index, {
                                    roles: event.target.checked
                                      ? [...transition.roles, role]
                                      : transition.roles.filter((value) => value !== role),
                                  })
                                }
                              />
                              {role.replaceAll('_', ' ')}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor={`transition-required-${index}`}
                          className="mb-1 block text-xs font-semibold"
                        >
                          Required Fields Before Progression
                        </label>
                        <Select
                          id={`transition-required-${index}`}
                          multiple
                          value={transition.requiredFields ?? []}
                          onChange={(event) =>
                            updateTransition(index, {
                              requiredFields: Array.from(
                                event.currentTarget.selectedOptions,
                                (option) => option.value,
                              ),
                            })
                          }
                        >
                          {fields
                            .filter((field) => field.type !== 'notice')
                            .map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                        </Select>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-input text-primary"
                            checked={transition.reasonRequired ?? false}
                            onChange={(event) =>
                              updateTransition(index, { reasonRequired: event.target.checked })
                            }
                          />
                          Require user reason / justification
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 text-xs hover:bg-destructive/10"
                          onClick={() =>
                            updateWorkflow({
                              transitions: workflow.transitions.filter(
                                (_, transitionIndex) => transitionIndex !== index,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Stage Field Access Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {definition.status !== 'draft' &&
            selectedVersionId &&
            currentUser?.role === 'system_admin' && (
              <VersionReadAccess
                versionId={selectedVersionId}
                definition={definition}
                workflow={workflow}
              />
            )}
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Stage Field Access Control</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure field-level visibility and editability per workflow stage and role
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setAllFieldPermissions('edit')}
                  >
                    All Editable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setAllFieldPermissions('read')}
                  >
                    All Read-Only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setAllFieldPermissions('')}
                  >
                    Reset Overrides
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3.5 bg-muted/20">
                <div className="min-w-56">
                  <label htmlFor="permission-stage" className="mb-1 block text-xs font-semibold">
                    Workflow Stage
                  </label>
                  <Select
                    id="permission-stage"
                    value={selectedPermissionStage?.id ?? ''}
                    onChange={(event) => setPermissionStageId(event.target.value)}
                  >
                    {workflow.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-56">
                  <label htmlFor="permission-role" className="mb-1 block text-xs font-semibold">
                    Actor Role
                  </label>
                  <Select
                    id="permission-role"
                    value={permissionRole}
                    onChange={(event) => setPermissionRole(event.target.value)}
                  >
                    {WORKFLOW_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1 min-w-48">
                  <label
                    htmlFor="permission-field-search"
                    className="mb-1 block text-xs font-semibold"
                  >
                    Filter Fields
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="permission-field-search"
                      value={permissionFieldSearch}
                      onChange={(e) => setPermissionFieldSearch(e.target.value)}
                      placeholder="Search by field name or key..."
                      className="h-9 pl-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {permissionFields
                  .filter(
                    (field) =>
                      field.label.toLowerCase().includes(permissionFieldSearch.toLowerCase()) ||
                      field.key.toLowerCase().includes(permissionFieldSearch.toLowerCase()),
                  )
                  .map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{field.label}</p>
                        <p className="truncate text-xs font-mono text-muted-foreground">
                          {field.key}
                        </p>
                      </div>
                      <Select
                        aria-label={`${field.label} access for ${permissionRole}`}
                        className="w-36 h-8 text-xs shrink-0"
                        value={
                          selectedPermissionStage?.fieldPermissions?.[field.key]?.[
                            permissionRole
                          ] ?? ''
                        }
                        onChange={(event) =>
                          updateFieldPermission(
                            field.key,
                            event.target.value as '' | 'edit' | 'read' | 'hidden',
                          )
                        }
                      >
                        <option value="">Default (Inherited)</option>
                        <option value="edit">Editable</option>
                        <option value="read">Read Only</option>
                        <option value="hidden">Hidden</option>
                      </Select>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
