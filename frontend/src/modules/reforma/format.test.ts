import { describe, expect, it } from 'vitest';

import { formatDate, formatDuration, kindGroup, nextRunText, runOutcome } from '@/modules/reforma/format';

describe('reforma formatting', () => {
  it('summarizes a run', () => {
    expect(runOutcome({ newDocuments: 3, newVersions: 1, filesDownloaded: 2 })).toBe('3 documentos novos · 1 nova versão · 2 PDFs lidos');
    expect(runOutcome({ newDocuments: 1, newVersions: 0, filesDownloaded: 0 })).toBe('1 documento novo');
    expect(runOutcome({ newDocuments: 0, newVersions: 0, filesDownloaded: 0 })).toBe('sem novidades');
  });

  it('formats dates and durations', () => {
    expect(formatDate('2026-10-30')).toBe('30/10/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(27_200)).toBe('27,2 s');
  });

  it('describes the next automatic run', () => {
    const now = new Date(2026, 10, 7, 6, 0);
    expect(nextRunText(false, null, now)).toBe('sincronização automática desligada');
    expect(nextRunText(true, new Date(2026, 10, 7, 7, 0).toISOString(), now)).toBe('próxima automática: hoje às 07:00');
    expect(nextRunText(true, new Date(2026, 10, 7, 6, 0, 30).toISOString(), now)).toBe('próxima automática: em instantes');
  });

  it('groups the event kinds by calendar color', () => {
    expect(kindGroup('obrigatoriedade')).toBe('obrigatoriedade');
    expect(kindGroup('prazo')).toBe('prazo');
    expect(kindGroup('vigencia')).toBe('vigencia');
    expect(kindGroup('alteracao')).toBe('alteracao');
  });
});
