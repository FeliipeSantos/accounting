// Diário Oficial da União — Seção 1 (and extra edition), via the JSON embedded
// in the official "leitura do jornal" page.
const { decodeEntities, cleanText, parseBrDate, addDays } = require('../text');

const MAX_DAYS_BACK = 7;
const SECTIONS = ['do1', 'do1e'];

// Órgãos de interesse contábil/fiscal/trabalhista (primeiro nível da hierarquia)
const ORGANS = [
  'Ministério da Fazenda',
  'Presidência da República',
  'Atos do Poder Legislativo',
  'Atos do Poder Executivo',
  'Congresso Nacional',
  'Ministério do Trabalho e Emprego',
  'Ministério da Previdência Social',
];

// Tipos sem conteúdo normativo (pautas de julgamento, atas)
const IGNORED_TYPES = new Set(['Pauta', 'Ata', 'Extrato da Ata']);

/**
 * Extracts the acts list from the page; throws if the page layout changed.
 */
function parseDouPage(html) {
  const match = html.match(/<script id="params" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Estrutura da página do DOU mudou (bloco "params" não encontrado)');
  const params = JSON.parse(match[1]);
  if (!Array.isArray(params.jsonArray)) throw new Error('Estrutura da página do DOU mudou (jsonArray ausente)');
  return params.jsonArray;
}

function toItem(act) {
  return {
    externalId: act.urlTitle,
    title: cleanText(decodeEntities(act.title || act.titulo || ''), 500),
    url: `https://www.in.gov.br/web/dou/-/${encodeURIComponent(act.urlTitle)}`,
    publishedAt: parseBrDate(act.pubDate),
    excerpt: cleanText(decodeEntities(act.content || '')),
    actType: act.artType || '',
    organ: act.hierarchyStr || '',
  };
}

function isOfInterest(act) {
  if (!act.urlTitle || IGNORED_TYPES.has(act.artType)) return false;
  const organ = act.hierarchyStr || '';
  return ORGANS.some((o) => organ === o || organ.startsWith(`${o}/`));
}

async function collect({ fetchText, today, since }) {
  const first = since > addDays(today, -MAX_DAYS_BACK) ? since : addDays(today, -MAX_DAYS_BACK);
  const items = [];
  for (let day = first; day <= today; day = addDays(day, 1)) {
    const [y, m, d] = day.split('-');
    for (const section of SECTIONS) {
      const html = await fetchText(`https://www.in.gov.br/leiturajornal?data=${d}-${m}-${y}&secao=${section}`);
      items.push(...parseDouPage(html).filter(isOfInterest).map(toItem));
    }
  }
  return items;
}

module.exports = { collect, parseDouPage };
