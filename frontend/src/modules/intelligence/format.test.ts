import { describe, expect, it } from 'vitest';

import {
  actIconKind,
  formatDate,
  formatPublished,
  groupSameAct,
  resultCountText,
  lastCollectionText,
  nextRunText,
  RELEVANCE,
  RELEVANCE_ICON_TONE,
  relevanceSteps,
  runOutcomeText,
  safeOfficialUrl,
  sameActKey,
  updatedAtText,
} from '@/modules/intelligence/format';
import type { Publication, Run } from '@/modules/intelligence/types';

function pub(id: string, sourceId: string, title: string, publishedAt: string | null): Publication {
  return { id, sourceId, title, publishedAt } as Publication;
}

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

  it('maps relevance to the shared tones (Baixa is neutral)', () => {
    expect(RELEVANCE.critica.tone).toBe('danger');
    expect(RELEVANCE.alta.tone).toBe('warning');
    expect(RELEVANCE.media.tone).toBe('info');
    expect(RELEVANCE.baixa.tone).toBe('neutral');
  });

  it('describes the last collection for the header', () => {
    const run = { status: 'success', startedAt: '2026-11-07T08:00:00', finishedAt: '2026-11-07T08:03:00', newCount: 0 } as Run;
    const when = new Date('2026-11-07T08:03:00').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    expect(lastCollectionText(run)).toBe(`Última coleta ${when} · sem novidades`);
    expect(lastCollectionText({ ...run, newCount: 3 })).toBe(`Última coleta ${when} · 3 nova(s)`);
    expect(lastCollectionText({ ...run, status: 'partial', newCount: 2 })).toBe(`Última coleta ${when} · 2 nova(s) · com falhas`);
    expect(lastCollectionText({ ...run, status: 'failed' })).toBe(`Última coleta ${when} · falhou`);
    expect(lastCollectionText(null)).toBe('Nenhuma coleta realizada ainda');
    expect(lastCollectionText(run, true)).toBe('Coleta em andamento...');
  });
});

describe('list item and header presentation', () => {
  it('picks the icon from the act type, falling back to the title', () => {
    expect(actIconKind({ actType: 'Lei Complementar', title: '' })).toBe('law');
    expect(actIconKind({ actType: 'Medida Provisória', title: '' })).toBe('law');
    expect(actIconKind({ actType: 'Decreto', title: '' })).toBe('law');
    expect(actIconKind({ actType: 'Portaria Conjunta', title: '' })).toBe('notice');
    expect(actIconKind({ actType: 'Comunicado', title: '' })).toBe('notice');
    expect(actIconKind({ actType: '', title: 'AVISO DE CONSULTA PÚBLICA' })).toBe('notice');
    expect(actIconKind({ actType: 'Decisão', title: 'Diário Oficial da União - Decisão' })).toBe('document');
    expect(actIconKind({ actType: '', title: '' })).toBe('document');
    // "Leilão" não é lei
    expect(actIconKind({ actType: 'Leilão', title: '' })).toBe('document');
  });

  it('colors the icon by relevance', () => {
    expect(RELEVANCE_ICON_TONE).toEqual({ critica: 'red', alta: 'orange', media: 'blue', baixa: 'gray' });
  });

  it('describes the header update time and the run outcome', () => {
    const run = { status: 'success', startedAt: '2026-11-07T08:00:00', finishedAt: '2026-11-07T08:03:00', newCount: 0 } as Run;
    expect(updatedAtText(run)).toBe('Atualizado em: 07/11/2026 às 08:03');
    expect(updatedAtText(null)).toBe('Nenhuma coleta realizada ainda');
    expect(updatedAtText(run, true)).toBe('Coleta em andamento...');
    expect(runOutcomeText(run)).toBe('Concluída · sem novidades');
    expect(runOutcomeText({ ...run, status: 'partial', newCount: 2 })).toBe('Concluída com falhas · 2 nova(s)');
    expect(runOutcomeText({ ...run, status: 'failed' })).toBe('Falhou');
  });
});

describe('grouping the same act from different sources', () => {
  const dou = pub('1', 'dou', 'MEDIDA PROVISÓRIA Nº 1.399, DE 4 DE NOVEMBRO DE 2026', '2026-11-04');
  const leg = pub('2', 'legislacao', 'Medida Provisória nº 1.399 de 04/11/2026', '2026-11-04');

  it('builds the same key for both titles of the act', () => {
    expect(sameActKey(dou)).toBe('medida provisoria|1399|2026-11-04');
    expect(sameActKey(leg)).toBe(sameActKey(dou));
    expect(sameActKey(pub('3', 'legislacao', 'Lei Complementar nº 238 de 21/10/2026', '2026-10-21'))).toBe('lei complementar|238|2026-10-21');
  });

  it('ignores acts numbered per organ and titles without a number or date', () => {
    expect(sameActKey(pub('4', 'dou', 'Portaria Conjunta MPS/INSS nº 54, de 5 de novembro de 2026', '2026-11-05'))).toBeNull();
    expect(sameActKey(pub('5', 'camara', 'PL 5785/2026', '2026-11-06'))).toBeNull();
    expect(sameActKey(pub('6', 'dou', 'Medida Provisória nº 1.399', null))).toBeNull();
  });

  it('groups the same act and keeps the order of the list', () => {
    const other = pub('7', 'camara', 'PL 5785/2026', '2026-11-06');
    const groups = groupSameAct([dou, other, leg]);
    expect(groups).toHaveLength(2);
    expect(groups[0].primary).toBe(dou);
    expect(groups[0].others).toEqual([leg]);
    expect(groups[1]).toEqual({ primary: other, others: [] });
  });

  it('never groups distinct acts or the same source twice', () => {
    const otherNumber = pub('8', 'legislacao', 'Medida Provisória nº 1.400 de 04/11/2026', '2026-11-04');
    const otherDate = pub('9', 'legislacao', 'Medida Provisória nº 1.399 de 05/11/2026', '2026-11-05');
    const otherKind = pub('10', 'legislacao', 'Decreto nº 1.399 de 04/11/2026', '2026-11-04');
    const sameSource = pub('11', 'dou', 'Medida Provisória nº 1.399, de 4 de novembro de 2026', '2026-11-04');
    const groups = groupSameAct([dou, otherNumber, otherDate, otherKind, sameSource]);
    expect(groups.map((g) => g.others.length)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('resultCountText', () => {
  it('explains when the same act from two sources is shown as one item', () => {
    expect(resultCountText(2, 2, 1)).toBe('2 publicações encontradas, exibidas em 1 item: 1 é a mesma norma publicada em outra fonte');
  });

  it('keeps the plain count when nothing was joined', () => {
    expect(resultCountText(1, 1, 1)).toBe('1 publicação encontrada');
    expect(resultCountText(45, 45, 45)).toBe('45 publicações encontradas');
    expect(resultCountText(120, 50, 50)).toBe('Mostrando 50 de 120 publicações');
  });
});
