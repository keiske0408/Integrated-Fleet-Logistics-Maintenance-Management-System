import React, { useEffect, useState } from 'react';
import { FormRenderer } from './FormRenderer';
import { serializeTsrfValues, TSRF_V1 } from './seed';
import type { FormDefinition } from './types';
import type { TSRFFormData } from '@/features/logistics/TSRFForm';

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

  useEffect(() => {
    let cancelled = false;
    fetch('/api/forms/published/tsrf')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((saved) => {
        if (cancelled || !saved || !Array.isArray(saved.versions)) return;
        setDefinition(choosePublishedDefinition(saved.versions));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FormRenderer
      definition={definition}
      onSubmit={(values) => onSubmit(serializeTsrfValues(values))}
    />
  );
}
