// Rule-based classification (no AI): subjects by keywords, relevance by act type,
// and norm type / effective date by explicit phrases in the official text.
const { SOURCES, SUBJECTS } = require('./catalog');
const { normalizeForMatch, parseBrDate } = require('./text');

// Peso por tipo de ato (prefixo normalizado do tipo, peso, nome exibido).
// Ordem importa: o mais específico primeiro.
const ACT_WEIGHTS = [
  ['emenda constitucional', 3, 'Emenda Constitucional'],
  ['lei complementar', 3, 'Lei Complementar'],
  ['medida provisoria', 3, 'Medida Provisória'],
  ['lei', 3, 'Lei'],
  ['decreto', 2, 'Decreto'],
  ['instrucao normativa', 2, 'Instrução Normativa'],
  ['resolucao', 2, 'Resolução'],
  ['convenio', 2, 'Convênio'],
  ['ajuste', 2, 'Ajuste'],
  ['protocolo', 2, 'Protocolo'],
  ['portaria conjunta', 2, 'Portaria Conjunta'],
  ['portaria normativa', 2, 'Portaria Normativa'],
  ['portaria', 1, 'Portaria'],
  ['ato declaratorio', 1, 'Ato Declaratório'],
  ['solucao de consulta', 1, 'Solução de Consulta'],
  ['parecer normativo', 1, 'Parecer Normativo'],
  ['nota tecnica', 1, 'Nota Técnica'],
  ['ato cotepe', 1, 'Ato COTEPE'],
  ['despacho', 1, 'Despacho'],
];

const REFORM_SUBJECTS = new Set(['reforma-tributaria', 'ibs-cbs', 'imposto-seletivo']);

/** Human-readable rules, shown in the settings screen. */
const RULES_DESCRIPTION = [
  'Assuntos: palavras-chave encontradas no título ou no trecho oficial (sem acentos, palavra inteira). Simples Nacional, CONFAZ, SPED e eSocial já trazem o assunto da própria fonte.',
  'Peso do ato: 3 para Emenda Constitucional, Lei Complementar, Lei e Medida Provisória; 2 para Decreto, Instrução Normativa, Resolução, Convênio, Ajuste, Protocolo e Portarias conjuntas/normativas; 1 para Portaria, Ato Declaratório, Solução de Consulta, Parecer Normativo, Nota Técnica e Despacho; 0 para notícias, comunicados e projetos de lei.',
  'Relevância: peso do ato + 1 se tratar da Reforma Tributária (IBS, CBS ou Imposto Seletivo). 4 ou mais = Crítica, 3 = Alta, 1–2 = Média, 0 = Baixa.',
  'Classificação: projetos de lei vêm da Câmara; notícias e comunicados são informativos; para normas, a vigência só é indicada quando o texto oficial a declara expressamente.',
];

