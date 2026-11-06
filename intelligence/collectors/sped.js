// SPED — highlights on the official home page (HTTP only; HTTPS times out).
const { cleanText, htmlToText, parseBrDate } = require('../text');

const BASE_URL = 'http://sped.rfb.gov.br';

function parseHome(html) {
  const sections = html.match(/<section class="destaque">[\s\S]*?<\/section>/g);
  if (!sections) throw new Error('Estrutura da página do SPED mudou (destaques não encontrados)');
  return sections
    .map((block) => {
      const link = block.match(/<h2>\s*<a href="(\/item\/show\/(\d+))"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) return null;
      const paragraphs = [...block.matchAll(/<p(?: class="([^"]*)")?>([\s\S]*?)<\/p>/g)];
      const date = paragraphs.find((p) => p[1] === 'data');
      const summary = paragraphs.find((p) => !p[1]);
      return {
        externalId: link[2],
        title: cleanText(htmlToText(link[3]), 500),
        url: `${BASE_URL}${link[1]}`,
        publishedAt: parseBrDate(date && htmlToText(date[2])),
        excerpt: summary ? cleanText(htmlToText(summary[2]).replace(/\s*Continue lendo\s*\.?\s*$/i, '')) : '',
        actType: 'Destaque',
        organ: 'SPED — Receita Federal',
      };
    })
    .filter(Boolean);
}

async function collect({ fetchText, since }) {
  const items = parseHome(await fetchText(`${BASE_URL}/`));
  return items.filter((item) => !item.publishedAt || item.publishedAt >= since);
}

module.exports = { collect, parseHome };
