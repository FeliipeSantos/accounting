import { FileTextOutlined } from '@ant-design/icons';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { intelligenceApi } from '@/modules/intelligence/api';
import { formatDate, groupSameAct, RELEVANCE, RELEVANCE_ICON_TONE } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication } from '@/modules/intelligence/types';

/** Router state that makes the module open a publication's detail panel on arrival. */
export interface OpenPublicationState {
  openPublication: Publication;
}

export function isOpenPublicationState(state: unknown): state is OpenPublicationState {
  return typeof state === 'object' && state !== null && 'openPublication' in state;
}

/** Global search inside Publicações: same text search as the publication list. */
export const intelligenceSearch: ModuleSearch = {
  placeholder: 'Buscar publicações...',
  noun: 'publicações',
  everything: 'todas as publicações',
  allResultsPath: (term) => publicationsPath({ q: term }),
  search: async (term) => {
    const page = await intelligenceApi.publications({ q: term });
    // a mesma norma publicada em várias fontes aparece uma vez, como na lista
    return groupSameAct(page.items)
      .slice(0, SEARCH_MAX_RESULTS)
      .map(({ primary }) => ({
        id: primary.id,
        title: primary.title,
        description: [RELEVANCE[primary.relevance].label, primary.publishedAt && formatDate(primary.publishedAt), primary.organ].filter(Boolean).join(' · '),
        icon: <FileTextOutlined />,
        tone: RELEVANCE_ICON_TONE[primary.relevance],
        path: publicationsPath({ q: term }),
        state: { openPublication: primary } satisfies OpenPublicationState,
      }));
  },
};
