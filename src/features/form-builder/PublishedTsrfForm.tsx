import React, { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormRenderer } from './FormRenderer';
import { FormPrintView } from './FormPrintView';
import { TSRFSubmissionTracker, type SubmissionPrintRequest } from './TSRFSubmissionTracker';
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
  const [definition, setDefinition] = useState<FormDefinition>(TSRF_V1);
  const [hasPublishedDefinition, setHasPublishedDefinition] = useState(false);
  const [submissionRefreshToken, setSubmissionRefreshToken] = useState(0);
  const [focusSubmissionId, setFocusSubmissionId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<{
    definition: FormDefinition;
    number: string;
    values: FormValues;
    labelSnapshots: Record<string, { code: string; label: string }>;
    status?: string;
    stage?: string;
    isLate?: boolean;
    createdAt?: string;
    currentAssignee?: { name: string; role: string } | null;
    currentResponsibleRoles?: string[];
  } | null>(null);

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
    setPrintReceipt({
      definition,
      number: result.submissionNumber ?? result.requestNumber ?? 'Pending number',
      values,
      labelSnapshots: result.labelSnapshots ?? {},
      status: result.status,
      stage: result.stage,
      isLate: result.isLate,
      createdAt: result.createdAt,
      currentAssignee: result.currentAssignee ?? null,
      currentResponsibleRoles: result.currentResponsibleRoles ?? [],
    });
    setSubmissionRefreshToken((current) => current + 1);
    setFocusSubmissionId(typeof result.id === 'string' ? result.id : null);
    setShowRequestForm(false);
    onSubmit(legacyData);
  };

  const preparePrintRequest = (request: SubmissionPrintRequest) => {
    setPrintReceipt({
      definition: request.definition,
      number: request.submissionNumber,
      values: request.values,
      labelSnapshots: request.labelSnapshots,
      status: request.status,
      stage: request.stage,
      isLate: request.isLate,
      createdAt: request.createdAt,
      currentAssignee: request.currentAssignee,
      currentResponsibleRoles: request.currentResponsibleRoles,
    });
  };

  return (
    <div className="space-y-4">
      {!showRequestForm ? (
        <TSRFSubmissionTracker
          refreshToken={submissionRefreshToken}
          focusSubmissionId={focusSubmissionId}
          onPrint={preparePrintRequest}
          onNewRequest={() => {
            setPrintReceipt(null);
            setShowRequestForm(true);
          }}
        />
      ) : (
        <div className="space-y-5">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 px-0"
            onClick={() => setShowRequestForm(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Button>
          <section className="border-l-2 border-primary pl-4" aria-labelledby="request-guide-title">
            <h2
              id="request-guide-title"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <ClipboardList className="h-4 w-4" />
              Before you request a vehicle
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Choose your department and provide the project and trip schedule.</li>
              <li>Enter the origin, destination, stops, passengers, and cargo details.</li>
              <li>
                Submit complete details; the request will appear in your register with its current
                status and history.
              </li>
            </ol>
          </section>
          <FormRenderer definition={definition} onSubmit={submit} />
        </div>
      )}
      {printReceipt && (
        <>
          <div className="flex justify-end print:hidden">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print Request
            </Button>
          </div>
          <FormPrintView
            definition={printReceipt.definition}
            values={printReceipt.values}
            submissionNumber={printReceipt.number}
            labelSnapshots={printReceipt.labelSnapshots}
            status={printReceipt.status}
            stage={printReceipt.stage}
            isLate={printReceipt.isLate}
            createdAt={printReceipt.createdAt}
            currentAssignee={printReceipt.currentAssignee}
            currentResponsibleRoles={printReceipt.currentResponsibleRoles}
          />
        </>
      )}
    </div>
  );
}
