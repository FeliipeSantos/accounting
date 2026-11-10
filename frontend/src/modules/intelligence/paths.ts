import type { PublicationFilters } from '@/modules/intelligence/types';

/** Address of the module, inside the Inteligência Contábil group of the navigation. */
export const PUBLICATIONS_BASE = '/inteligencia-contabil/publicacoes';

// a aba da lista usa "lista" no endereço: /inteligencia-contabil/publicacoes/lista
export const INTELLIGENCE_TABS = [
  { key: 'painel', label: 'Dashboard' },
  { key: 'lista', label: 'Publicações' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'historico', label: 'Histórico' },
  { key: 'configuracoes', label: 'Configurações' },
] as const;

export type IntelligenceTab = (typeof INTELLIGENCE_TABS)[number]['key'];

/** Address of one tab of the module. */
export function tabPath(tab: IntelligenceTab): string {
  return `${PUBLICATIONS_BASE}/${tab}`;
}

/** Tab names of the old addresses (/inteligencia/publicacoes) that changed. */
const RENAMED_TABS: Record<string, IntelligenceTab> = { publicacoes: 'lista' };

/** New address of an old one: /inteligencia/<aba>?filtros -> /inteligencia-contabil/publicacoes/<aba>?filtros. */
export function legacyTabPath(tab: string | undefined, search: string): string {
  const known = INTELLIGENCE_TABS.find((t) => t.key === (RENAMED_TABS[tab ?? ''] ?? tab));
  return known ? `${tabPath(known.key)}${search}` : PUBLICATIONS_BASE;
}

export const FILTER_KEYS: (keyof PublicationFilters)[] = ['subject', 'source', 'relevance', 'from', 'to', 'q', 'run'];

/** Address of the publication list with the given filters (and the run label, for the banner). */
export function publicationsPath(filters: Partial<PublicationFilters>, runLabel?: string): string {
  const params = new URLSearchParams();
  FILTER_KEYS.forEach((key) => filters[key] && params.set(key, filters[key]!));
  if (runLabel) params.set('runLabel', runLabel);
  const query = params.toString();
  return `${tabPath('lista')}${query ? `?${query}` : ''}`;
}
