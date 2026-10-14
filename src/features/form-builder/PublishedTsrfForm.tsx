import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormRenderer } from './FormRenderer';
import { TSRFSubmissionTracker } from './TSRFSubmissionTracker';
import { TSRFDetailView } from './TSRFDetailView';
import { projectFormValuesToDefinition, serializeTsrfValues, TSRF_V1 } from './seed';
import type { FormDefinition, FormValues } from './types';
import type { TSRFFormData } from '@/features/logistics/TSRFForm';
import { apiFetch } from '@/lib/api';
import { diffFormDefinitions } from './versionDiff';

export function describeIntakeRevision(before: FormDefinition, after: FormDefinition): string[] {
  return diffFormDefinitions(before, after)
    .filter(
      (change) =>
        change.kind === 'field' &&
        (change.action !== 'changed' ||
          change.details?.some((property) =>
            ['required', 'type', 'dataSource'].includes(property),
          )),
    )
    .map(
      (change) =>
        `${change.path}: ${change.action}${change.details?.length ? ` (${change.details.join(', ')})` : ''}`,
    );
}

interface PublishedTsrfFormProps {
  onSubmit: (data: TSRFFormData) => void;
}

interface SavedVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  schema?: FormDefinition;
}

export function choosePublishedDefinition(
  versions: SavedVersion[],
  fallback = TSRF_V1,
): FormDefinition {
  const published = versions
    .filter((version) => version.status === 'published' && version.schema)
    .sort((a, b) => b.version - a.version)[0];
  return published?.schema
    ? { ...published.schema, version: published.version, status: 'published' }
    : fallback;
}

export function PublishedTsrfForm({ onSubmit }: PublishedTsrfFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [definition, setDefinition] = useState<FormDefinition>(TSRF_V1);
  const [hasPublishedDefinition, setHasPublishedDefinition] = useState(false);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [loadingDefinition, setLoadingDefinition] = useState(true);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [staleVersion, setStaleVersion] = useState(false);
  const [intakeValues, setIntakeValues] = useState<FormValues>({});
  const [reloadDefinition, setReloadDefinition] = useState(0);
  const [reviewChanges, setReviewChanges] = useState<string[]>([]);
  const [submissionRefreshToken, setSubmissionRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingDefinition(true);
    setDefinitionError(null);
    apiFetch('/api/forms/published/tsrf')
      .then(async (response) => {
        if (!response.ok) throw new Error('The published request form is unavailable.');
        return response.json();
      })
      .then((saved) => {
        if (cancelled) return;
        const published = [...(saved.versions ?? [])]
          .filter((version: SavedVersion) => version.status === 'published' && version.schema)
          .sort(
            (before: SavedVersion, after: SavedVersion) => after.version - before.version,
          )[0] as SavedVersion | undefined;
        if (!published) throw new Error('No published request form is available.');
        const nextDefinition = choosePublishedDefinition([published]);
        if (versionId) setReviewChanges(describeIntakeRevision(definition, nextDefinition));
        setHasPublishedDefinition(true);
        setVersionId(published.id);
        setIntakeValues((previous) => projectFormValuesToDefinition(nextDefinition, previous));
        setDefinition(nextDefinition);
        setStaleVersion(false);
      })
      .catch((cause) => {
        if (!cancelled)
          setDefinitionError(
            cause instanceof Error ? cause.message : 'Unable to load the request form.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingDefinition(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadDefinition]);

  const submit = async (values: FormValues) => {
    if (
      !hasPublishedDefinition ||
      !versionId ||
      loadingDefinition ||
      definitionError ||
      staleVersion
    )
      throw new Error('Reload the published form before submitting.');
    const legacyData = serializeTsrfValues(values);
    const submissionData = projectFormValuesToDefinition(definition, values);
    const response = await apiFetch('/api/forms/tsrf/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: submissionData, expectedFormVersionId: versionId }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 && result.code === 'FORM_VERSION_CHANGED') {
        setIntakeValues(values);
        setStaleVersion(true);
      }
      const detail = Array.isArray(result.details) ? result.details.join(' ') : result.error;
      throw new Error(detail ?? 'Unable to submit TSRF request.');
    }

    setSubmissionRefreshToken((current) => current + 1);
    onSubmit(legacyData);

    // Navigate to the newly created TSRF detail page!
    if (result.id) {
      navigate(`/tsrf/${result.id}`);
    } else {
      navigate('/tsrf');
    }
  };

  // Case 1: Specific TSRF Record Route -> /tsrf/:id (where id !== 'new')
  if (id && id !== 'new') {
    return <TSRFDetailView id={id} />;
  }

  // Case 2: New Request Route -> /tsrf/new
  if (id === 'new') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 -ml-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/tsrf')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Request Register
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create New Transportation Service Request
            </h1>
          </div>
          <Badge
            variant="outline"
            className="self-start sm:self-auto px-2.5 py-1 text-xs font-mono"
          >
            Standard TSRF V{definition.version ?? 1}
          </Badge>
        </div>

        {/* Structured Intake Guidelines Banner */}
        {/* <Card className="border-primary/25 bg-primary/5 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Fleet Logistics Intake Protocol
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ensure complete schedule and passenger/cargo information for rapid review and
                    vehicle allocation.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>1. Schedule & Purpose</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Specify project purpose, department, departure date, and call time.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>2. Route & Manifest</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enter origin, destination, intermediate drop-offs, and passenger list.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      <span>3. Approval & Dispatch</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Automatic routing through endorsement, gating, and dispatch queues.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card> */}

        {/* Form Renderer */}
        {loadingDefinition ? (
          <p role="status" className="text-sm">
            Loading published request form...
          </p>
        ) : definitionError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{definitionError}</p>
            <Button variant="outline" onClick={() => setReloadDefinition((value) => value + 1)}>
              Retry Loading
            </Button>
          </div>
        ) : (
          <>
            {staleVersion && (
              <div role="alert" className="space-y-3 border border-border rounded-lg p-4">
                <p className="text-sm">
                  The form changed. Your entries are retained until you reload and review the
                  updated form.
                </p>
                <Button onClick={() => setReloadDefinition((value) => value + 1)}>
                  Reload &amp; Review
                </Button>
              </div>
            )}
            {reviewChanges.length > 0 && (
              <section className="space-y-2 border border-border rounded-lg p-4">
                <h2 className="text-sm font-semibold">Updated Request Fields</h2>
                <ul className="text-sm list-disc pl-5 break-words">
                  {reviewChanges.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </section>
            )}
            <FormRenderer
              key={versionId}
              definition={definition}
              initialValues={intakeValues}
              onValuesChange={setIntakeValues}
              submitDisabled={staleVersion}
              onSubmit={submit}
            />
          </>
        )}
      </div>
    );
  }

  // Case 3: Main Registry List Route -> /tsrf
  return (
    <TSRFSubmissionTracker
      refreshToken={submissionRefreshToken}
      onNewRequest={() => navigate('/tsrf/new')}
    />
  );
}

export default PublishedTsrfForm;
