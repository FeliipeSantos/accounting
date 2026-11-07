import { createContext, useContext } from 'react';

import type { Publication, Source, Subject } from '@/modules/intelligence/types';

export interface IntelligenceContextValue {
  sources: Source[];
  subjects: Subject[];
  sourceName: (id: string) => string;
  subjectName: (id: string) => string;
  /** Reloads sources and subjects (after saving settings or a collection). */
  reloadCatalog: () => Promise<void>;
  /** Changes whenever the open view must reload (a collection finished). */
  refreshKey: number;
  /** Opens the detail panel; onChange receives the publication when its favorite changes. */
  openDetail: (publication: Publication, onChange?: (publication: Publication) => void) => void;
}

export const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

export function useIntelligence(): IntelligenceContextValue {
  const context = useContext(IntelligenceContext);
  if (!context) throw new Error('useIntelligence must be used inside IntelligencePage');
  return context;
}
