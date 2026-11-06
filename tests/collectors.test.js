// Parser tests. The samples are minimal excerpts that mirror the markup/JSON
// observed on the official sites on 2026-11-06 (see intelligence/SOURCES.md).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const dou = require('../intelligence/collectors/dou');
const { parseNewsList, parseArticlePublished, createNewsCollector } = require('../intelligence/collectors/govbr-news');
const simples = require('../intelligence/collectors/simples');
const confaz = require('../intelligence/collectors/confaz');
const sped = require('../intelligence/collectors/sped');
const esocial = require('../intelligence/collectors/esocial');
const legislacao = require('../intelligence/collectors/legislacao');
const camara = require('../intelligence/collectors/camara');

describe('DOU', () => {
  const page = `<html><script id="params" type="application/json">${JSON.stringify({
    jsonArray: [
      { urlTitle: 'in-rfb-1', title: 'INSTRUÇÃO NORMATIVA RFB Nº 1', pubDate: '05/11/2026', content: 'Dispõe sobre a ECF', artType: 'Instrução Normativa', hierarchyStr: 'Ministério da Fazenda/Secretaria Especial da Receita Federal do Brasil' },
      { urlTitle: 'pauta-1', title: 'PAUTA', pubDate: '05/11/2026', content: '', artType: 'Pauta', hierarchyStr: 'Ministério da Fazenda/Delegacia de Julgamento' },
      { urlTitle: 'mec-1', title: 'PORTARIA MEC', pubDate: '05/11/2026', content: '', artType: 'Portaria', hierarchyStr: 'Ministério da Educação' },
    ],
  })}</script></html>`;

  test('parses acts and keeps only organs and types of interest', async () => {
    const items = await dou.collect({ fetchText: async () => page, today: '2026-11-05', since: '2026-11-05' });
    // do1 + do1e com a mesma página de exemplo
    assert.equal(items.length, 2);
    assert.equal(items[0].externalId, 'in-rfb-1');
    assert.equal(items[0].url, 'https://www.in.gov.br/web/dou/-/in-rfb-1');
    assert.equal(items[0].publishedAt, '2026-11-05');
  });

  test('reports a layout change instead of returning nothing', () => {
    assert.throws(() => dou.parseDouPage('<html>sem dados</html>'), /Estrutura da página do DOU mudou/);
  });

  test('never reads more than 7 days back', async () => {
    const urls = [];
    await dou.collect({ fetchText: async (u) => (urls.push(u), page), today: '2026-11-30', since: '2026-10-01' });
    assert.equal(urls.length, 16, '8 days x 2 sections');
  });
});

