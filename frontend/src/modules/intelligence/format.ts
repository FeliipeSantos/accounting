/** Labels and formatting of the Inteligência Contábil screens (same texts as before). */
import type { Publication, Relevance, Run, ScheduleInfo } from '@/modules/intelligence/types';

export const RELEVANCE: Record<Relevance, { label: string; color: string }> = {
  critica: { label: 'Crítica', color: 'red' },
  alta: { label: 'Alta', color: 'orange' },
  media: { label: 'Média', color: 'gold' },
  baixa: { label: 'Baixa', color: 'default' },
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

export function lastRunText(run: Run | null): string {
  return run ? formatDateTime(run.finishedAt || run.startedAt) : 'Nunca executado';
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
