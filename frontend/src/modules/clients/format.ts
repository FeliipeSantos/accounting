import type { Client, ClientStatus, Regime } from '@/modules/clients/types';
import type { Tone } from '@/theme';

export const CLIENTS_PATH = '/clientes';

export const REGIMES: Record<Regime, string> = {
  simples: 'Simples Nacional',
  mei: 'MEI',
  presumido: 'Lucro Presumido',
  real: 'Lucro Real',
  imune_isenta: 'Imune / Isenta',
  pessoa_fisica: 'Pessoa Física',
};

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'success' },
  inativo: { label: 'Inativo', tone: 'neutral' },
};

export const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

/** Same limits as the server (app/modules/clients/schemas.py). */
export const LIMITS = {
  name: 200,
  tradeName: 200,
  city: 100,
  stateRegistration: 30,
  municipalRegistration: 30,
  contactName: 120,
  email: 200,
  phone: 30,
  notes: 2000,
} as const;

/** Letters and digits only, upper case: how the CPF/CNPJ is stored. */
export function normalizeDocument(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function checkDigit(values: number[], weights: number[]): number {
  const rest = values.reduce((sum, value, i) => sum + value * weights[i], 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * "pf" for a valid CPF, "pj" for a valid CNPJ (numeric or alphanumeric, the format in
 * force since July 2026), null otherwise. Same rule as the server.
 */
export function documentKind(raw: string): 'pf' | 'pj' | null {
  const doc = normalizeDocument(raw);
  if (new Set(doc).size === 1) return null;
  if (/^\d{11}$/.test(doc)) {
    const digits = [...doc].map(Number);
    const first = checkDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = checkDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits[9] === first && digits[10] === second ? 'pf' : null;
  }
  if (/^[0-9A-Z]{12}\d{2}$/.test(doc)) {
    const values = [...doc].map((c) => c.charCodeAt(0) - 48);
    const first = checkDigit(values.slice(0, 12), CNPJ_WEIGHTS.slice(1));
    const second = checkDigit(values.slice(0, 13), CNPJ_WEIGHTS);
    return values[12] === first && values[13] === second ? 'pj' : null;
  }
  return null;
}

/**
 * CPF/CNPJ with punctuation, also while it is being typed: up to 11 digits it is a CPF
 * (000.000.000-00); past that, or with a letter, a CNPJ (00.000.000/0000-00).
 */
export function formatDocument(raw: string): string {
  const doc = normalizeDocument(raw).slice(0, 14);
  const isCpf = doc.length <= 11 && /^\d*$/.test(doc);
  const parts = isCpf ? [3, 3, 3, 2] : [2, 3, 3, 4, 2];
  const separators = isCpf ? ['.', '.', '-'] : ['.', '.', '/', '-'];
  let result = '';
  let start = 0;
  parts.forEach((size, i) => {
    const piece = doc.slice(start, start + size);
    if (!piece) return;
    result += (i > 0 ? separators[i - 1] : '') + piece;
    start += size;
  });
  return result;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: number | null | undefined): string {
  return value == null ? '—' : money.format(value);
}

/** Text the list search looks at: names and the CPF/CNPJ with or without punctuation. */
export function matchesClient(client: Pick<Client, 'name' | 'tradeName' | 'contactName' | 'city' | 'document'>, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const text = [client.name, client.tradeName, client.contactName, client.city].filter(Boolean).join(' ').toLowerCase();
  const doc = normalizeDocument(needle);
  return text.includes(needle) || (doc.length >= 3 && client.document.includes(doc.toUpperCase()));
}

/** City/UF in one line, or a dash. */
export function formatPlace(client: Pick<Client, 'city' | 'state'>): string {
  if (client.city && client.state) return `${client.city}/${client.state}`;
  return client.city || client.state || '—';
}