describe('gov.br news (Receita / Fazenda)', () => {
  const html = `<ul class="noticias listagem-noticias-com-foto"><li><div class="conteudo">
    <h2 class="titulo"> <a href="https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/novembro/x">Receita &amp; prazos da DCTFWeb</a> </h2>
    <span class="descricao"> <span class="data"> 06/11/2026 </span> <span> - </span> Novo prazo para entrega </span> <div class="subject-noticia"></div></div></li></ul>`;

  test('parses headline, date and description', () => {
    const [item] = parseNewsList(html, 'Receita Federal');
    assert.equal(item.title, 'Receita & prazos da DCTFWeb');
    assert.equal(item.publishedAt, '2026-11-06');
    assert.equal(item.excerpt, 'Novo prazo para entrega');
    assert.equal(item.organ, 'Receita Federal');
  });

  const article = (date, time) =>
    `<span class="documentPublished"> <span>Publicado em</span> <span class="value">${date} ${time}</span> </span><span class="documentModified"><span class="value">06/11/2026 10h28</span></span>`;

  test('reads the publication time from the article page (not the update time)', () => {
    assert.deepEqual(parseArticlePublished(article('05/11/2026', '9h42')), { date: '2026-11-05', time: '09:42' });
    assert.deepEqual(parseArticlePublished('<p>sem data</p>'), { date: null, time: null });
  });

  test('adds the time only to new items and only when the article date matches', async () => {
    const collector = createNewsCollector('https://www.gov.br/receitafederal/pt-br/assuntos/noticias', 'Receita Federal');
    const listing = html.replace('</li></ul>', '</li><li><h2 class="titulo"> <a href="https://www.gov.br/receitafederal/old">Antiga</a> </h2><span class="descricao"> <span class="data"> 06/11/2026 </span> - x </span> <div></div></li></ul>');
    const opened = [];
    const items = await collector.collect({
      since: '2026-11-01',
      isKnown: (id) => id.endsWith('/old'),
      fetchText: async (url) => {
        if (url.endsWith('/noticias')) return listing;
        opened.push(url);
        return article('06/11/2026', '14h20');
      },
    });
    assert.equal(items[0].publishedTime, '14:20');
    assert.equal(items[1].publishedTime, undefined, 'known item is not reopened');
    assert.equal(opened.length, 1);

    const mismatch = await collector.collect({ since: '2026-11-01', isKnown: () => false, fetchText: async (u) => (u.endsWith('/noticias') ? html : article('01/01/2020', '08h00')) });
    assert.equal(mismatch[0].publishedTime, undefined, 'a different date on the page is not trusted');
  });

  test('a failing article page does not fail the source', async () => {
    const collector = createNewsCollector('https://www.gov.br/receitafederal/pt-br/assuntos/noticias', 'Receita Federal');
    const items = await collector.collect({
      since: '2026-11-01',
      isKnown: () => false,
      fetchText: async (url) => {
        if (url.endsWith('/noticias')) return html;
        throw new Error('HTTP 500');
      },
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].publishedTime, undefined);
  });
});

describe('Simples Nacional', () => {
  const html = `<div id="listaNoticias"><div class="row"><h4> <a href="NoticiaCompleta.aspx?id=bff8b291-7a89" class="azulClaro"> Publicado Roteiro da Opção </a> </h4>
    <p> <span> 21/08/2026 </span> - <span> Veja as modificações </span> </p></div></div>`;

  test('parses id, absolute URL, date and summary', () => {
    const [item] = simples.parseList(html);
    assert.equal(item.externalId, 'bff8b291-7a89');
    assert.equal(item.url, 'https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=bff8b291-7a89');
    assert.equal(item.publishedAt, '2026-08-21');
    assert.equal(item.excerpt, 'Veja as modificações');
  });
});

describe('CONFAZ', () => {
  const list = `<ul class="navTree"><li><a href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2026/CV001_26" title="Prorroga o Convênio ICMS nº 151" class="x"> <span>CONVÊNIO ICMS 01/26</span> </a></li></ul>`;
  const detail = `<h1>CONVÊNIO ICMS Nº 1, DE 15 DE JANEIRO DE 2026</h1><p>Publicado no DOU de 16.01.26, pelo despacho 02/26.</p>`;

  test('finds the date on real-sized pages with a long site header', () => {
    const page = `<div class="menu">${'Item de menu '.repeat(400)}</div><div id="parent-fieldname-text"><p>CONVÊNIO ICMS Nº 101, DE 4 DE SETEMBRO DE 2026</p><p>Publicado no DOU de 09.09.26, pelo despacho 40/26.</p></div>`;
    assert.equal(confaz.parseDetail(page).publishedAt, '2026-09-09');
  });

  test('parses the yearly list and the publication date of the detail page', () => {
    const [item] = confaz.parseYearList(list, '2026');
    assert.equal(item.externalId, 'CV001_26');
    assert.equal(item.excerpt, 'Prorroga o Convênio ICMS nº 151');
    assert.equal(confaz.parseDetail(detail).publishedAt, '2026-01-16');
  });

  test('stops at the newest convênio already stored instead of walking back through the year', async () => {
    const many = [5, 4, 3, 2, 1]
      .map((n) => `<li><a href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2026/CV00${n}_26" title="Ementa ${n}" class="x"> <span>CONVÊNIO ICMS 0${n}/26</span> </a></li>`)
      .join('');
    const requested = [];
    const items = await confaz.collect({
      fetchText: async (u) => (requested.push(u), u.endsWith('/2026') ? `<ul class="navTree">${many}</ul>` : detail),
      today: '2026-01-20',
      since: '2026-01-01',
      isKnown: (id) => id === 'CV003_26',
    });
    assert.deepEqual(items.map((i) => i.externalId), ['CV005_26', 'CV004_26']);
    assert.equal(requested.length, 3, 'list + 2 detail pages');
  });

  test('skips detail requests for convênios already stored', async () => {
    const requested = [];
    const items = await confaz.collect({
      fetchText: async (u) => (requested.push(u), u.endsWith('/2026') ? list : detail),
      today: '2026-11-06',
      since: '2026-01-01',
      isKnown: (id) => id === 'CV001_26',
    });
    assert.deepEqual(items, []);
    assert.equal(requested.length, 1);
  });
});