function wordPattern(term) {
  const escaped = normalizeForMatch(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
}

const keywordPatterns = new Map(SUBJECTS.map((s) => [s.id, s.keywords.map((k) => [k, wordPattern(k)])]));
const excludePatterns = new Map(SUBJECTS.map((s) => [s.id, (s.exclude || []).map(wordPattern)]));

/**
 * Subjects whose keywords appear in the text (and none of whose exclusion terms do),
 * with the keywords found.
 * @returns {{ id: string, terms: string[] }[]}
 */
function matchSubjectsDetailed(text) {
  const normalized = normalizeForMatch(text);
  return SUBJECTS.map((s) => ({
    id: s.id,
    terms: keywordPatterns.get(s.id).filter(([, re]) => re.test(normalized)).map(([term]) => term),
    excluded: excludePatterns.get(s.id).some((re) => re.test(normalized)),
  }))
    .filter((m) => m.terms.length && !m.excluded)
    .map(({ id, terms }) => ({ id, terms }));
}

/**
 * Returns the subject ids matched in the text.
 */
function matchSubjects(text) {
  return matchSubjectsDetailed(text).map((m) => m.id);
}

/**
 * Weight of the act type. The title is used only when the source gives no type,
 * so a news headline mentioning "Lei ..." is not weighed as a law.
 */
function actRule(actType, title) {
  const candidate = normalizeForMatch(actType || title).trim();
  if (!candidate) return { weight: 0, label: null };
  // prefixo seguido de fim ou não-letra: "lei" não casa com "leilao"
  const match = ACT_WEIGHTS.find(([prefix]) => candidate.startsWith(prefix) && !/[a-z]/.test(candidate.charAt(prefix.length)));
  return match ? { weight: match[1], label: match[2] } : { weight: 0, label: null };
}

function actWeight(actType, title) {
  return actRule(actType, title).weight;
}

function relevanceFromScore(score) {
  if (score >= 4) return 'critica';
  if (score === 3) return 'alta';
  if (score >= 1) return 'media';
  return 'baixa';
}

const EFFECTIVE_ON_PUBLICATION = /entr(?:a|ara) em vigor na data de (?:sua )?publicacao/;
const EFFECTIVE_ON_DATE =
  /(?:entr(?:a|ara) em vigor|produz(?:indo|ira|e)? efeitos?)\s+(?:a partir\s+)?(?:de|em|do dia)\s+(\d{1,2}\s*(?:o\s*)?de\s+[a-z]+\s+de\s+\d{4})/;

/**
 * Detects norm type and effective date only from explicit phrases.
 */
function detectNormType({ sourceId, weight, text, publishedAt }) {
  if (sourceId === 'camara') return { normType: 'Projeto de lei', effectiveDate: null };
  if (weight === 0) return { normType: 'Comunicado informativo', effectiveDate: null };

  const normalized = normalizeForMatch(text);
  if (EFFECTIVE_ON_PUBLICATION.test(normalized)) {
    return { normType: 'Norma vigente', effectiveDate: publishedAt || null };
  }
  const dated = normalized.match(EFFECTIVE_ON_DATE);
  if (dated) {
    const effectiveDate = parseBrDate(dated[1]);
    if (effectiveDate) {
      const future = publishedAt ? effectiveDate > publishedAt : false;
      return { normType: future ? 'Norma com vigência futura' : 'Norma vigente', effectiveDate };
    }
  }
  return { normType: 'Norma publicada (vigência não identificada no trecho)', effectiveDate: null };
}

/**
 * Classifies a collected item and records why (shown to the user).
 * @param {{ sourceId: string, title: string, excerpt?: string, actType?: string, publishedAt?: string }} item
 * @param {string[]} enabledSubjects Subject ids currently monitored.
 * @returns {{ relevant: boolean, subjects: string[], relevance: string, normType: string, effectiveDate: string|null,
 *   classificationReason: { actType: string|null, actLabel: string|null, weight: number, reformBonus: number,
 *   reformSubjects: string[], score: number, subjects: { id: string, via: 'source'|'keywords', terms: string[] }[] } }}
 */
function classify(item, enabledSubjects) {
  const enabled = new Set(enabledSubjects);
  const source = SOURCES.find((s) => s.id === item.sourceId);
  const text = `${item.title}\n${item.excerpt || ''}`;

  const matched = new Map(matchSubjectsDetailed(text).map((m) => [m.id, m.terms]));
  const subjects = [...new Set([...(source?.defaultSubjects || []), ...matched.keys()])].filter((id) => enabled.has(id));
  const { weight, label } = actRule(item.actType, item.title);
  const reformSubjects = subjects.filter((id) => REFORM_SUBJECTS.has(id));
  const reformBonus = reformSubjects.length ? 1 : 0;
  const score = weight + reformBonus;

  return {
    relevant: subjects.length > 0,
    subjects,
    relevance: relevanceFromScore(score),
    ...detectNormType({ sourceId: item.sourceId, weight, text, publishedAt: item.publishedAt }),
    classificationReason: {
      actType: item.actType || null,
      actLabel: label,
      weight,
      reformBonus,
      reformSubjects,
      score,
      // via "source": assunto da própria fonte; via "keywords": termos encontrados no texto
      subjects: subjects.map((id) => ({ id, via: matched.has(id) ? 'keywords' : 'source', terms: matched.get(id) || [] })),
    },
  };
}

module.exports = { classify, matchSubjects, matchSubjectsDetailed, actWeight, RULES_DESCRIPTION };
