// Legislação Federal — Senado Federal open data API (laws, complementary laws,
// decrees, provisional measures and constitutional amendments).
const { cleanText, parseBrDate } = require('../text');

const API_URL = 'https://legis.senado.leg.br/dadosabertos/legislacao/lista';
const TYPES = ['EMC', 'LCP', 'LEI', 'MPV', 'DEC'];

function parseList(json) {
  const docs = json?.ListaDocumento?.documentos?.documento;
  if (docs === undefined) {
    if (json?.ListaDocumento) return []; // ano sem normas desse tipo
    throw new Error('Resposta da API do Senado em formato inesperado');
  }
  return (Array.isArray(docs) ? docs : [docs]).map((doc) => ({
    externalId: String(doc.id),
    title: cleanText(doc.normaNome || `${doc.descricao} nº ${doc.numero}`, 500),
    url: `https://legis.senado.leg.br/norma/${encodeURIComponent(doc.id)}`,
    // a API informa a data de assinatura; a publicação no DOU costuma ser no mesmo dia ou no seguinte
    publishedAt: parseBrDate(doc.dataassinatura),
    excerpt: cleanText(doc.ementa || ''),
    actType: doc.descricao || doc.tipo || '',
    organ: 'Presidência da República / Congresso Nacional',
  }));
}

async function collect({ fetchJson, today, since }) {
  const years = [...new Set([since.slice(0, 4), today.slice(0, 4)])];
  const items = [];
  for (const year of years) {
    for (const type of TYPES) {
      items.push(...parseList(await fetchJson(`${API_URL}?tipo=${type}&ano=${year}`)));
    }
  }
  return items.filter((item) => item.publishedAt && item.publishedAt >= since);
}

module.exports = { collect, parseList };
