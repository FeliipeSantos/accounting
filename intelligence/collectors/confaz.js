// CONFAZ — Convênios ICMS. The yearly listing gives number and summary; the
// publication date comes from each convênio page ("Publicado no DOU de dd.mm.aa").
const { decodeEntities, cleanText, htmlToText, parseBrDate } = require('../text');

const BASE_URL = 'https://www.confaz.fazenda.gov.br/legislacao/convenios';
// Limita páginas de detalhe por execução (só convênios ainda não coletados)
const MAX_DETAILS_PER_RUN = 15;

function parseYearList(html, year) {
  const pattern = new RegExp(`<a href="(${BASE_URL.replace(/[.]/g, '\\.')}/${year}/(CV(\\d+)_\\d+))" title="([^"]*)"[^>]*>\\s*<span>([^<]*)</span>`, 'g');
  const items = [...html.matchAll(pattern)].map((m) => ({
    externalId: m[2],
    number: Number(m[3]),
    url: m[1],
    title: cleanText(decodeEntities(m[5]), 500),
    excerpt: cleanText(decodeEntities(m[4])),
  }));
  if (!items.length && !/navTree/.test(html)) throw new Error('Estrutura da página de convênios do CONFAZ mudou');
  return items;
}

function parseDetail(html) {
  // lê só o bloco de conteúdo e sem limite de tamanho (o cabeçalho do site é longo)
  const start = html.indexOf('parent-fieldname-text');
  const text = htmlToText(start >= 0 ? html.slice(start) : html, Infinity);
  const published = text.match(/Publicado no DOU de\s*([\d.\/]+)/i);
  const heading = text.match(/CONV[ÊE]NIO ICMS N[º°o]?\s*\d+\s*,?\s*DE\s+([^\n.]+?\d{4})/i);
  return {
    publishedAt: parseBrDate(published && published[1]) || parseBrDate(heading && heading[1]),
    title: heading ? cleanText(heading[0], 500) : null,
  };
}

async function collect({ fetchText, today, since, isKnown }) {
  const years = [...new Set([since.slice(0, 4), today.slice(0, 4)])];
  const listed = [];
  for (const year of years) {
    listed.push(...parseYearList(await fetchText(`${BASE_URL}/${year}`), year));
  }

  // A numeração é sequencial: percorre do mais novo para o mais antigo e para no
  // primeiro já coletado, para não avançar sobre convênios antigos a cada execução.
  const newestFirst = listed.sort((a, b) => b.externalId.slice(-2).localeCompare(a.externalId.slice(-2)) || b.number - a.number);
  const pending = [];
  for (const item of newestFirst) {
    if (isKnown(item.externalId) || pending.length >= MAX_DETAILS_PER_RUN) break;
    pending.push(item);
  }

  const items = [];
  for (const item of pending) {
    // sem a linha de publicação na página, a data fica em branco (não é deduzida)
    const detail = parseDetail(await fetchText(item.url));
    if (detail.publishedAt && detail.publishedAt < since) continue;
    items.push({
      externalId: item.externalId,
      title: detail.title || item.title,
      url: item.url,
      publishedAt: detail.publishedAt,
      excerpt: item.excerpt,
      actType: 'Convênio ICMS',
      organ: 'CONFAZ',
    });
  }
  return items;
}

module.exports = { collect, parseYearList, parseDetail };
