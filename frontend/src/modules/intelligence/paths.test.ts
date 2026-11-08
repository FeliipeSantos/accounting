import { describe, expect, it } from 'vitest';

import { legacyTabPath, publicationsPath, tabPath } from '@/modules/intelligence/paths';

describe('publications addresses', () => {
  it('lives inside the Inteligência Contábil group', () => {
    expect(tabPath('painel')).toBe('/inteligencia-contabil/publicacoes/painel');
    expect(publicationsPath({ relevance: 'critica' })).toBe('/inteligencia-contabil/publicacoes/lista?relevance=critica');
  });

  it('turns old addresses into the new ones, keeping the filters', () => {
    expect(legacyTabPath('publicacoes', '?q=mei')).toBe('/inteligencia-contabil/publicacoes/lista?q=mei');
    expect(legacyTabPath('historico', '')).toBe('/inteligencia-contabil/publicacoes/historico');
    expect(legacyTabPath('inexistente', '')).toBe('/inteligencia-contabil/publicacoes');
  });
});
