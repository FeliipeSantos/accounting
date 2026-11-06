// Shared parsers for gov.br portals (Plone): news listings ("ul.noticias" layout),
// used by Receita Federal and Ministério da Fazenda, and the publication time
// shown on each article page, also used by eSocial.
const { decodeEntities, cleanText, htmlToText, parseBrDate } = require('../text');

// Páginas de notícia abertas por execução para ler o horário (só itens novos)
const MAX_ARTICLE_PAGES_PER_RUN = 20;

/**
 * Parses each "h2.titulo" headline with its date and description.
 * @param {string} html
 * @param {string} organ Organ name stored with each item.
 */
function parseNewsList(html, organ) {
  const start = html.indexOf('class="noticias');
  if (start < 0) throw new Error(`Estrutura da página de notícias (${organ}) mudou (lista não encontrada)`);
  const blocks = html.slice(start).split('<h2 class="titulo">').slice(1);
  return blocks
    .map((block) => {
      const link = block.match(/^\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) return null;
      const url = decodeEntities(link[1]);
      const description = block.match(/<span class="descricao">([\s\S]*?)<\/span>\s*(?:<div|<\/div>)/);
      const descText = description ? htmlToText(description[1]) : '';
      return {
        externalId: url,
        title: cleanText(htmlToText(link[2]), 500),
        url,
        publishedAt: parseBrDate((block.match(/<span class="data">\s*([\d/]+)\s*<\/span>/) || [])[1]),
        // remove a data repetida no início da descrição ("05/11/2026 - ...")
        excerpt: cleanText(descText.replace(/^\d{2}\/\d{2}\/\d{4}\s*-\s*/, '')),
        actType: 'Notícia',
        organ,
      };
    })
    .filter(Boolean);
}

/**
 * Reads "Publicado em dd/mm/aaaa HHhMM" from a gov.br article page.
 * @returns {{ date: string|null, time: string|null }}
 */
function parseArticlePublished(html) {
  const match = String(html).match(/class="documentPublished"[\s\S]{0,400}?(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2})h(\d{2})/);
  if (!match) return { date: null, time: null };
  return { date: parseBrDate(match[1]), time: `${match[2].padStart(2, '0')}:${match[3]}` };
}

/**
 * Adds the publication time to new items by opening their article pages.
 * A page that fails or has no time leaves the item without time (never guessed).
 */
async function addPublishedTimes(items, { fetchText, isKnown }) {
  const pending = items.filter((item) => !(isKnown && isKnown(item.externalId))).slice(0, MAX_ARTICLE_PAGES_PER_RUN);
  for (const item of pending) {
    try {
      const { date, time } = parseArticlePublished(await fetchText(item.url));
      // só usa o horário se a data da página bater com a da listagem
      if (time && (!item.publishedAt || date === item.publishedAt)) item.publishedTime = time;
    } catch {
      // falha ao abrir a página da notícia não invalida a coleta da fonte
    }
  }
  return items;
}

/**
 * Builds a collector for a gov.br news listing URL.
 */
function createNewsCollector(listUrl, organ) {
  return {
    async collect({ fetchText, since, isKnown }) {
      const items = parseNewsList(await fetchText(listUrl), organ).filter((item) => !item.publishedAt || item.publishedAt >= since);
      return addPublishedTimes(items, { fetchText, isKnown });
    },
    parseList: (html) => parseNewsList(html, organ),
  };
}

module.exports = { parseNewsList, parseArticlePublished, addPublishedTimes, createNewsCollector };
