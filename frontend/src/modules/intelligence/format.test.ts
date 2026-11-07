import { describe, expect, it } from 'vitest';

import { formatDate, formatPublished, nextRunText, relevanceSteps, safeOfficialUrl } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';

describe('formatting', () => {
  it('dates and publication time', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatPublished({ publishedAt: '2026-11-05', publishedTime: '14:20' })).toBe('05/11/2026 às 14:20');
    expect(formatPublished({ publishedAt: '2026-11-05', publishedTime: null })).toBe('05/11/2026');
    expect(formatPublished({ publishedAt: null, publishedTime: null })).toBeNull();
  });

  it('only official links are clickable', () => {
    expect(safeOfficialUrl('https://www.in.gov.br/web/dou/-/x')).toBe('https://www.in.gov.br/web/dou/-/x');
    expect(safeOfficialUrl('http://sped.rfb.gov.br/item/show/1')).toBe('http://sped.rfb.gov.br/item/show/1');
    expect(safeOfficialUrl('https://legis.senado.leg.br/norma/1')).not.toBeNull();
    expect(safeOfficialUrl('https://evilgov.br/x')).toBeNull();
    expect(safeOfficialUrl('javascript:alert(1)')).toBeNull();
    expect(safeOfficialUrl('https://example.com')).toBeNull();
  });

  it('explains the relevance from the stored reason', () => {
    const pub = {
      relevance: 'critica',
      classificationReason: { actType: 'Lei', actLabel: 'Lei', weight: 3, reformBonus: 1, reformSubjects: ['ibs-cbs'], score: 4, subjects: [] },
    } as unknown as Publication;
    expect(relevanceSteps(pub, (id) => (id === 'ibs-cbs' ? 'IBS e CBS' : id))).toEqual([
      'Tipo de ato: Lei → peso 3',
      'Trata da Reforma Tributária (IBS e CBS) → +1',
      'Pontuação 4 → Crítica',
    ]);
    expect(relevanceSteps({ relevance: 'baixa' } as Publication, String)).toBeNull();
  });

  it('describes the next automatic run', () => {
    const now = new Date('2026-11-06T10:00:00');
    expect(nextRunText({ schedulerEnabled: false, nextRunAt: null }, now)).toBe('agendamento automático desativado');
    expect(nextRunText({ schedulerEnabled: true, nextRunAt: new Date('2026-11-06T10:00:30').toISOString() }, now)).toBe('próxima automática: em instantes');
    expect(nextRunText({ schedulerEnabled: true, nextRunAt: new Date('2026-11-06T18:30:00').toISOString() }, now)).toBe('próxima automática: hoje às 18:30');
    expect(nextRunText({ schedulerEnabled: true, nextRunAt: new Date('2026-11-07T06:00:00').toISOString() }, now)).toBe('próxima automática: 07/11 às 06:00');
  });
});
