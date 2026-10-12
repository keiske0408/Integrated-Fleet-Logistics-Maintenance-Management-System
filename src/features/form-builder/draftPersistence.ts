export function resolveDraftSaveRequest({
  loaded,
  definitionId,
  draftVersionId,
  hasChanges,
}: {
  loaded: boolean;
  definitionId: string | null;
  draftVersionId: string | null;
  hasChanges: boolean;
}): { url: string; method: 'POST' | 'PUT' } | null {
  if (!loaded || (definitionId && !hasChanges)) return null;
  if (!definitionId) return { url: '/api/forms', method: 'POST' };
  if (draftVersionId)
    return { url: `/api/forms/versions/${encodeURIComponent(draftVersionId)}`, method: 'PUT' };
  return { url: `/api/forms/${encodeURIComponent(definitionId)}/versions`, method: 'POST' };
}
