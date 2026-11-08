import { apiRequest } from '@/core/api/client';
import type { CalendarEvent, DocumentDetail, DocumentFilters, DocumentPage, EventFilters, Status, SyncRun } from '@/modules/reforma/types';

const BASE = '/api/reforma';

export const PAGE_SIZE = 50;

function query(filters: Partial<DocumentFilters>, offset: number): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  return params.toString();
}

export const reformaApi = {
  /** Whether the session user may use this personal module (hides the menu item otherwise). */
  access: () => apiRequest<{ allowed: boolean }>(`${BASE}/access`).then((r) => r.allowed),
  status: () => apiRequest<Status>(`${BASE}/status`),
  runs: () => apiRequest<SyncRun[]>(`${BASE}/runs`),
  run: (id: string) => apiRequest<SyncRun>(`${BASE}/runs/${encodeURIComponent(id)}`),
  startRun: () => apiRequest<{ started: boolean }>(`${BASE}/runs`, { method: 'POST' }),
  documents: (filters: Partial<DocumentFilters>, offset = 0) => apiRequest<DocumentPage>(`${BASE}/documents?${query(filters, offset)}`),
  document: (id: string) => apiRequest<DocumentDetail>(`${BASE}/documents/${encodeURIComponent(id)}`),
  /** Active events between two dates (yyyy-mm-dd, at most 13 months apart). */
  events: (from: string, to: string, filters: Partial<EventFilters> = {}) => {
    const params = new URLSearchParams({ from, to });
    if (filters.kind) params.set('kind', filters.kind);
    if (filters.importance?.length) params.set('importance', filters.importance.join(','));
    if (filters.hidePublications) params.set('hidePublications', 'true');
    if (filters.officialOnly) params.set('officialOnly', 'true');
    if (filters.subjects?.length) params.set('subject', filters.subjects.join(','));
    return apiRequest<CalendarEvent[]>(`${BASE}/events?${params.toString()}`);
  },
  versionText: (documentId: string, versionId: string) =>
    apiRequest<{ text: string }>(`${BASE}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}`).then((r) => r.text),
};
