import { describe, expect, it } from 'vitest';

import { documentsPath, isOpenDocumentState } from '@/modules/reforma/search';

describe('reforma global search', () => {
  it('lists every match in the Documentos tab', () => {
    expect(documentsPath('split payment')).toBe('/inteligencia-contabil/calendario?aba=documentos&q=split+payment');
  });

  it('recognizes the state that opens a document', () => {
    expect(isOpenDocumentState({ openDocument: 'doc-1' })).toBe(true);
    expect(isOpenDocumentState({ openDocument: 1 })).toBe(false);
    expect(isOpenDocumentState(null)).toBe(false);
  });
});
