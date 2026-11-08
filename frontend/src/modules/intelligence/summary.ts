/**
 * Rule-based summary of a publication (no AI), built from the official excerpt and the
 * fields already classified: what the act does, its goals, who it affects, the norms it
 * cites and whether it is in force. Everything comes from explicit text; when a part is
 * not found it is left out instead of guessed.
 */
import { formatDate } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';

export interface PublicationSummary {
  /** Main action of the act ("Altera a LC 123/2006 (Lei do Simples Nacional)."). */
  headline: string | null;
  /** Goals listed after "para ..." in the excerpt. */
  goals: string[];
  /** Short facts: Vigência, Quem é afetado, Normas citadas. */
  facts: { label: string; value: string }[];
}

const MAX_HEADLINE = 280;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// "<tipo> nº <número>" seguido, opcionalmente, de "/2006" ou ", de 14 de dezembro de 2006"
const REFERENCE =
  /\b(Lei Complementar|Decreto-Lei|Decreto|Lei|Medida Provis[óo]ria|Emenda Constitucional|Instru[çc][ãa]o Normativa(?: [A-Z]{2,})?|Resolu[çc][ãa]o(?: [A-Z]{2,})?|Portaria(?: [A-Z]{2,})?|Conv[êe]nio ICMS|Ajuste SINIEF)\s+n[º°o]?\.?\s*(\d+(?:\.\d+)*)(?!\.{2})(?:\s*\/\s*(\d{4})|,?\s+de\s+(?:\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+)?(\d{4}))?/g;

const SHORT_KIND: Record<string, string> = {
  'lei complementar': 'LC',
  'medida provisoria': 'MP',
  'emenda constitucional': 'EC',
  'decreto-lei': 'DL',
  'instrucao normativa': 'IN',
};

interface Reference {
  text: string;
  kind: string;
  number: string;
  short: string;
}

function shortKind(kind: string): string {
  const key = normalize(kind);
  for (const [long, short] of Object.entries(SHORT_KIND)) {
    if (key === long) return short;
    if (key.startsWith(`${long} `)) return `${short}${kind.slice(long.length)}`;
  }
  return kind;
}

function findReferences(text: string): Reference[] {
  return [...text.matchAll(REFERENCE)].map((match) => {
    const [whole, kind, number, slashYear, longYear] = match;
    const year = slashYear || longYear;
    const short = `${shortKind(kind)} ${number}${year ? `/${year}` : ''}`;
    return { text: whole, kind: normalize(kind), number: number.replace(/\./g, ''), short };
  });
}

