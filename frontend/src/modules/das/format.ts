import dayjs, { type Dayjs } from 'dayjs';

import { matchesClient } from '@/modules/clients/format';
import type { DasItem, GuideStatus } from '@/modules/das/types';
import type { Tone } from '@/theme';

export const DAS_PATH = '/das';

/** PGMEI page where the MEI DAS is issued (it asks for the CNPJ and a captcha). */
export const PGMEI_URL = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

export const GUIDE_STATUS: Record<GuideStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'warning' },
  gerada: { label: 'Gerada', tone: 'info' },
  paga: { label: 'Paga', tone: 'success' },
};

/** Competência shown by default: the previous month, whose DAS is due this month. */
export function defaultPeriod(today: Dayjs = dayjs()): string {
  return today.subtract(1, 'month').format('YYYY-MM');
}

export function shiftPeriod(period: string, months: number): string {
  return dayjs(`${period}-01`).add(months, 'month').format('YYYY-MM');
}

/** "outubro/2026" */
export function periodLabel(period: string): string {
  return dayjs(`${period}-01`).format('MMMM/YYYY');
}

/** A guide not paid after its due date. */
export function isOverdue(item: Pick<DasItem, 'status'>, dueDate: string, today: Dayjs = dayjs()): boolean {
  return item.status !== 'paga' && today.format('YYYY-MM-DD') > dueDate;
}

export function formatDay(value: string | null): string {
  return value ? dayjs(value).format('DD/MM/YYYY') : '—';
}

/**
 * Copies a text. The VPS is reached by plain HTTP, where navigator.clipboard does not exist,
 * so a hidden text field with the copy command is the fallback.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para o plano B
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/** Payment line in the 4 blocks printed on the guide: "85800000000-7 81050328202-6 ...". */
export function formatBarcodeLine(line: string): string {
  return [0, 1, 2, 3].map((i) => `${line.slice(i * 12, i * 12 + 11)}-${line.slice(i * 12 + 11, i * 12 + 12)}`).join(' ');
}

/** Same search as the client list: name, trade name or CNPJ with or without punctuation. */
export function matchesGuide(item: Pick<DasItem, 'name' | 'tradeName' | 'document'>, term: string): boolean {
  return matchesClient({ ...item, contactName: null, city: null }, term);
}
