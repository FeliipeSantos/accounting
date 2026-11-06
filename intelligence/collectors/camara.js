// Câmara dos Deputados — bills (PL, PLP, PEC) via the open data API v2.
const { cleanText, addDays } = require('../text');

const API_URL = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes';
const TYPES = ['PL', 'PLP', 'PEC'];
const TYPE_NAMES = { PL: 'Projeto de Lei', PLP: 'Projeto de Lei Complementar', PEC: 'Proposta de Emenda à Constituição' };
const MAX_DAYS_BACK = 7;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
// A API da Câmara costuma levar ~9 s por página
const TIMEOUT_MS = 45000;

function parsePage(json) {
  if (!json || !Array.isArray(json.dados)) throw new Error('Resposta da API da Câmara em formato inesperado');
  return json.dados.map((p) => ({
    externalId: String(p.id),
    title: `${p.siglaTipo} ${p.numero}/${p.ano}`,
    url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${encodeURIComponent(p.id)}`,
    publishedAt: (String(p.dataApresentacao || '').match(/^\d{4}-\d{2}-\d{2}/) || [null])[0],
    // dataApresentacao vem como "2026-11-05T16:19"
    publishedTime: (String(p.dataApresentacao || '').match(/T(\d{2}:\d{2})/) || [null, null])[1],
    excerpt: cleanText(p.ementa || ''),
    actType: TYPE_NAMES[p.siglaTipo] || p.siglaTipo,
    organ: 'Câmara dos Deputados',
  }));
}

async function collect({ fetchJson, today, since }) {
  const from = since > addDays(today, -MAX_DAYS_BACK) ? since : addDays(today, -MAX_DAYS_BACK);
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      siglaTipo: TYPES.join(','),
      dataApresentacaoInicio: from,
      dataApresentacaoFim: today,
      ordem: 'DESC',
      ordenarPor: 'id',
      itens: String(PAGE_SIZE),
      pagina: String(page),
    });
    const batch = parsePage(await fetchJson(`${API_URL}?${params}`, { timeoutMs: TIMEOUT_MS }));
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

module.exports = { collect, parsePage };
