import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormRenderer } from './FormRenderer';
import { TSRF_V1, TSRF_WORKFLOW } from './seed';
import { useLov } from '@/features/lov';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { validateFormDefinition, validateFormWorkflow } from './validation';
import { projectFormForRoleStage } from './preview';
import type {
  FieldType,
  FormDefinition,
  FormField,
  FormWorkflow,
  SystemStatusCategory,
} from './types';
import type { FieldRule, RuleOperator } from './rules';
import { moveFieldWithinSections } from './reorder';
import { parseFormDefinitionImport } from './importSchema';
import { diffFormDefinitions } from './versionDiff';
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

function cloneDefinition(): FormDefinition {
  return structuredClone(TSRF_V1);
}

export function FormBuilderPage() {
  const {
    version: routeVersion,
    role: routeRole,
    stage: routeStage,
  } = useParams<{
    version?: string;
    role?: string;
    stage?: string;
  }>();
  const navigate = useNavigate();
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
  const propertiesPanelRef = useRef<HTMLDivElement>(null);

  const selectFieldAndScroll = (fieldId: string) => {
    setSelectedId(fieldId);
    propertiesPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [preview, setPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [publishedFieldIds, setPublishedFieldIds] = useState<Set<string>>(() => new Set());
  const [publishedBaseline, setPublishedBaseline] = useState<FormDefinition | null>(null);
  const [availableVersions, setAvailableVersions] = useState<
    Array<{ version: number; status: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      ? diffFormDefinitions(publishedBaseline, definition)
      : [];
  const previewUrl = (role: string, stageId: string) =>
    `/form-builder/preview/${encodeURIComponent(role)}/${encodeURIComponent(stageId)}${routeVersion ? `/${encodeURIComponent(routeVersion)}` : ''}`;
  const openPreview = () => {
    const stageId = selectedPermissionStage?.id ?? workflow.initialStage;
    navigate(previewUrl(permissionRole, stageId));
  };
  const leavePreview = () => {
    setPreview(false);
    navigate(routeVersion ? `/form-builder/versions/${routeVersion}` : '/form-builder');
  };
  const selectVersion = (version: string) => {
    if (saving || editRevision > savedRevisionRef.current) {
      setMessage('Save the current changes before switching versions.');
      return;
    }
    navigate(version === 'working' ? '/form-builder' : `/form-builder/versions/${version}`);
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
      navigate('/form-builder', { replace: true });
      return;
    }
    setPermissionRole(routeRole);
    setPermissionStageId(routeStage);
    setPreview(true);
  }, [isDefinitionLoaded, navigate, routeRole, routeStage, workflow.stages]);

  useEffect(() => {
    let cancelled = false;
    setIsDefinitionLoaded(false);
    apiFetch(`/api/forms/${encodeURIComponent(definition.key)}`)
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
          versions.map((version) => ({ version: version.version, status: version.status })),
        );
        const published = versions.find((version) => version.status === 'published');
        setPublishedBaseline(
          published?.schema
            ? { ...published.schema, version: published.version, status: 'published' }
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
        if (routeVersion && !requestedVersion)
          setMessage(`Form version ${routeVersion} was not found.`);
        const selected =
          requestedVersion ??
          activeDraft ??
          versions.find((version) => version.status === 'published');
        if (selected?.schema) {
          savedRevisionRef.current = 0;
          setEditRevision(0);
          dispatchEditorHistory({
            type: 'reset',
            snapshot: {
              definition: {
                ...selected.schema,
                version: selected.version,
                status: selected.status,
              },
              workflow: selected.workflow?.stages
                ? selected.workflow
                : structuredClone(TSRF_WORKFLOW),
            },
          });
          setDraftVersionId(selected.status === 'draft' ? selected.id : null);
          setSelectedId(selected.schema.sections[1]?.fields[0]?.id ?? '');
        }
        setIsDefinitionLoaded(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Unable to load form definition.');
          setIsDefinitionLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, definition.key, routeVersion]);

  const saveDraft = async (automatic = false, revision = editRevision) => {
    if (saving) return;
    setSaving(true);
    if (!automatic) setMessage(null);
    try {
      const draft = { ...definition, status: 'draft' as const };
      let response: Response;
      if (!definitionId) {
        response = await apiFetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: draft.key, name: draft.name, schema: draft, workflow }),
        });
      } else if (draftVersionId) {
        response = await apiFetch(`/api/forms/versions/${encodeURIComponent(draftVersionId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft, workflow }),
        });
      } else {
        response = await apiFetch(`/api/forms/${encodeURIComponent(definitionId)}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: draft, workflow }),
        });
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save draft.');
      const resolvedDefId = result.formDefinitionId ?? (result.version ? result.id : definitionId);
      if (resolvedDefId) setDefinitionId(resolvedDefId);
      const version = result.version ?? result;
      setDraftVersionId(version.id);
      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      autosaveErrorRevisionRef.current = null;
      dispatchEditorHistory({
        type: 'replace-present',
        update: (snapshot) => ({
          ...snapshot,
          definition: { ...snapshot.definition, version: version.version, status: 'draft' },
        }),
      });
      setMessage(`Draft v${version.version} ${automatic ? 'autosaved' : 'saved'}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to save draft.';
      if (automatic) autosaveErrorRevisionRef.current = revision;
      setMessage(automatic ? `Autosave failed: ${detail} Use Save Draft to retry.` : detail);
    } finally {
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

  const publish = async () => {
    const errors = [
      ...validateFormDefinition(definition, new Set(lists.map((list) => list.code))),
      ...validateFormWorkflow(workflow, fields),
    ];
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    if (!draftVersionId) {
      setMessage('Save a draft before publishing.');
      return;
    }
    if (editRevision > savedRevisionRef.current) {
      setMessage('Wait for the current draft changes to save before publishing.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch(
        `/api/forms/versions/${encodeURIComponent(draftVersionId)}/publish`,
        { method: 'POST' },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to publish form.');
      const published = { ...definition, version: result.version, status: 'published' as const };
      savedRevisionRef.current = editRevision;
      dispatchEditorHistory({
        type: 'reset',
        snapshot: { definition: published, workflow },
      });
      setPublishedBaseline(published);
      setPublishedFieldIds(new Set(collectFieldIds(fields)));
      setDraftVersionId(null);
      setMessage(`Form v${result.version} published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish form.');
    } finally {
      setSaving(false);
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

  const removeSection = (id: string) => {
    setDefinition((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== id),
    }));
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
    const nextPermissions: Record<string, Record<string, '' | 'edit' | 'read' | 'hidden'>> = {
      ...(selectedPermissionStage.fieldPermissions ?? {}),
    };
    permissionFields.forEach((field) => {
      nextPermissions[field.key] = {
        ...(nextPermissions[field.key] ?? {}),
        [permissionRole]: access,
      };
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
        setMessage(result.errors.join(' '));
        return;
      }
      if (result.definition.key !== definition.key) {
        setMessage(
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
      setMessage('Schema imported locally. Save Draft to persist the changes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read the JSON file.');
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Form Builder</h1>
          <p className="text-sm text-muted-foreground">
            Design {definition.name} v{definition.version} · {definition.status}
          </p>
        </div>
        <div className="flex gap-2">
          {availableVersions.length > 0 && (
            <div>
              <label htmlFor="form-version" className="sr-only">
                Form version
              </label>
              <Select
                id="form-version"
                value={routeVersion ?? 'working'}
                onChange={(event) => selectVersion(event.target.value)}
              >
                <option value="working">Current working version</option>
                {availableVersions.map((item) => (
                  <option key={item.version} value={item.version}>
                    v{item.version} ({item.status})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={openPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
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
            title="Redo"
            aria-label="Redo"
            disabled={editorHistory.future.length === 0}
            onClick={redoEdit}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Import form definition JSON"
            onChange={importJson}
          />
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
          <Button onClick={() => void saveDraft()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving
              ? 'Saving...'
              : editRevision > savedRevisionRef.current || !draftVersionId
                ? 'Save Draft'
                : 'Saved'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void publish()}
            disabled={
              saving || definition.status === 'published' || editRevision > savedRevisionRef.current
            }
          >
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      {definition.status === 'draft' && publishedBaseline && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Draft v{definition.version} compared with published v{publishedBaseline.version}
            <span className="ml-2 font-normal text-muted-foreground">
              {versionChanges.length} change(s)
            </span>
          </summary>
          {versionChanges.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No schema changes.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {versionChanges.map((change, index) => (
                <li key={`${change.kind}-${change.path}-${index}`}>
                  <span className="font-medium capitalize">{change.action}</span>{' '}
                  <span>
                    {change.kind} {change.path}
                  </span>
                  {change.details && (
                    <span className="text-muted-foreground"> ({change.details.join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      {/* Primary Builder Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('canvas')}
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
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
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
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
          className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
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
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_340px] items-start gap-5">
          {/* Left Column: Component Library & Structure Outline */}
          <div className="sticky top-0 self-start max-h-[calc(100vh-8.5rem)] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                          <p className="text-xs font-medium leading-none truncate">{meta.label}</p>
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
          <div className="space-y-4 min-w-0 pb-16">
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
                        onChange={(e) => updateSection(section.id, { description: e.target.value })}
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
                            title="Remove field"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDefinition((current) => ({
                                ...current,
                                sections: current.sections.map((s) => ({
                                  ...s,
                                  fields: s.fields.filter((f) => f.id !== field.id),
                                })),
                              }));
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
            className="sticky top-0 self-start max-h-[calc(100vh-8.5rem)] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
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
                      title="Delete field"
                      onClick={() => {
                        setDefinition((current) => ({
                          ...current,
                          sections: current.sections.map((section) => ({
                            ...section,
                            fields: section.fields.filter((field) => field.id !== selectedId),
                          })),
                        }));
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
                          {publishedFieldIds.has(selectedField.id) && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <Lock className="h-3 w-3" /> Published
                            </span>
                          )}
                        </div>
                        <Input
                          value={selectedField.key}
                          disabled={publishedFieldIds.has(selectedField.id)}
                          onChange={(event) => updateField({ key: event.target.value })}
                          className="font-mono text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Unique key used in submissions and reporting.
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
                          <label htmlFor="field-width" className="mb-1 block text-xs font-semibold">
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
                                      rowFields: selectedField.rowFields?.map((item, itemIndex) =>
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
                                      setRule({ when: { ...rule.when, field: event.target.value } })
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
                                    onChange={(event) => setRule({ enabled: event.target.checked })}
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
                            Flags this field for GDPR/privacy audit masking and compliance policies.
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
                      v{definition.version} ({definition.status})
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
      )}

      {/* Workflow & Lifecycle Tab */}
      {activeTab === 'workflow' && (
        <div className="grid gap-6 xl:grid-cols-2 animate-fade-in">
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
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto] gap-2 items-end rounded-lg border border-border p-3 bg-card"
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
                            latePolicy: event.target.value as FormWorkflow['cutoff']['latePolicy'],
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
                          onChange={(event) => updateTransition(index, { to: event.target.value })}
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
      )}

      {/* Stage Field Access Tab */}
      {activeTab === 'permissions' && (
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
                        selectedPermissionStage?.fieldPermissions?.[field.key]?.[permissionRole] ??
                        ''
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
      )}
    </div>
  );
}
