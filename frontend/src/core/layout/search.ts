import type { ReactNode } from 'react';

import type { IconTone } from '@/theme';

/** One match of the global search, shown in the results dropdown. */
export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  tone: IconTone;
  /** Route opened when the result is picked. */
  path: string;
  /** Router state passed along (e.g. the item to open on arrival). */
  state?: unknown;
}

/**
 * Search of one module for the global header. The header only queries the search of
 * the module that is open, so results never mix modules.
 */
export interface ModuleSearch {
  placeholder: string;
  /** Name of what is searched, used in "Nenhum resultado em ...". */
  noun: string;
  /** Label of the "see all" option, with the right gender ("todos os projetos"). */
  everything: string;
  search: (term: string) => Promise<SearchResult[]>;
  /** Route listing every match of the term inside the module. */
  allResultsPath: (term: string) => string;
}

/** Most results listed in the dropdown; the rest are in the "see all" route. */
export const SEARCH_MAX_RESULTS = 6;
