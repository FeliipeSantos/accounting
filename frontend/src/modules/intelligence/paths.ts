import type { PublicationFilters } from '@/modules/intelligence/types';

export const INTELLIGENCE_TABS = [
  { key: 'painel', label: 'Dashboard' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'historico', label: 'Histórico' },
  { key: 'configuracoes', label: 'Configurações' },
] as const;

export type IntelligenceTab = (typeof INTELLIGENCE_TABS)[number]['key'];

export const FILTER_KEYS: (keyof PublicationFilters)[] = ['subject', 'source', 'relevance', 'from', 'to', 'q', 'run'];

/** Address of the publication list with the given filters (and the run label, for the banner). */
export function publicationsPath(filters: Partial<PublicationFilters>, runLabel?: string): string {
  const params = new URLSearchParams();
  FILTER_KEYS.forEach((key) => filters[key] && params.set(key, filters[key]!));
  if (runLabel) params.set('runLabel', runLabel);
  const query = params.toString();
  return `/inteligencia/publicacoes${query ? `?${query}` : ''}`;
}
