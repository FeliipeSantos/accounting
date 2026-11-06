// Unit tests for the rule-based classifier and text helpers.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { classify, matchSubjects, actWeight } = require('../intelligence/classifier');
const { SUBJECTS } = require('../intelligence/catalog');
const { parseBrDate, htmlToText, decodeEntities } = require('../intelligence/text');

const ALL = SUBJECTS.map((s) => s.id);

describe('text helpers', () => {
  test('parses Brazilian date formats', () => {
    assert.equal(parseBrDate('05/11/2026'), '2026-11-05');
    assert.equal(parseBrDate('Publicado no DOU de 16.01.26'), '2026-01-16');
    assert.equal(parseBrDate('DE 15 DE JANEIRO DE 2026'), '2026-01-15');
    assert.equal(parseBrDate('1º de março de 2027'), '2027-03-01');
    assert.equal(parseBrDate('31/02/2026'), null, 'invalid calendar date');
    assert.equal(parseBrDate(''), null);
  });

  test('converts HTML to plain text and drops scripts', () => {
    assert.equal(htmlToText('<p>Publica&#231;&#227;o <b>da</b> ECF</p><script>alert(1)</script>'), 'Publicação da ECF');
    assert.equal(decodeEntities('CONV&Ecirc;NIO &amp; Ajuste'), 'CONVÊNIO & Ajuste');
  });
});

describe('subject matching', () => {
  test('matches whole words, ignoring accents and case', () => {
    assert.deepEqual(matchSubjects('Altera a CONTRIBUIÇÃO sobre Bens e Serviços'), ['ibs-cbs']);
    assert.ok(matchSubjects('Regras do ISS para municípios').includes('iss'));
    assert.ok(!matchSubjects('Comissão de assistência').includes('iss'), '"iss" inside a word does not match');
    assert.ok(!matchSubjects('Ministério da Fazenda').includes('ipi'));
  });

  test('exclusion terms and narrowed keywords avoid known false positives', () => {
    // casos reais do DOU de 03-05/11/2026
    assert.deepEqual(matchSubjects('Declara habilitada ao Repetro, na modalidade Repetro-Sped, a pessoa jurídica'), []);
    assert.deepEqual(matchSubjects('Habilita ao regime Recof-Sped'), []);
    assert.deepEqual(matchSubjects('Portaria PREVIC sobre entidade fechada de previdência complementar'), []);
    assert.deepEqual(matchSubjects('Novo leiaute do SPED'), ['sped']);
    assert.ok(matchSubjects('Altera a contribuição previdenciária patronal').includes('previdenciaria'));
  });
});

describe('act weight', () => {
  test('weighs by act type and does not confuse "lei" with "leilão"', () => {
    assert.equal(actWeight('Lei Complementar'), 3);
    assert.equal(actWeight('Emenda Constitucional Numerada'), 3);
    assert.equal(actWeight('Instrução Normativa'), 2);
    assert.equal(actWeight('Portaria'), 1);
    assert.equal(actWeight('Leilão'), 0);
    assert.equal(actWeight('Notícia', 'Lei do Simples muda'), 0, 'news headline is not weighed as a law');
  });
});

describe('classify', () => {
  test('reform law is critical', () => {
    const c = classify({ sourceId: 'dou', title: 'LEI COMPLEMENTAR Nº 240', excerpt: 'Altera a regulamentação do IBS e da CBS', actType: 'Lei Complementar', publishedAt: '2026-11-05' }, ALL);
    assert.equal(c.relevant, true);
    assert.equal(c.relevance, 'critica');
    assert.ok(c.subjects.includes('ibs-cbs'));
  });

  test('records why: act weight, reform bonus, score and matched terms', () => {
    const c = classify({ sourceId: 'dou', title: 'MEDIDA PROVISÓRIA Nº 1.399', excerpt: 'Estabelece alíquotas do Imposto Seletivo', actType: 'Medida Provisória' }, ALL);
    assert.deepEqual(c.classificationReason, {
      actType: 'Medida Provisória',
      actLabel: 'Medida Provisória',
      weight: 3,
      reformBonus: 1,
      reformSubjects: ['imposto-seletivo'],
      score: 4,
      subjects: [{ id: 'imposto-seletivo', via: 'keywords', terms: ['imposto seletivo'] }],
    });
    assert.equal(c.relevance, 'critica');
  });

  test('records subjects that come from the source itself', () => {
    const c = classify({ sourceId: 'sped', title: 'Publicação da versão 12.1.6 do programa', actType: 'Destaque' }, ALL);
    assert.deepEqual(c.classificationReason.subjects, [{ id: 'sped', via: 'source', terms: [] }]);
    assert.equal(c.classificationReason.weight, 0);
    assert.equal(c.classificationReason.actLabel, null);
  });

  test('irrelevant act is discarded', () => {
    const c = classify({ sourceId: 'dou', title: 'PORTARIA Nº 1', excerpt: 'Prorroga a exploração da loteria instantânea', actType: 'Portaria' }, ALL);
    assert.equal(c.relevant, false);
  });

  test('source default subject applies even without keywords', () => {
    const c = classify({ sourceId: 'sped', title: 'Publicação da versão 12.1.6 do programa', actType: 'Destaque' }, ALL);
    assert.deepEqual(c.subjects, ['sped']);
    assert.equal(c.relevance, 'baixa');
    assert.equal(c.normType, 'Comunicado informativo');
  });

  test('disabled subjects are not assigned', () => {
    const c = classify({ sourceId: 'sped', title: 'Publicação da versão da ECD', actType: 'Destaque' }, ['icms']);
    assert.equal(c.relevant, false);
  });

  test('bills from Câmara are flagged as projeto de lei', () => {
    const c = classify({ sourceId: 'camara', title: 'PLP 285/2026', excerpt: 'Altera a LC 214 sobre créditos de CBS', actType: 'Projeto de Lei Complementar' }, ALL);
    assert.equal(c.normType, 'Projeto de lei');
    assert.equal(c.relevance, 'media');
  });

  test('effective date is only taken from explicit phrases', () => {
    const now = classify({ sourceId: 'dou', title: 'INSTRUÇÃO NORMATIVA RFB Nº 1', excerpt: 'Dispõe sobre a EFD. Esta Instrução Normativa entra em vigor na data de sua publicação.', actType: 'Instrução Normativa', publishedAt: '2026-11-05' }, ALL);
    assert.equal(now.normType, 'Norma vigente');
    assert.equal(now.effectiveDate, '2026-11-05');

    const future = classify({ sourceId: 'dou', title: 'INSTRUÇÃO NORMATIVA RFB Nº 2', excerpt: 'Altera a DCTFWeb. Produz efeitos a partir de 1º de janeiro de 2027.', actType: 'Instrução Normativa', publishedAt: '2026-11-05' }, ALL);
    assert.equal(future.normType, 'Norma com vigência futura');
    assert.equal(future.effectiveDate, '2027-01-01');

    const unknown = classify({ sourceId: 'dou', title: 'INSTRUÇÃO NORMATIVA RFB Nº 3', excerpt: 'Altera a ECF.', actType: 'Instrução Normativa', publishedAt: '2026-11-05' }, ALL);
    assert.match(unknown.normType, /não identificada/);
    assert.equal(unknown.effectiveDate, null);
  });
});
