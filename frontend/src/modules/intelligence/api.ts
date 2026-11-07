import { apiRequest } from '@/core/api/client';
import type { Publication, PublicationFilters, PublicationPage, Run, RunState, Settings, Source, Subject, Summary } from '@/modules/intelligence/types';

const BASE = '/api/intelligence';

export const PAGE_SIZE = 50;

function query(filters: Partial<PublicationFilters>, extra: Record<string, number> = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  Object.entries(extra).forEach(([key, value]) => params.set(key, String(value)));
  return params.toString();
}

export const intelligenceApi = {
  summary: () => apiRequest<Summary>(`${BASE}/summary`),
  publications: (filters: Partial<PublicationFilters>, offset = 0) =>
    apiRequest<PublicationPage>(`${BASE}/publications?${query(filters, { limit: PAGE_SIZE, offset })}`),
  sources: () => apiRequest<Source[]>(`${BASE}/sources`),
  subjects: () => apiRequest<Subject[]>(`${BASE}/subjects`),
  rules: () => apiRequest<string[]>(`${BASE}/rules`),
  status: () => apiRequest<RunState>(`${BASE}/status`),
  runs: () => apiRequest<Run[]>(`${BASE}/runs`),
  startRun: () => apiRequest<{ started: boolean }>(`${BASE}/runs`, { method: 'POST' }),
  settings: () => apiRequest<Settings>(`${BASE}/settings`),
  saveSettings: (settings: Settings) => apiRequest<Settings>(`${BASE}/settings`, { method: 'PUT', body: settings }),
  favorites: () => apiRequest<Publication[]>(`${BASE}/favorites`),
  addFavorite: (publicationId: string) => apiRequest(`${BASE}/favorites`, { method: 'POST', body: { publicationId } }),
  removeFavorite: (publicationId: string) => apiRequest(`${BASE}/favorites/${encodeURIComponent(publicationId)}`, { method: 'DELETE' }),
};
