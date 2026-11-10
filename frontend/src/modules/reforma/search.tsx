import { FileTextOutlined } from '@ant-design/icons';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { reformaApi } from '@/modules/reforma/api';
import { formatDate } from '@/modules/reforma/format';

/** Router state that makes the module open a document's modal on arrival. */
export interface OpenDocumentState {
  openDocument: string;
}

export function isOpenDocumentState(state: unknown): state is OpenDocumentState {
  return typeof state === 'object' && state !== null && typeof (state as { openDocument?: unknown }).openDocument === 'string';
}

/** Address of the module, inside the Inteligência Contábil group of the navigation. */
export const CALENDAR_PATH = '/inteligencia-contabil/calendario';

/** The Documentos tab filtered by the term. */
export function documentsPath(term: string): string {
  return `${CALENDAR_PATH}?${new URLSearchParams({ aba: 'documentos', q: term }).toString()}`;
}

/** Global search inside Calendário: the same title and summary search as the Documentos tab. */
export const reformaSearch: ModuleSearch = {
  placeholder: 'Buscar documentos e atos...',
  noun: 'documentos',
  everything: 'todos os documentos',
  allResultsPath: documentsPath,
  search: async (term) => {
    const page = await reformaApi.documents({ q: term });
    return page.items.slice(0, SEARCH_MAX_RESULTS).map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: [doc.publishedAt && formatDate(doc.publishedAt), doc.sourceStatus, doc.versionCount > 1 && `${doc.versionCount} versões`].filter(Boolean).join(' · '),
      icon: <FileTextOutlined />,
      tone: 'blue' as const,
      path: documentsPath(term),
      state: { openDocument: doc.id } satisfies OpenDocumentState,
    }));
  },
};
