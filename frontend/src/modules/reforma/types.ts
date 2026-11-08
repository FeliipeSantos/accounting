/** Shapes of the /api/reforma answers (see docs/api-contract.md). */

export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface SourceResult {
  sourceId: string;
  checkedAt: string;
  status: 'success' | 'error';
  fetched: number;
  newDocuments: number;
  newVersions: number;
  error: string | null;
  durationMs: number;
  lastSuccessAt?: string | null;
}

export interface SyncRun {
  id: string;
  trigger: 'scheduled' | 'manual' | 'cli';
  requestedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  newDocuments: number;
  newVersions: number;
  filesDownloaded: number;
  error: string | null;
  sources?: SourceResult[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
  method: string;
  note: string;
  documents: number;
  last: SourceResult | null;
}

export interface Totals {
  documents: number;
  versions: number;
  newThisMonth: number;
  changedThisMonth: number;
  pendingAnalysis: number;
  pendingFiles: number;
}

/** An act published after a recurring rule was checked that may change its deadline. */
export interface ReviewAct {
  documentId: string;
  title: string;
  url: string;
  date: string;
}

/** A recurring rule that may have changed: review it against the acts. */
export interface RecurringReview {
  ruleId: string;
  title: string;
  /** Day the rule was checked against the official source. */
  since: string;
  acts: ReviewAct[];
}

export interface Status {
  running: boolean;
  lastRun: SyncRun | null;
  schedulerEnabled: boolean;
  runTime: string;
  nextRunAt: string | null;
  totals: Totals;
  kinds: Record<string, string>;
  eventKinds: Record<string, string>;
  /** Subjects of the calendar filter (the same list as the Publicações module). */
  subjects: { id: string; name: string }[];
  events: { total: number; upcoming: number; pendingExtraction: number };
  /** Recurring rules that a newer act may have changed. */
  recurringReviews: RecurringReview[];
  sources: Source[];
}

export type FileStatus = 'none' | 'pending' | 'ok' | 'error' | 'skipped';

export interface DocumentSummary {
  id: string;
  sourceId: string;
  externalId: string;
  kind: string;
  title: string;
  url: string;
  publishedAt: string | null;
  sourceStatus: string | null;
  versionCount: number;
  firstSeenAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  currentVersion: {
    id: string;
    label: string | null;
    summary: string;
    fileStatus: FileStatus;
    analysisStatus: string;
    hasText: boolean;
  };
}

export interface DocumentVersion {
  id: string;
  label: string | null;
  title: string;
  summary: string;
  publishedAt: string | null;
  detectedAt: string;
  fileUrl: string | null;
  fileStatus: FileStatus;
  fileError: string | null;
  analysisStatus: string;
  textLength: number;
}

export interface DocumentDetail extends DocumentSummary {
  versions: DocumentVersion[];
}

export interface DocumentPage {
  total: number;
  items: DocumentSummary[];
}

export interface DocumentFilters {
  source: string;
  kind: string;
  q: string;
  changed: string;
}

export type Importance = 'critico' | 'alto' | 'medio' | 'informativo';

/** One date of the calendar, always with the literal excerpt of the official text. */
export interface CalendarEvent {
  id: string;
  documentId: string;
  versionId: string | null;
  kind: string;
  date: string;
  title: string;
  quote: string;
  dateStatus: 'confirmada' | 'citada' | 'previsao' | 'recorrente';
  dateNote: string | null;
  legalStatus: string;
  importance: Importance;
  /** Why the event got this importance (one sentence). */
  importanceReason: string;
  /** Why the date is official, cited or a forecast (one sentence). */
  dateReason: string;
  origin: 'regra' | 'ia' | 'manual' | 'recorrente';
  status: 'ativo' | 'substituido';
  createdAt: string;
  updatedAt: string;
  document: {
    title: string;
    kind: string;
    sourceId: string;
    url: string;
    versionLabel: string | null;
    /** The act's summary ("Altera o Protocolo ICMS 41/08..."), when it has one. */
    summary: string | null;
  };
  /** Subjects of the event (Reforma Tributária, ICMS...). */
  subjects: string[];
  /** Recurring deadlines only: newer acts that may have changed the rule. */
  review?: { since: string; acts: ReviewAct[] } | null;
  /** The same change found in other documents (the same act from another source, the same news). */
  alsoIn: {
    eventId: string;
    documentId: string;
    title: string;
    sourceId: string;
    url: string;
  }[];
}

export interface EventFilters {
  kind: string;
  importance: Importance[];
  hidePublications: boolean;
  officialOnly: boolean;
  /** Subject ids; empty: every subject. */
  subjects: string[];
}
