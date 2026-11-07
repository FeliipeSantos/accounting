/** Labels and formatting of the Inteligência Contábil screens (same texts as before). */
import type { Publication, Relevance, Run, RunStatus, ScheduleInfo } from '@/modules/intelligence/types';
import type { IconTone, Tone } from '@/theme';

/** Relevance levels on the shared semantic scale (Baixa is neutral grey). */
export const RELEVANCE: Record<Relevance, { label: string; plural: string; tone: Tone }> = {
  critica: { label: 'Crítica', plural: 'Críticas', tone: 'danger' },
  alta: { label: 'Alta', plural: 'Altas', tone: 'warning' },
  media: { label: 'Média', plural: 'Médias', tone: 'info' },
  baixa: { label: 'Baixa', plural: 'Baixas', tone: 'neutral' },
};

/** Color of the icon circle of a publication: encodes its relevance. */
export const RELEVANCE_ICON_TONE: Record<Relevance, IconTone> = {
  critica: 'red',
  alta: 'orange',
  media: 'blue',
  baixa: 'gray',
};

/** Tone of each collection status (badges and the header dot). */
export const RUN_TONE: Record<RunStatus, Tone> = {
  success: 'success',
  partial: 'warning',
  failed: 'danger',
  running: 'info',
};

export const METHOD_LABELS: Record<string, string> = {
  'dou-json': 'JSON oficial',
  api: 'API oficial',
  html: 'Página oficial',
};

export const RUN_STATUS: Record<string, string> = {
  success: 'Concluída',
  partial: 'Concluída com falhas',
  failed: 'Falhou',
  running: 'Em execução',
};

export const TRIGGER_LABELS: Record<string, string> = { manual: 'Manual', scheduled: 'Agendada', cli: 'Linha de comando' };

/** "Reforma Tributária" group of the subject filter (any of the three). */
export const REFORM_GROUP = 'reforma-tributaria,ibs-cbs,imposto-seletivo';

/** Subjects of the Reforma Tributária, highlighted in blue in the dashboard lists. */
export const REFORM_SUBJECTS: readonly string[] = REFORM_GROUP.split(',');

// Domínios oficiais aceitos para links (Executivo e Legislativo federal)
const OFFICIAL_DOMAINS = ['gov.br', 'leg.br'];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

/** Publication date with the time when the source provides it ("05/11/2026 às 14:20"). */
export function formatPublished(pub: Pick<Publication, 'publishedAt' | 'publishedTime'>): string | null {
  if (!pub.publishedAt) return null;
  const date = formatDate(pub.publishedAt);
  return pub.publishedTime ? `${date} às ${pub.publishedTime}` : date;
}

/** Only official government links (gov.br / leg.br) become clickable. */
export function safeOfficialUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const okProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    const okHost = OFFICIAL_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
    return okProtocol && okHost ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Steps that led to the relevance level, from the reason stored at classification. */
export function relevanceSteps(pub: Publication, subjectName: (id: string) => string): string[] | null {
  const reason = pub.classificationReason;
  const level = RELEVANCE[pub.relevance];
  if (!reason || !level) return null;
  return [
    reason.weight
      ? `Tipo de ato: ${reason.actLabel} → peso ${reason.weight}`
      : `Tipo: ${reason.actType || 'não informado'} → peso 0 (notícias, comunicados e projetos de lei não têm peso de ato normativo)`,
    reason.reformBonus ? `Trata da Reforma Tributária (${reason.reformSubjects.map(subjectName).join(', ')}) → +1` : 'Não trata da Reforma Tributária → +0',
    `Pontuação ${reason.score} → ${level.label}`,
  ];
}

export function nextRunText(info: ScheduleInfo, now = new Date()): string {
  if (!info.schedulerEnabled || !info.nextRunAt) return 'agendamento automático desativado';
  const next = new Date(info.nextRunAt);
  if (next.getTime() - now.getTime() < 60 * 1000) return 'próxima automática: em instantes';
  const sameDay = next.toDateString() === now.toDateString();
  const day = sameDay ? 'hoje' : next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `próxima automática: ${day} às ${formatTime(info.nextRunAt)}`;
}

/** Header line about the last collection ("Última coleta 07/11/2026 08:03 · sem novidades"). */
export function lastCollectionText(run: Run | null, running = false): string {
  if (running) return 'Coleta em andamento...';
  if (!run) return 'Nenhuma coleta realizada ainda';
  const when = `Última coleta ${formatDateTime(run.finishedAt || run.startedAt)}`;
  if (run.status === 'failed') return `${when} · falhou`;
  const news = run.newCount ? `${run.newCount} nova(s)` : 'sem novidades';
  return run.status === 'partial' ? `${when} · ${news} · com falhas` : `${when} · ${news}`;
}

