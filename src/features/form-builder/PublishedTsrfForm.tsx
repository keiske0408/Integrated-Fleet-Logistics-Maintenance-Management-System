import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormRenderer } from './FormRenderer';
import { FormPrintView } from './FormPrintView';
import { serializeTsrfValues, TSRF_V1 } from './seed';
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
  const [printReceipt, setPrintReceipt] = useState<{
    number: string;
    values: FormValues;
    labelSnapshots: Record<string, { code: string; label: string }>;
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
    const data = serializeTsrfValues(values);
    const response = await apiFetch(
      hasPublishedDefinition ? '/api/forms/tsrf/submissions' : '/api/tsrf',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasPublishedDefinition ? { data } : data),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(result.details) ? result.details.join(' ') : result.error;
      throw new Error(detail ?? 'Unable to submit TSRF request.');
    }
    setPrintReceipt({
      number: result.submissionNumber ?? result.requestNumber ?? 'Pending number',
      values,
      labelSnapshots: result.labelSnapshots ?? {},
    });
    onSubmit(data);
  };

  return (
    <div className="space-y-4">
      <FormRenderer definition={definition} onSubmit={submit} />
      {printReceipt && (
        <>
          <div className="flex justify-end print:hidden">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print Request
            </Button>
          </div>
          <FormPrintView
            definition={definition}
            values={printReceipt.values}
            submissionNumber={printReceipt.number}
            labelSnapshots={printReceipt.labelSnapshots}
          />
        </>
      )}
    </div>
  );
}
