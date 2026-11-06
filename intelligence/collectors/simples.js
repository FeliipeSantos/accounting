// Portal do Simples Nacional — news listing page (no feed available).
const { cleanText, htmlToText, parseBrDate } = require('../text');

const BASE_URL = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/';
const LIST_URL = `${BASE_URL}TodasNoticias.aspx`;

function parseList(html) {
  const start = html.indexOf('id="listaNoticias"');
  if (start < 0) throw new Error('Estrutura da página de notícias do Simples Nacional mudou (lista não encontrada)');
  const blocks = html.slice(start).split(/<h4>/).slice(1);
  return blocks
    .map((block) => {
      const link = block.match(/<a href="(NoticiaCompleta\.aspx\?id=([\w-]+))"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) return null;
      // data e resumo ficam no parágrafo "<span>dd/mm/aaaa</span> - <span>resumo</span>"
      const paragraph = block.match(/<p>([\s\S]*?)<\/p>/);
      const paragraphText = paragraph ? htmlToText(paragraph[1]) : '';
      return {
        externalId: link[2],
        title: cleanText(htmlToText(link[3]), 500),
        url: new URL(link[1], BASE_URL).href,
        publishedAt: parseBrDate(paragraphText),
        excerpt: cleanText(paragraphText.replace(/^\d{2}\/\d{2}\/\d{4}\s*-\s*/, '')),
        actType: 'Notícia',
        organ: 'Comitê Gestor do Simples Nacional',
      };
    })
    .filter(Boolean);
}

async function collect({ fetchText, since }) {
  const items = parseList(await fetchText(LIST_URL));
  return items.filter((item) => !item.publishedAt || item.publishedAt >= since);
}

module.exports = { collect, parseList };
