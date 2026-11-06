// eSocial — news listing page (Plone collection, no feed available).
const { decodeEntities, cleanText, htmlToText, parseBrDate } = require('../text');
const { addPublishedTimes } = require('./govbr-news');

const LIST_URL = 'https://www.gov.br/esocial/pt-br/noticias';

function parseList(html) {
  const blocks = html.match(/<article class="tileItem[\s\S]*?<\/article>/g);
  if (!blocks) throw new Error('Estrutura da página de notícias do eSocial mudou (itens não encontrados)');
  return blocks
    .map((block) => {
      const link = block.match(/<a class="summary url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) return null;
      const url = decodeEntities(link[1]);
      const description = block.match(/<span class="description">([\s\S]*?)<\/span>/);
      const byline = block.match(/<span class="documentByLine">([\s\S]*)$/);
      const title = cleanText(htmlToText(link[2]), 500);
      return {
        externalId: url,
        title,
        url,
        publishedAt: parseBrDate(byline ? htmlToText(byline[1]) : ''),
        excerpt: description ? cleanText(htmlToText(description[1])) : '',
        // notas técnicas e comunicados são identificados pelo título
        actType: /^nota t[ée]cnica/i.test(title) ? 'Nota Técnica' : 'Notícia',
        organ: 'eSocial',
      };
    })
    .filter(Boolean);
}

async function collect({ fetchText, since, isKnown }) {
  const items = parseList(await fetchText(LIST_URL)).filter((item) => !item.publishedAt || item.publishedAt >= since);
  // o horário só aparece na página de cada notícia
  return addPublishedTimes(items, { fetchText, isKnown });
}

module.exports = { collect, parseList };
