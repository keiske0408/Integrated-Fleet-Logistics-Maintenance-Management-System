import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  FolderKanban,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  ConfirmDialog,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FormDefinition, FormField, FormDirectoryItem } from '../types';
export type { FormDirectoryItem };

export interface FormBuilderModalsProps {
  // Restricted access confirm
  showRestrictedConfirm: boolean;
  setShowRestrictedConfirm: (open: boolean) => void;
  restrictedStagesToConfirm: string[];
  onConfirmRestrictedPublish: () => void;
  saving: boolean;

  // Delete draft confirm
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (open: boolean) => void;
  onConfirmDeleteDraft: () => void;
  isDeletingDraft: boolean;
  definition: FormDefinition;
  fieldsCount: number;

  // Retire confirm
  showRetireConfirmModal: boolean;
  setShowRetireConfirmModal: (open: boolean) => void;
  retiredKeysToConfirm: string[];
  onConfirmRetirePublish: () => void;

  // Rename form
  showRenameFormModal: boolean;
  setShowRenameFormModal: (open: boolean) => void;
  editingFormName: string;
  setEditingFormName: (name: string) => void;
  onConfirmRenameForm: () => void;
  isUpdatingFormName: boolean;

  // Edit version release name
  showEditVersionNameModal: boolean;
  setShowEditVersionNameModal: (open: boolean) => void;
  editingVersionName: string;
  setEditingVersionName: (name: string) => void;
  onConfirmEditVersionName: () => void;
  isUpdatingVersionName: boolean;

  // Set active version
  showActivateVersionModal: boolean;
  setShowActivateVersionModal: (open: boolean) => void;
  onConfirmSetActiveVersion: () => void;
  isActivatingVersion: boolean;

  // Forms Directory
  formsDirectoryOpen: boolean;
  setFormsDirectoryOpen: (open: boolean) => void;
  formsDirectorySearch: string;
  setFormsDirectorySearch: (val: string) => void;
  formsDirectorySort: 'name-asc' | 'name-desc' | 'versions';
  setFormsDirectorySort: (sort: 'name-asc' | 'name-desc' | 'versions') => void;
  formsDirectoryFilter: 'all' | 'published' | 'draft';
  setFormsDirectoryFilter: (filter: 'all' | 'published' | 'draft') => void;
  formsDirectoryCounts: { total: number; published: number; draft: number };
  filteredFormsDirectory: FormDirectoryItem[];
  allFormsListLength: number;
  onSwitchForm: (key: string) => void;
  onOpenNewFormModal: () => void;
  formToDelete: FormDirectoryItem | null;
  setFormToDelete:
    | React.Dispatch<React.SetStateAction<FormDirectoryItem | null>>
    | ((form: FormDirectoryItem | null) => void);
  onConfirmDeleteForm: () => void;
  isDeletingForm: boolean;
  activeFormKey: string;

  // Create New Form
  newFormModalOpen: boolean;
  setNewFormModalOpen: (open: boolean) => void;
  newFormTitle: string;
  newFormKey: string;
  newFormVersionName: string;
  newFormTemplate: 'blank' | 'inspection' | 'tsrf';
  setNewFormVersionName: (val: string) => void;
  setNewFormTemplate: (tpl: 'blank' | 'inspection' | 'tsrf') => void;
  setIsKeyManuallyEdited: (val: boolean) => void;
  handleTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setNewFormKey: (key: string) => void;
  handleCreateNewForm: (e: React.FormEvent) => void;
  isCreatingForm: boolean;

  // Field & Section deletion prompts
  fieldToDeletePrompt: { field: FormField; sectionId: string } | null;
  setFieldToDeletePrompt: (val: { field: FormField; sectionId: string } | null) => void;
  onRemoveFieldDirectly: (id: string) => void;
  publishedBaseline: FormDefinition | null;
  sectionToDeletePrompt: { sectionId: string; title: string; publishedFieldKeys: string[] } | null;
  setSectionToDeletePrompt: (
    val: { sectionId: string; title: string; publishedFieldKeys: string[] } | null,
  ) => void;
  onPerformRemoveSection: (sectionId: string) => void;
}

export const FormBuilderModals: React.FC<FormBuilderModalsProps> = React.memo(({
  showRestrictedConfirm,
  setShowRestrictedConfirm,
  restrictedStagesToConfirm,
  onConfirmRestrictedPublish,
  saving,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onConfirmDeleteDraft,
  isDeletingDraft,
  definition,
  fieldsCount,
  showRetireConfirmModal,
  setShowRetireConfirmModal,
  retiredKeysToConfirm,
  onConfirmRetirePublish,
  showRenameFormModal,
  setShowRenameFormModal,
  editingFormName,
  setEditingFormName,
  onConfirmRenameForm,
  isUpdatingFormName,
  showEditVersionNameModal,
  setShowEditVersionNameModal,
  editingVersionName,
  setEditingVersionName,
  onConfirmEditVersionName,
  isUpdatingVersionName,
  showActivateVersionModal,
  setShowActivateVersionModal,
  onConfirmSetActiveVersion,
  isActivatingVersion,
  formsDirectoryOpen,
  setFormsDirectoryOpen,
  formsDirectorySearch,
  setFormsDirectorySearch,
  formsDirectorySort,
  setFormsDirectorySort,
  formsDirectoryFilter,
  setFormsDirectoryFilter,
  formsDirectoryCounts,
  filteredFormsDirectory,
  allFormsListLength,
  onSwitchForm,
  onOpenNewFormModal,
  formToDelete,
  setFormToDelete,
  onConfirmDeleteForm,
  isDeletingForm,
  activeFormKey,
  newFormModalOpen,
  setNewFormModalOpen,
  newFormTitle,
  newFormKey,
  newFormVersionName,
  newFormTemplate,
  setNewFormVersionName,
  setNewFormTemplate,
  setIsKeyManuallyEdited,
  handleTitleChange,
  setNewFormKey,
  handleCreateNewForm,
  isCreatingForm,
  fieldToDeletePrompt,
  setFieldToDeletePrompt,
  onRemoveFieldDirectly,
  publishedBaseline,
  sectionToDeletePrompt,
  setSectionToDeletePrompt,
  onPerformRemoveSection,
}) => {
  return (
    <>
      {/* Restricted Requestor Access Confirmation Modal */}
      <ConfirmDialog
        open={showRestrictedConfirm}
        onOpenChange={setShowRestrictedConfirm}
        onCancel={() => setShowRestrictedConfirm(false)}
        onConfirm={onConfirmRestrictedPublish}
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

      {/* Delete Draft Confirmation Modal */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={onConfirmDeleteDraft}
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
                {fieldsCount} field{fieldsCount === 1 ? '' : 's'}
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
        onConfirm={onConfirmRetirePublish}
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
        onConfirm={onConfirmRenameForm}
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
        onConfirm={onConfirmEditVersionName}
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
        onConfirm={onConfirmSetActiveVersion}
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
              onClick={onOpenNewFormModal}
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
                Showing {filteredFormsDirectory.length} of {allFormsListLength}
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
                          onClick={() => onSwitchForm(form.key)}
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
          onConfirm={onConfirmDeleteForm}
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
            onRemoveFieldDirectly(fieldToDeletePrompt.field.id);
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
            onPerformRemoveSection(sectionToDeletePrompt.sectionId);
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
    </>
  );
});

FormBuilderModals.displayName = 'FormBuilderModals';
