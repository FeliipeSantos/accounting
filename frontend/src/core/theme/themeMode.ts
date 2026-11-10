import { createContext, useContext } from 'react';

/** Appearance chosen by the user: follow the device, or always light / dark. */
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'system', label: 'Sistema', hint: 'Segue o seu dispositivo' },
  { value: 'light', label: 'Claro', hint: 'Tema claro' },
  { value: 'dark', label: 'Escuro', hint: 'Tema escuro' },
];

/** Attribute of <html> that selects the color scheme (GlobalStyle reads it). */
export const THEME_ATTRIBUTE = 'data-theme';

const STORAGE_KEY = 'theme_mode';
/** The system was made dark; that stays the default until someone picks another option. */
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Saved choice of this browser, or the default (storage may be blocked). */
export function readThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(saved) ? saved : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // sem armazenamento: a escolha vale até fechar a página
  }
}

/** The scheme actually shown: "Sistema" follows the device preference. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

interface ThemeModeValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeModeContext = createContext<ThemeModeValue>({ mode: DEFAULT_THEME_MODE, resolved: 'dark', setMode: () => undefined });

export function useThemeMode(): ThemeModeValue {
  return useContext(ThemeModeContext);
}
