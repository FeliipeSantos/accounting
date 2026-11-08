/** Labels of the Calendário screens. */
import type { FileStatus, Importance, RunStatus, SyncRun } from '@/modules/reforma/types';
import type { IconTone, Tone } from '@/theme';

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  running: { label: 'Em andamento', tone: 'info' },
  success: { label: 'Concluída', tone: 'success' },
  partial: { label: 'Concluída com falhas', tone: 'warning' },
  failed: { label: 'Falhou', tone: 'danger' },
};

export const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Agendada',
  cli: 'Linha de comando',
};

export const FILE_STATUS: Record<FileStatus, { label: string; tone: Tone; hint: string } | null> = {
  none: null,
  pending: { label: 'Arquivo pendente', tone: 'neutral', hint: 'A versão tem um PDF oficial que ainda não foi baixado; ele é lido na próxima sincronização.' },
  ok: { label: 'PDF lido', tone: 'success', hint: 'O PDF oficial desta versão foi baixado e guardado, e o texto dele foi usado para extrair as datas.' },
  error: {
    label: 'Falha no PDF',
    tone: 'danger',
    hint: 'Não foi possível baixar ou ler o PDF oficial; o motivo aparece abaixo e a leitura é tentada de novo nas próximas sincronizações.',
  },
  skipped: { label: 'PDF antigo (não baixado)', tone: 'neutral', hint: 'O PDF é de antes de 2025 e não foi baixado, para não guardar arquivos fora do período da Reforma.' },
};

/** What the badges of a version mean. */
export const VERSION_HINTS = {
  current: 'É a versão mais recente encontrada na fonte oficial. As datas do calendário vêm dela; as anteriores ficam guardadas como histórico.',
  pendingAnalysis:
    'A análise por IA (impacto, quem é afetado e providência) ainda não foi feita para esta versão: ela é a próxima etapa do módulo. As datas do calendário não dependem dela, são extraídas por regras do texto oficial.',
};

/** Why a version is the current one. */
export function currentVersionReason(versionCount: number): string {
  return versionCount > 1
    ? `Foi detectada depois das outras ${versionCount - 1} versões deste documento.`
    : 'É a única versão encontrada até agora: o documento não mudou desde que foi coletado.';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

/** "3 novos · 1 nova versão · 2 PDFs" (or "sem novidades"). */
export function runOutcome(run: Pick<SyncRun, 'newDocuments' | 'newVersions' | 'filesDownloaded'>): string {
  const parts = [
    run.newDocuments ? `${run.newDocuments} ${run.newDocuments === 1 ? 'documento novo' : 'documentos novos'}` : null,
    run.newVersions ? `${run.newVersions} ${run.newVersions === 1 ? 'nova versão' : 'novas versões'}` : null,
    run.filesDownloaded ? `${run.filesDownloaded} ${run.filesDownloaded === 1 ? 'PDF lido' : 'PDFs lidos'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'sem novidades';
}

export function nextRunText(enabled: boolean, nextRunAt: string | null, now = new Date()): string {
  if (!enabled || !nextRunAt) return 'sincronização automática desligada';
  const next = new Date(nextRunAt);
  if (next.getTime() - now.getTime() < 60 * 1000) return 'próxima automática: em instantes';
  const day = next.toDateString() === now.toDateString() ? 'hoje' : next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `próxima automática: ${day} às ${next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const IMPORTANCE: Record<Importance, { label: string; tone: Tone; hint: string }> = {
  critico: {
    label: 'Crítico',
    tone: 'danger',
    hint: 'Muda a regra para todos: vigência ou obrigatoriedade definida em lei complementar, emenda constitucional ou medida provisória.',
  },
  alto: { label: 'Alto', tone: 'warning', hint: 'Pede ação ou preparação até a data: obrigatoriedade, prazo, início em produção, opção ou vigência.' },
  medio: { label: 'Médio', tone: 'info', hint: 'Data de referência para acompanhar, sem ação imediata: publicação ou ambiente de testes.' },
  informativo: { label: 'Informativo', tone: 'neutral', hint: 'Só aviso: vem de notícia, comunicado ou proposta e não cria obrigação.' },
};

export const DATE_STATUS: Record<string, { label: string; tone: Tone; hint: string }> = {
  confirmada: {
    label: 'Data oficial',
    tone: 'success',
    hint: 'Data escrita no documento oficial',
  },
  citada: {
    label: 'Confirmar no ato oficial',
    tone: 'warning',
    hint: 'Data de um ato oficial reproduzida em comunicado: confira no ato antes de agir',
  },
  previsao: {
    label: 'Previsão',
    tone: 'neutral',
    hint: 'Data de notícia ou comunicado, ou descrita como prevista: não é obrigação legal',
  },
};

/** What the event is about: the row of a schedule ("NFS-e") or the document ("Nota Técnica 2026.008"). */
export function eventSubject(title: string): string {
  const at = title.indexOf(': ');
  return at >= 0 ? title.slice(at + 2) : title;
}

/** First and last day (yyyy-mm-dd) of the grid of a month, including the days of the
 * neighbouring months that the calendar shows (6 weeks from the Sunday before the 1st). */
export function monthGridRange(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return { from: isoDay(start), to: isoDay(end) };
}

export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "sábado, 16 de novembro de 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "hoje", "amanhã", "em 9 dias", "há 3 dias". */
export function relativeDay(iso: string, today: string): string {
  const days = Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
}

export type KindGroup = 'obrigatoriedade' | 'prazo' | 'vigencia' | 'alteracao';

/** The four kinds of the calendar and their colors: obligations (including the start of a
 * Nota Técnica in production), deadlines (including options), entry into force of a new act
 * and entry into force of a change to an existing one (e.g. products excluded from the ST). */
export const KIND_GROUPS: Record<KindGroup, { label: string; plural: string; tone: IconTone }> = {
  obrigatoriedade: { label: 'Obrigatoriedade', plural: 'Obrigatoriedades', tone: 'orange' },
  prazo: { label: 'Prazo', plural: 'Prazos', tone: 'green' },
  vigencia: { label: 'Vigência', plural: 'Vigências', tone: 'purple' },
  alteracao: { label: 'Alteração', plural: 'Alterações', tone: 'blue' },
};

export function kindGroup(kind: string): KindGroup {
  return kind === 'obrigatoriedade' || kind === 'prazo' || kind === 'alteracao' ? kind : 'vigencia';
}
