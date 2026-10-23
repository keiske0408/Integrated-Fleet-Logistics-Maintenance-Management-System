import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { WorkflowDiagramPreview } from '../WorkflowDiagramPreview';
import type { FormField, FormWorkflow, SystemStatusCategory } from '../types';

export const WORKFLOW_ROLES = [
  'department_requester',
  'approver',
  'finance',
  'fleet_team',
  'procurement',
  'admin',
];

export const STATUS_CATEGORIES: SystemStatusCategory[] = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

export interface WorkflowStageMatrixProps {
  workflow: FormWorkflow;
  fields: FormField[];
  updateWorkflow: (next: Partial<FormWorkflow>) => void;
  updateStage: (index: number, next: Partial<FormWorkflow['stages'][number]>) => void;
  updateTransition: (index: number, next: Partial<FormWorkflow['transitions'][number]>) => void;
}

export const WorkflowStageMatrix: React.FC<WorkflowStageMatrixProps> = React.memo(({
  workflow,
  fields,
  updateWorkflow,
  updateStage,
  updateTransition,
}) => {
  return (
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
                        onChange={(event) => updateTransition(index, { from: event.target.value })}
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
    </div>
  );
});

WorkflowStageMatrix.displayName = 'WorkflowStageMatrix';
