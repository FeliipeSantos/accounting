// Receita Federal — news listing page. The official RSS feed was discarded:
// on 2026-11-06 its newest news item was from July while the page had November news.
const { createNewsCollector } = require('./govbr-news');

module.exports = createNewsCollector('https://www.gov.br/receitafederal/pt-br/assuntos/noticias', 'Receita Federal');
