import { describe, expect, it } from 'vitest';

import { initials } from '@/core/ui/avatar';

describe('avatar initials', () => {
  it('uses the first and last words of a name', () => {
    expect(initials('Felipe Santos')).toBe('FS');
    expect(initials('  Ana  Maria Souza ')).toBe('AS');
  });

  it('splits login names and falls back to the first two letters', () => {
    expect(initials('felipe.santos')).toBe('fs');
    expect(initials('admin')).toBe('ad');
  });
});
