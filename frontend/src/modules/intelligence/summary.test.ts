import { describe, expect, it } from 'vitest';

import { affectedAudience, citedNorms, splitEmenta, splitHighlights, summarizePublication, validityText } from '@/modules/intelligence/summary';
import type { Publication } from '@/modules/intelligence/types';

const LC_238 = {
  title: 'Lei Complementar nº 238 de 21/10/2026',
  excerpt:
    'Altera a Lei Complementar nº 123, de 14 de dezembro de 2006 (Lei do Simples Nacional), para atualizar o limite de receita bruta anual e o número de empregados do Microempreendedor Individual (MEI), conceder remissão de créditos de titularidade da União de sua responsabilidade e dispor sobre a aplicação da medida.',
  subjects: ['simples-nacional'],
  normType: 'Norma publicada (vigência não identificada no trecho)',
  effectiveDate: null,
} as unknown as Publication;

describe('publication summary', () => {
  it('splits the ementa into main action and goals', () => {
    const { headline, goals } = splitEmenta(LC_238.excerpt);
    expect(headline).toBe('Altera a LC 123/2006 (Lei do Simples Nacional).');
    expect(goals).toEqual([
      'Atualizar o limite de receita bruta anual e o número de empregados do Microempreendedor Individual (MEI)',
      'Conceder remissão de créditos de titularidade da União de sua responsabilidade',
      'Dispor sobre a aplicação da medida',
    ]);
  });

  it('keeps an ementa without goals as the headline and drops boilerplate', () => {
    expect(splitEmenta('Dispõe sobre a Nota Fiscal de Serviço eletrônica, e dá outras providências.')).toEqual({
      headline: 'Dispõe sobre a Nota Fiscal de Serviço eletrônica.',
      goals: [],
    });
    expect(splitEmenta('')).toEqual({ headline: null, goals: [] });
  });

  it('drops the act header repeated by the DOU and keeps news without goals', () => {
    expect(
      splitEmenta(
        'PORTARIA Nº 293, DE 28 DE OUTUBRO DE 2026 Exclui pessoa jurídica do REFIS. A DELEGACIA DE ADMINISTRAÇÃO TRIBUTÁRIA decide...',
        'PORTARIA Nº 293, DE 28 DE OUTUBRO DE 2026',
      ).headline,
    ).toBe('Exclui pessoa jurídica do REFIS.');
    expect(
      splitEmenta('ATO DECLARATÓRIO EXECUTIVO SRRF09 Nº 36, DE 29 DE OUTUBRO DE 2026 Concede regime especial do IPI.', 'ATO DECLARATÓRIO EXECUTIVO SRRF09 Nº 36, DE').headline,
    ).toBe('Concede regime especial do IPI.');
    expect(splitEmenta('Prazo para realizar a opção termina nesta sexta-feira, 30 de outubro.')).toEqual({
      headline: 'Prazo para realizar a opção termina nesta sexta-feira, 30 de outubro.',
      goals: [],
    });
  });

  it('lists cited norms without the act itself', () => {
    expect(citedNorms({ title: 'Despachos', excerpt: 'Medida Provisória nº 1...' })).toEqual([]);
    expect(citedNorms({ title: 'Convênio', excerpt: 'alterações decorrentes da Lei Complementar nº 236, de 2026.' })).toEqual(['LC 236/2026']);
    expect(citedNorms(LC_238)).toEqual(['LC 123/2006']);
    expect(
      citedNorms({ title: 'Instrução Normativa RFB nº 2.300', excerpt: 'Altera a Instrução Normativa RFB nº 2.300 e a Lei nº 9.430/1996.' }),
    ).toEqual(['Lei 9.430/1996']);
  });

  it('finds who is affected', () => {
    expect(affectedAudience(LC_238)).toEqual(['Microempreendedores individuais (MEI)', 'Empresas do Simples Nacional']);
    expect(affectedAudience({ title: 'Portaria', excerpt: '', subjects: ['esocial'] })).toEqual(['Empregadores']);
  });

  it('describes validity in plain words', () => {
    expect(validityText({ normType: 'Norma vigente', effectiveDate: '2026-10-21' })).toBe('Em vigor desde 21/10/2026.');
    expect(validityText({ normType: 'Norma com vigência futura', effectiveDate: '2027-01-01' })).toBe('Entra em vigor em 01/01/2027.');
    expect(validityText({ normType: 'Projeto de lei', effectiveDate: null })).toMatch(/tramitação/);
    expect(validityText(LC_238)).toMatch(/Não identificada/);
  });

  it('splits text around highlighted values', () => {
    expect(splitHighlights('limite de R$ 140.000,00 em 2027', ['R$ 140.000,00'])).toEqual([
      { text: 'limite de ', strong: false },
      { text: 'R$ 140.000,00', strong: true },
      { text: ' em 2027', strong: false },
    ]);
    expect(splitHighlights('sem valores', [])).toEqual([{ text: 'sem valores', strong: false }]);
  });

  it('builds the facts list', () => {
    expect(summarizePublication(LC_238).facts.map((f) => f.label)).toEqual(['Vigência', 'Quem é afetado', 'Normas citadas']);
    // sem público nem normas identificados, só a vigência aparece
    expect(summarizePublication({ ...LC_238, excerpt: 'Aprova o regimento.', subjects: [] }).facts.map((f) => f.label)).toEqual(['Vigência']);
  });
});
