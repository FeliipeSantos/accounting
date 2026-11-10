import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_THEME_MODE, readThemeMode, resolveTheme, saveThemeMode } from '@/core/theme/themeMode';

// o Node 24 expõe um localStorage experimental vazio que encobre o do jsdom: usa um em memória
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe('theme mode', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('starts dark and remembers the choice of this browser', () => {
    expect(readThemeMode()).toBe(DEFAULT_THEME_MODE);
    expect(DEFAULT_THEME_MODE).toBe('dark');
    saveThemeMode('light');
    expect(readThemeMode()).toBe('light');
  });

  it('ignores an unknown saved value', () => {
    localStorage.setItem('theme_mode', 'roxo');
    expect(readThemeMode()).toBe('dark');
  });

  it('keeps working when the storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readThemeMode()).toBe('dark');
    expect(() => saveThemeMode('light')).not.toThrow();
  });

  it('"Sistema" follows the device', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
