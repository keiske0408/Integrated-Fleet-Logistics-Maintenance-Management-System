import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ClipboardList, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormRenderer } from './FormRenderer';
import { TSRFSubmissionTracker } from './TSRFSubmissionTracker';
import { TSRFDetailView } from './TSRFDetailView';
import { projectFormValuesToDefinition, serializeTsrfValues, TSRF_V1 } from './seed';
import type { FormDefinition, FormValues } from './types';
import type { TSRFFormData } from '@/features/logistics/TSRFForm';
import { apiFetch } from '@/lib/api';

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
  const [submissionRefreshToken, setSubmissionRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forms/published/tsrf')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((saved) => {
        if (cancelled || !saved || !Array.isArray(saved.versions)) return;
        const published = saved.versions.some(
          (version: SavedVersion) => version.status === 'published' && version.schema,
        );
        setHasPublishedDefinition(published);
        setDefinition(choosePublishedDefinition(saved.versions));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (values: FormValues) => {
    const legacyData = serializeTsrfValues(values);
    const submissionData = hasPublishedDefinition
      ? projectFormValuesToDefinition(definition, values)
      : legacyData;
    const response = await apiFetch(
      hasPublishedDefinition ? '/api/forms/tsrf/submissions' : '/api/tsrf',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasPublishedDefinition ? { data: submissionData } : submissionData),
      },
    );
    const result = await response.json();
    if (!response.ok) {
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
        <Card className="border-primary/25 bg-primary/5 shadow-xs">
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
        </Card>

        {/* Form Renderer */}
        <FormRenderer definition={definition} onSubmit={submit} />
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