/** Date and time as "23/10/2026 às 16:45" (local time). */
export function formatDateTimeAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${day} às ${formatTime(iso)}`;
}

/** Header status of the collection ("Atualizado em: 07/11/2026 às 08:03"). */
export function updatedAtText(run: Run | null, running = false): string {
  if (running) return 'Coleta em andamento...';
  if (!run) return 'Nenhuma coleta realizada ainda';
  return `Atualizado em: ${formatDateTimeAt(run.finishedAt || run.startedAt)}`;
}

/** Outcome of the last collection, for tooltips ("2 nova(s) · com falhas"). */
export function runOutcomeText(run: Run): string {
  if (run.status === 'running') return RUN_STATUS.running;
  if (run.status === 'failed') return RUN_STATUS.failed;
  const news = run.newCount ? `${run.newCount} nova(s)` : 'sem novidades';
  return run.status === 'partial' ? `${RUN_STATUS.partial} · ${news}` : `${RUN_STATUS.success} · ${news}`;
}

/** Kind of icon that represents a publication in the lists. */
export type ActIconKind = 'law' | 'notice' | 'document';

// leis, MPs, decretos e emendas: atos normativos de maior hierarquia
const LAW_PATTERN = /^(lei|medida provisoria|decreto|emenda constitucional)\b/;
// portarias, avisos, comunicados, editais e notícias: atos de divulgação
const NOTICE_PATTERN = /^(portaria|aviso|comunicado|edital|noticia)/;

function normalizeAct(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Icon kind from the act type (or, when absent, the start of the title). */
export function actIconKind(pub: Pick<Publication, 'actType' | 'title'>): ActIconKind {
  const text = normalizeAct(pub.actType || pub.title || '');
  if (LAW_PATTERN.test(text)) return 'law';
  if (NOTICE_PATTERN.test(text)) return 'notice';
  return 'document';
}

/** Local date some days ago (yyyy-mm-dd), as the "Recentes" indicator counts. */
export function localDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function describeFinishedRun(run: Run, sourceName: (id: string) => string): string {
  const failed = run.sources.filter((s) => s.status === 'error').map((s) => sourceName(s.sourceId));
  const summary = `${RUN_STATUS[run.status] ?? run.status} às ${formatTime(run.finishedAt)}: ${run.newCount ?? 0} nova(s) publicação(ões).`;
  return failed.length ? `${summary} Fontes com falha: ${failed.join(', ')} (detalhes no Histórico).` : summary;
}

/** Publications of the same act found in different sources, shown as one item. */
export interface PublicationGroup {
  primary: Publication;
  others: Publication[];
}

// atos com numeração única nacional: só estes são agrupados (portarias, instruções etc. repetem números entre órgãos)
const GROUPABLE_ACTS = new Set(['lei', 'lei complementar', 'lei ordinaria', 'medida provisoria', 'decreto', 'decreto-lei', 'emenda constitucional']);

// "<tipo do ato> nº <número>" no início do título, já sem acentos e em minúsculas
const ACT_PATTERN = /^([a-z][a-z -]*?)\s+n\s*\.?\s*[º°o]?\s*\.?\s*(\d[\d.]*)/;

/**
 * Key of the act behind a publication (kind + number + publication date), or null when
 * the title does not identify a nationally numbered act. Conservative on purpose.
 */
export function sameActKey(pub: Pick<Publication, 'title' | 'publishedAt'>): string | null {
  if (!pub.publishedAt) return null;
  const title = pub.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const match = ACT_PATTERN.exec(title);
  if (!match) return null;
  const kind = match[1].trim();
  const number = match[2].replace(/\./g, '').replace(/^0+/, '');
  if (!GROUPABLE_ACTS.has(kind) || !number) return null;
  return `${kind}|${number}|${pub.publishedAt.slice(0, 10)}`;
}

/**
 * Groups, for display only, the same act published by different sources. The first
 * occurrence stays in its place as the primary item; order is otherwise kept.
 */
export function groupSameAct(publications: Publication[]): PublicationGroup[] {
  const groups: PublicationGroup[] = [];
  const byKey = new Map<string, PublicationGroup>();
  for (const pub of publications) {
    const key = sameActKey(pub);
    const group = key ? byKey.get(key) : undefined;
    // a mesma fonte nunca é agrupada consigo mesma
    if (group && ![group.primary, ...group.others].some((p) => p.sourceId === pub.sourceId)) {
      group.others.push(pub);
      continue;
    }
    const created: PublicationGroup = { primary: pub, others: [] };
    groups.push(created);
    if (key && !group) byKey.set(key, created);
  }
  return groups;
}

/**
 * Result count of the publications list. When the same act from several sources is shown
 * as one item, says how many publications were joined, so the total matches what is seen.
 */
export function resultCountText(total: number, loaded: number, shownItems: number): string {
  const base = total > loaded ? `Mostrando ${loaded} de ${total} publicações` : `${total} ${total === 1 ? 'publicação encontrada' : 'publicações encontradas'}`;
  const joined = loaded - shownItems;
  if (joined <= 0) return base;
  const items = `${shownItems} ${shownItems === 1 ? 'item' : 'itens'}`;
  return `${base}, exibidas em ${items}: ${joined} ${joined === 1 ? 'é a mesma norma publicada' : 'são a mesma norma publicada'} em outra fonte`;
}