describe('SPED', () => {
  const html = `<section class="destaque"> <h2><a href="/item/show/8197">Publica&#231;&#227;o da Vers&#227;o 12.1.6 da ECF</a></h2> <p class="data">(25/05/2026)</p> <p> Versão válida para 2025 <a class="continue-lendo" href="/item/show/8197">Continue lendo</a>. </p> </section>`;

  test('parses highlight with HTTP URL', () => {
    const [item] = sped.parseHome(html);
    assert.equal(item.title, 'Publicação da Versão 12.1.6 da ECF');
    assert.equal(item.url, 'http://sped.rfb.gov.br/item/show/8197');
    assert.equal(item.publishedAt, '2026-05-25');
    assert.equal(item.excerpt, 'Versão válida para 2025');
  });
});

describe('eSocial', () => {
  const html = `<article class="tileItem visualIEFloatFix"><h2 class="tileHeadline"> <a class="summary url" href="https://www.gov.br/esocial/pt-br/noticias/nt-01">Nota Técnica 01/2026</a> </h2>
    <p class="tileBody"><span class="description">Novos leiautes</span></p> <span class="documentByLine"> publicado <span class="summary-view-icon"> 27/08/2026 </span></span></article>`;

  test('parses news and recognizes technical notes', () => {
    const [item] = esocial.parseList(html);
    assert.equal(item.publishedAt, '2026-08-27');
    assert.equal(item.actType, 'Nota Técnica');
    assert.equal(item.excerpt, 'Novos leiautes');
  });
});

describe('Legislação Federal (Senado API)', () => {
  test('parses documents and tolerates years without norms', () => {
    const json = { ListaDocumento: { documentos: { documento: [{ id: '44276013', tipo: 'LCP', descricao: 'Lei Complementar', numero: '238', normaNome: 'Lei Complementar nº 238 de 21/10/2026', ementa: 'Altera a LC 123 (Simples Nacional)', dataassinatura: '21/10/2026' }] } } };
    const [item] = legislacao.parseList(json);
    assert.equal(item.url, 'https://legis.senado.leg.br/norma/44276013');
    assert.equal(item.publishedAt, '2026-10-21');
    assert.deepEqual(legislacao.parseList({ ListaDocumento: { Metadados: {} } }), []);
    assert.throws(() => legislacao.parseList({ erro: 'x' }), /formato inesperado/);
  });
});

describe('Câmara API', () => {
  test('parses bills and stops paging on a short page', async () => {
    const json = { dados: [{ id: 2651228, siglaTipo: 'PLP', numero: 285, ano: 2026, ementa: 'Altera a LC 214 (CBS)', dataApresentacao: '2026-11-05T16:19' }] };
    let calls = 0;
    const items = await camara.collect({ fetchJson: async () => (calls++, json), today: '2026-11-06', since: '2026-11-05' });
    assert.equal(calls, 1);
    assert.equal(items[0].title, 'PLP 285/2026');
    assert.equal(items[0].actType, 'Projeto de Lei Complementar');
    assert.equal(items[0].publishedAt, '2026-11-05');
    assert.equal(items[0].publishedTime, '16:19');
  });
});
