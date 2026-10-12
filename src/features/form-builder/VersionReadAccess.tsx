import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { FormDefinition, FormField, FormWorkflow } from './types';

type ReadGrants = Record<string, { department_requester: string[] }>;
type Policy = { revision: number; readGrants: ReadGrants; affectedSubmissions: number };
type Revision = { revision: number; reason: string; actorId: string; createdAt: string };

export function VersionReadAccess({
  versionId,
  definition,
  workflow,
}: {
  versionId: string;
  definition: FormDefinition;
  workflow: FormWorkflow;
}) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [grants, setGrants] = useState<ReadGrants>({});
  const [history, setHistory] = useState<Revision[]>([]);
  const [stageId, setStageId] = useState(workflow.initialStage);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPolicy(null);
    setError(null);
    void Promise.all([
      apiFetch(`/api/forms/versions/${versionId}/read-access`),
      apiFetch(`/api/forms/versions/${versionId}/read-access/history`),
    ])
      .then(async ([response, historyResponse]) => {
        if (!response.ok || !historyResponse.ok)
          throw new Error('Unable to load historical read access.');
        return [
          (await response.json()) as Policy,
          (await historyResponse.json()) as Revision[],
        ] as const;
      })
      .then(([loaded, revisions]) => {
        if (cancelled) return;
        setPolicy(loaded);
        setGrants(loaded.readGrants);
        setHistory(revisions);
        setReason('');
        setStageId(workflow.initialStage);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [versionId, reload, workflow.initialStage]);
  const flatten = (fields: FormField[], prefix = ''): Array<{ path: string; label: string }> =>
    fields.flatMap((field) => {
      if (field.type === 'notice') return [];
      const path = prefix ? `${prefix}.${field.key}` : field.key;
      return [{ path, label: field.label }, ...flatten(field.rowFields ?? [], path)];
    });
  const fields = flatten(definition.sections.flatMap((section) => section.fields));
  const stage = workflow.stages.find((candidate) => candidate.id === stageId);
  const selected = grants[stageId]?.department_requester ?? [];
  const toggle = (path: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      const parts = path.split('.');
      while (parts.length) {
        next.add(parts.join('.'));
        parts.pop();
      }
    } else for (const key of next) if (key === path || key.startsWith(`${path}.`)) next.delete(key);
    setGrants((previous) => ({ ...previous, [stageId]: { department_requester: [...next] } }));
  };
  const save = async () => {
    if (!policy || !reason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/forms/versions/${versionId}/read-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: policy.revision, readGrants: grants, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save read correction.');
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save read correction.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Historical read access"
      className="space-y-4 border border-border rounded-lg p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Historical Read Access - v{definition.version}
          </h2>
          <p className="text-xs text-muted-foreground">
            Department requester / Revision {policy?.revision ?? 0} /{' '}
            {policy?.affectedSubmissions ?? 0} requests on this version
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reload Policy
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!policy ? (
        <p className="text-sm text-muted-foreground">Loading read policy...</p>
      ) : (
        <>
          <label className="block text-sm">
            Workflow stage
            <select
              aria-label="Read correction stage"
              value={stageId}
              onChange={(event) => setStageId(event.target.value)}
              disabled={busy}
              className="mt-1 block w-full rounded-md border border-input bg-background p-2"
            >
              {workflow.stages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.path} className="flex gap-2 border-b border-border py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(field.path)}
                  disabled={busy}
                  onChange={(event) => toggle(field.path, event.target.checked)}
                />
                <span className="min-w-0 break-words">
                  {field.label}
                  <span className="block text-xs text-muted-foreground">
                    {field.path} / Baseline:{' '}
                    {stage?.fieldPermissions?.[field.path]?.department_requester ?? 'Not granted'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Correction reason (required)
            <textarea
              aria-label="Correction reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              maxLength={2000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-input bg-background p-2"
            />
          </label>
          <Button disabled={busy || !reason.trim()} onClick={() => void save()} className="gap-2">
            <Save className="h-4 w-4" /> {busy ? 'Saving...' : 'Apply Read Correction'}
          </Button>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Revision History ({history.length})
            </summary>
            <ul className="space-y-2 pt-2">
              {history.map((item) => (
                <li key={item.revision} className="text-sm break-words">
                  r{item.revision} / {new Date(item.createdAt).toLocaleString()} / {item.reason}
                  <span className="block text-xs text-muted-foreground">{item.actorId}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
