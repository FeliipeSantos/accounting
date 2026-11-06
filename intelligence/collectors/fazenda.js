// Ministério da Fazenda — news listing page (no feed available).
const { createNewsCollector } = require('./govbr-news');

module.exports = createNewsCollector('https://www.gov.br/fazenda/pt-br/assuntos/noticias', 'Ministério da Fazenda');
