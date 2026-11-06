// Registry of collectors by source id (must match intelligence/catalog.js).
module.exports = {
  dou: require('./dou'),
  receita: require('./receita'),
  fazenda: require('./fazenda'),
  simples: require('./simples'),
  confaz: require('./confaz'),
  sped: require('./sped'),
  esocial: require('./esocial'),
  legislacao: require('./legislacao'),
  camara: require('./camara'),
};