/** Norms cited by the excerpt, abbreviated ("LC 123/2006"), without the act itself. */
export function citedNorms(pub: Pick<Publication, 'title' | 'excerpt'>): string[] {
  const own = findReferences(pub.title)[0];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ref of findReferences(pub.excerpt || '')) {
    if (own && own.kind === ref.kind && own.number === ref.number) continue;
    const key = `${ref.kind}|${ref.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref.short);
  }
  return result;
}

function abbreviateReferences(text: string): string {
  return text.replace(REFERENCE, (...args) => {
    const [, kind, number, slashYear, longYear] = args as string[];
    const year = slashYear || longYear;
    return `${shortKind(kind)} ${number}${year ? `/${year}` : ''}`;
  });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function asSentence(text: string): string {
  const trimmed = text.trim().replace(/[,;:\s]+$/, '');
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// fórmula de encerramento sem conteúdo
const BOILERPLATE = /,?\s*e\s+d[áa]\s+outras\s+provid[êe]ncias\.?/gi;
// início de cada objetivo: vírgula ou "e" antes de um verbo no infinitivo
const GOAL_BOUNDARY = /(?:,\s*(?:e\s+)?|\s+e\s+)(?=[a-zà-ú]+(?:ar|er|ir|or)\s)/i;

// cabeçalho do ato repetido no início do trecho (DOU): "PORTARIA Nº 293, DE 28 DE OUTUBRO DE 2026 "
const ACT_HEADER = /^(?:[A-ZÀ-Ú0-9ºª°/.,\-–\s])+?,?\s*(?:DE|de)\s+\d{1,2}º?\s+(?:DE|de)\s+[A-Za-zÇç]+\s+(?:DE|de)\s+\d{4}\.?\s+/;

// verbos de ementa: só nelas o "para ..." lista objetivos (em notícias, "para" é só preposição)
const EMENTA_VERBS = new Set(
  'altera alteram acrescenta aprova autoriza cancela concede consolida cria define determina disciplina dispoe divulga estabelece exclui fixa habilita inclui institui modifica prorroga reduz regulamenta revoga suspende torna'.split(
    ' ',
  ),
);

function firstSentence(text: string): string {
  const [first] = text.split(/\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/);
  return first;
}

/** The excerpt without the act header that some sources repeat at its start. */
export function stripActHeader(excerpt: string, title = ''): string {
  const text = excerpt.replace(/\s+/g, ' ').trim();
  // o cabeçalho completo primeiro: títulos de algumas fontes vêm cortados no meio da data
  const withoutHeader = text.replace(ACT_HEADER, '');
  if (withoutHeader !== text && withoutHeader.trim()) return withoutHeader;
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  if (cleanTitle && normalize(text).startsWith(normalize(cleanTitle))) {
    const rest = text.slice(cleanTitle.length).trim();
    if (rest) return rest;
  }
  return text;
}

/** Main action and goals of the act, from the first sentence of the excerpt (the ementa). */
export function splitEmenta(excerpt: string, title = ''): { headline: string | null; goals: string[] } {
  const sentence = abbreviateReferences(firstSentence(stripActHeader(excerpt, title)).replace(BOILERPLATE, ''));
  if (!sentence.trim()) return { headline: null, goals: [] };

  const firstWord = normalize(sentence.split(' ', 1)[0]);
  const at = EMENTA_VERBS.has(firstWord) ? sentence.search(/,?\s+para\s+(?=[a-zà-ú]+(?:ar|er|ir|or)\s)/i) : -1;
  if (at < 0) return { headline: truncate(asSentence(capitalize(sentence)), MAX_HEADLINE), goals: [] };

  const main = sentence.slice(0, at);
  const rest = sentence.slice(at).replace(/^,?\s+para\s+/i, '');
  const goals = rest
    .split(GOAL_BOUNDARY)
    .map((goal) => goal.trim().replace(/[.,;\s]+$/, ''))
    .filter(Boolean)
    .map(capitalize);
  return { headline: truncate(asSentence(capitalize(main)), MAX_HEADLINE), goals };
}

// público afetado por termos explícitos (texto sem acentos, minúsculo)
const AUDIENCE: [RegExp, string][] = [
  [/\b(microempreendedor(es)? individua(l|is)|mei)\b/, 'Microempreendedores individuais (MEI)'],
  [/\b(simples nacional|microempresas?|empresas? de pequeno porte)\b/, 'Empresas do Simples Nacional'],
  [/\blucro real\b/, 'Empresas do Lucro Real'],
  [/\blucro presumido\b/, 'Empresas do Lucro Presumido'],
  [/\bpessoas? juridicas?\b/, 'Pessoas jurídicas'],
  [/\bpessoas? fisicas?\b/, 'Pessoas físicas'],
  [/\bempregador(es)?\b/, 'Empregadores'],
  [/\b(trabalhador(es)?|segurados?)\b/, 'Trabalhadores e segurados'],
  [/\bcontribuintes? do icms\b/, 'Contribuintes do ICMS'],
  [/\b(importador(es)?|exportador(es)?|importacao|exportacao)\b/, 'Importadores e exportadores'],
  [/\b(estados|distrito federal|municipios)\b/, 'Estados e municípios'],
];

// assuntos que, sozinhos, já indicam o público
const AUDIENCE_BY_SUBJECT: Record<string, string> = {
  esocial: 'Empregadores',
  trabalhista: 'Empregadores',
  icms: 'Contribuintes do ICMS',
  ipi: 'Contribuintes do IPI',
  'pis-cofins': 'Contribuintes de PIS e COFINS',
  'documentos-fiscais': 'Emissores de documentos fiscais eletrônicos',
};

/** Who the act affects, from explicit terms in the title and excerpt and from its subjects. */
export function affectedAudience(pub: Pick<Publication, 'title' | 'excerpt' | 'subjects'>): string[] {
  const text = normalize(`${pub.title} ${pub.excerpt || ''}`);
  const found = AUDIENCE.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  for (const subject of pub.subjects) {
    const label = AUDIENCE_BY_SUBJECT[subject];
    if (label) found.push(label);
  }
  return [...new Set(found)];
}

/** Whether the act is in force, in plain words. */
export function validityText(pub: Pick<Publication, 'normType' | 'effectiveDate'>): string {
  switch (pub.normType) {
    case 'Projeto de lei':
      return 'Projeto de lei em tramitação: ainda não produz efeitos.';
    case 'Comunicado informativo':
      return 'Comunicado informativo, sem força de norma.';
    case 'Norma com vigência futura':
      return pub.effectiveDate ? `Entra em vigor em ${formatDate(pub.effectiveDate)}.` : 'Vigência futura (data não identificada).';
    case 'Norma vigente':
      return pub.effectiveDate ? `Em vigor desde ${formatDate(pub.effectiveDate)}.` : 'Em vigor.';
    default:
      return 'Não identificada no trecho; confira no texto oficial.';
  }
}

/** Text split around the highlighted values, so they can be shown in bold. */
export function splitHighlights(text: string, values: string[]): { text: string; strong: boolean }[] {
  const wanted = [...new Set(values.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!wanted.length) return [{ text, strong: false }];
  const pattern = new RegExp(`(${wanted.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, strong: wanted.includes(part) }));
}

export function summarizePublication(pub: Publication): PublicationSummary {
  const { headline, goals } = splitEmenta(pub.excerpt || '', pub.title);
  const audience = affectedAudience(pub);
  const norms = citedNorms(pub);
  const facts = [
    { label: 'Vigência', value: validityText(pub) },
    ...(audience.length ? [{ label: 'Quem é afetado', value: audience.join(' · ') }] : []),
    ...(norms.length ? [{ label: 'Normas citadas', value: norms.join(' · ') }] : []),
  ];
  return { headline, goals, facts };
}
