import React, { useEffect, useState } from 'react';
import { FormRenderer } from './FormRenderer';
import { serializeTsrfValues, TSRF_V1 } from './seed';
import type { FormDefinition, FormValues } from './types';
import type { TSRFFormData } from '@/features/logistics/TSRFForm';
import { useAuth } from '@/features/auth/AuthContext';
import { toBackendRole } from '@/features/auth/backendRole';

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
  const { currentUser } = useAuth();
  const apiRole = toBackendRole(currentUser?.role);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/forms/published/tsrf')
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
    const response = await fetch(
      hasPublishedDefinition ? '/api/forms/tsrf/submissions' : '/api/tsrf',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': apiRole },
        body: JSON.stringify(hasPublishedDefinition ? { data } : data),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(result.details) ? result.details.join(' ') : result.error;
      throw new Error(detail ?? 'Unable to submit TSRF request.');
    }
    onSubmit(data);
  };

  return <FormRenderer definition={definition} onSubmit={submit} />;
}
