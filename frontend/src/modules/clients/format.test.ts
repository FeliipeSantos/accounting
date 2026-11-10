import { describe, expect, it } from 'vitest';

import { documentKind, formatDocument, formatMoney, formatPlace, matchesClient, normalizeDocument } from '@/modules/clients/format';
import type { Client } from '@/modules/clients/types';

describe('documentKind', () => {
  it.each([
    ['529.982.247-25', 'pf'],
    ['529.982.247-24', null],
    ['111.111.111-11', null],
    ['11.222.333/0001-81', 'pj'],
    ['11.222.333/0001-80', null],
    ['12.ABC.345/01DE-35', 'pj'],
    ['12abc34501de35', 'pj'],
    ['12.ABC.345/01DE-36', null],
    ['', null],
  ])('%s -> %s', (document, kind) => {
    expect(documentKind(document)).toBe(kind);
  });
});

describe('formatDocument', () => {
  it('masks a CPF and a CNPJ while typing', () => {
    expect(formatDocument('5299')).toBe('529.9');
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
    expect(formatDocument('112223330001')).toBe('11.222.333/0001');
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatDocument('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(formatDocument('11.222.333/0001-81999')).toBe('11.222.333/0001-81');
  });

  it('normalizes the stored value', () => {
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
});

describe('list helpers', () => {
  const client = { name: 'Padaria Pão Quente', tradeName: 'Pão Quente', contactName: 'Maria', city: 'Santos', state: 'SP', document: '11222333000181' } as Client;

  it('searches names and the CPF/CNPJ with or without punctuation', () => {
    expect(matchesClient(client, 'quente')).toBe(true);
    expect(matchesClient(client, 'maria')).toBe(true);
    expect(matchesClient(client, '11.222')).toBe(true);
    expect(matchesClient(client, '11222333')).toBe(true);
    expect(matchesClient(client, 'outro')).toBe(false);
    expect(matchesClient(client, '  ')).toBe(true);
  });

  it('formats place and money', () => {
    expect(formatPlace(client)).toBe('Santos/SP');
    expect(formatPlace({ city: null, state: 'RJ' })).toBe('RJ');
    expect(formatPlace({ city: null, state: null })).toBe('—');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(1250.5).replace(/\s/g, ' ')).toBe('R$ 1.250,50');
  });
});
