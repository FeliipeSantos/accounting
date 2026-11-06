// Static catalog of monitored sources and subjects for the Inteligência Contábil module.
// Feasibility was verified with real requests on 2026-11-06 (see intelligence/SOURCES.md).
// No source blocks automated access in the current catalog; nothing is bypassed.

/**
 * @typedef {Object} SourceDefinition
 * @property {string} id Stable identifier used in the database.
 * @property {string} name Display name.
 * @property {string} url Official URL used for collection or reference.
 * @property {'dou-json'|'api'|'rss'|'html'|'none'} method Collection method.
 * @property {boolean} collectable Whether direct collection is technically viable.
 * @property {string} coverage How the source content reaches the module.
 * @property {string[]} [defaultSubjects] Subjects implied by the source itself
 *   (its whole content is in scope even without keyword matches).
 */

/** @type {SourceDefinition[]} */
const SOURCES = [
  {
    id: 'dou',
    name: 'Diário Oficial da União',
    url: 'https://www.in.gov.br/leiturajornal',
    method: 'dou-json',
    collectable: true,
    coverage: 'Coleta direta da Seção 1 (JSON estruturado da página oficial de leitura do jornal).',
  },
  {
    id: 'receita',
    name: 'Receita Federal',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias',
    method: 'html',
    collectable: true,
    coverage: 'Notícias via página oficial (o feed RSS está desatualizado); atos normativos (IN, ADI, Soluções de Consulta) via DOU.',
  },
  {
    id: 'fazenda',
    name: 'Ministério da Fazenda',
    url: 'https://www.gov.br/fazenda/pt-br/assuntos/noticias',
    method: 'html',
    collectable: true,
    coverage: 'Notícias via página oficial (sem feed disponível); portarias via DOU.',
  },
  {
    id: 'simples',
    name: 'Portal do Simples Nacional',
    url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/TodasNoticias.aspx',
    method: 'html',
    collectable: true,
    coverage: 'Notícias via página oficial (sem feed disponível); resoluções do CGSN também via DOU.',
    defaultSubjects: ['simples-nacional'],
  },
  {
    id: 'confaz',
    name: 'CONFAZ',
    url: 'https://www.confaz.fazenda.gov.br/legislacao/convenios',
    method: 'html',
    collectable: true,
    coverage:
      'Convênios ICMS via página oficial. Ajustes SINIEF exigem login no site e vêm do DOU, onde são obrigatoriamente publicados.',
    defaultSubjects: ['icms'],
  },
  {
    id: 'sped',
    name: 'SPED',
    url: 'http://sped.rfb.gov.br/',
    method: 'html',
    collectable: true,
    coverage: 'Destaques da página oficial (o site responde apenas via HTTP).',
    defaultSubjects: ['sped'],
  },
  {
    id: 'esocial',
    name: 'eSocial',
    url: 'https://www.gov.br/esocial/pt-br/noticias',
    method: 'html',
    collectable: true,
    coverage: 'Notícias e comunicados via página oficial (sem feed disponível).',
    defaultSubjects: ['esocial'],
  },
  {
    id: 'legislacao',
    name: 'Legislação Federal',
    url: 'https://legis.senado.leg.br/dadosabertos/legislacao/lista',
    method: 'api',
    collectable: true,
    coverage:
      'Leis, leis complementares, decretos e medidas provisórias via API de Dados Abertos do Senado (o Planalto e o LexML recusam acesso automatizado).',
  },
  {
    id: 'camara',
    name: 'Câmara dos Deputados — Projetos de Lei',
    url: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes',
    method: 'api',
    collectable: true,
    coverage: 'Projetos de lei e de lei complementar em tramitação via API de Dados Abertos da Câmara (fonte adicional, fora da lista original).',
  },
];

/**
 * Monitored subjects. Keywords are matched (accent and case insensitive, whole
 * words) against title and excerpt; any "exclude" term cancels the subject.
 */
const SUBJECTS = [
  { id: 'reforma-tributaria', name: 'Reforma Tributária', keywords: ['reforma tributaria', 'lc 214', 'lei complementar n 214', 'ec 132', 'emenda constitucional n 132', 'comite gestor'] },
  { id: 'ibs-cbs', name: 'IBS e CBS', keywords: ['ibs', 'cbs', 'imposto sobre bens e servicos', 'contribuicao sobre bens e servicos'] },
  { id: 'imposto-seletivo', name: 'Imposto Seletivo', keywords: ['imposto seletivo'] },
  { id: 'simples-nacional', name: 'Simples Nacional', keywords: ['simples nacional', 'cgsn', 'microempreendedor individual', 'mei', 'pgdas'] },
  { id: 'lucro-presumido', name: 'Lucro Presumido', keywords: ['lucro presumido'] },
  { id: 'lucro-real', name: 'Lucro Real', keywords: ['lucro real', 'lalur', 'lacs'] },
  { id: 'irpj-csll', name: 'IRPJ e CSLL', keywords: ['irpj', 'csll', 'imposto sobre a renda das pessoas juridicas', 'contribuicao social sobre o lucro'] },
  { id: 'pis-cofins', name: 'PIS e COFINS', keywords: ['pis', 'pasep', 'cofins'] },
  { id: 'icms', name: 'ICMS', keywords: ['icms', 'convenio icms', 'ajuste sinief', 'substituicao tributaria'] },
  { id: 'iss', name: 'ISS', keywords: ['iss', 'issqn', 'imposto sobre servicos'] },
  { id: 'ipi', name: 'IPI', keywords: ['ipi', 'tipi', 'imposto sobre produtos industrializados'] },
  { id: 'obrigacoes-acessorias', name: 'Obrigações acessórias', keywords: ['obrigacao acessoria', 'obrigacoes acessorias', 'dctf', 'dctfweb', 'dirf', 'ecf', 'ecd', 'efd', 'perdcomp', 'mit'] },
  { id: 'sped', name: 'SPED', keywords: ['sped', 'efd-reinf', 'efd contribuicoes', 'efd icms', 'escrituracao contabil digital', 'escrituracao contabil fiscal'], exclude: ['recof-sped', 'recof sped', 'repetro-sped', 'repetro sped'] },
  { id: 'esocial', name: 'eSocial', keywords: ['esocial', 'e-social', 'fgts digital'] },
  { id: 'trabalhista', name: 'Legislação trabalhista', keywords: ['clt', 'consolidacao das leis do trabalho', 'trabalhista', 'salario minimo', 'ministerio do trabalho'] },
  // "previdência" isolado traz previdência complementar (PREVIC) e programas sociais
  { id: 'previdenciaria', name: 'Legislação previdenciária', keywords: ['inss', 'rgps', 'regime geral de previdencia social', 'contribuicao previdenciaria', 'contribuicoes previdenciarias', 'salario de contribuicao', 'cprb', 'fator acidentario'] },
  { id: 'documentos-fiscais', name: 'Documentos fiscais eletrônicos', keywords: ['nf-e', 'nfe', 'nfc-e', 'nfs-e', 'ct-e', 'mdf-e', 'nota fiscal eletronica', 'documento fiscal eletronico'] },
];

/** Relevance levels shown in filters, from highest to lowest. */
const RELEVANCE_LEVELS = ['critica', 'alta', 'media', 'baixa'];

module.exports = { SOURCES, SUBJECTS, RELEVANCE_LEVELS };
