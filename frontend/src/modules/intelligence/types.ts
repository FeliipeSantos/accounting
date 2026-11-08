/** Shapes of the /api/intelligence answers (see docs/api-contract.md). */

export type Relevance = 'critica' | 'alta' | 'media' | 'baixa';

export interface ClassificationReason {
  actType: string | null;
  actLabel: string | null;
  weight: number;
  reformBonus: number;
  reformSubjects: string[];
  score: number;
  subjects: { id: string; via: 'source' | 'keywords'; terms: string[] }[];
}

export interface Publication {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  publishedTime: string | null;
  excerpt: string;
  actType: string;
  organ: string;
  subjects: string[];
  relevance: Relevance;
  normType: string | null;
  effectiveDate: string | null;
  collectedAt: string;
  runId: string | null;
  classificationReason?: ClassificationReason;
  favorite?: boolean;
  favoritedAt?: string;
}

/** A provision of the act that states a concrete value (amount, percentage, deadline, date). */
export interface KeyPoint {
  /** Where it is: "Art. 1º · nova redação do art. 18-A, § 1º da LC 123/2006". */
  ref: string;
  /** The act's own wording, shortened. */
  text: string;
  /** Values found in the text, shown in bold. */
  highlights: string[];
}

/** Full official text of the act, read after collection (GET /publications/:id only). */
export type FullText =
  | {
      status: 'ok';
      url: string | null;
      text: string;
      points: KeyPoint[];
      /**
       * What the points are: provisions with values (amounts, percentages, deadlines, dates),
       * the act's main provisions when it states no values, or the "Rótulo: valor" fields of
       * texts without articles (e.g. Soluções de Consulta).
       */
      basis: 'values' | 'provisions' | 'fields' | null;
      effective: { ref: string; text: string; items: string[] } | null;
    }
  | { status: 'pending' | 'unavailable' | 'error' };

export interface PublicationDetailData extends Publication {
  fullText: FullText;
}

export interface PublicationPage {
  total: number;
  items: Publication[];
}

export interface SourceStatus {
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  method: string;
  collectable: boolean;
  coverage: string;
  defaultSubjects?: string[];
  enabled: boolean;
  status: SourceStatus | null;
  count: number;
}

export interface Subject {
  id: string;
  name: string;
  keywords: string[];
  enabled: boolean;
  count: number;
}

export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface SourceResult {
  sourceId: string;
  status: 'success' | 'error';
  fetched: number;
  invalid: number;
  relevant: number;
  newCount: number;
  duplicateCount: number;
  error: string | null;
  durationMs: number;
}

export interface Run {
  id: string;
  trigger: 'scheduled' | 'manual' | 'cli';
  requestedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  newCount: number;
  duplicateCount: number;
  error: string | null;
  sources: SourceResult[];
}

export interface ScheduleInfo {
  schedulerEnabled: boolean;
  nextRunAt: string | null;
}

export interface Summary extends ScheduleInfo {
  totals: { publications: number; critical: number; recent: number; reform: number };
  recentDays: number;
  byCategory: { id: string; name: string; count: number }[];
  recentItems: Publication[];
  lastRun: Run | null;
}

export interface RunState extends ScheduleInfo {
  running: boolean;
  lastRun: Run | null;
}

export interface Settings {
  runTime: string;
  enabledSources: string[];
  enabledSubjects: string[];
}

/** Filters of the publication list, kept in the address (?subject=...&q=...). */
export interface PublicationFilters {
  subject: string;
  source: string;
  relevance: string;
  from: string;
  to: string;
  q: string;
  run: string;
}
