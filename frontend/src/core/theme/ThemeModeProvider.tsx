import { ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { readThemeMode, resolveTheme, saveThemeMode, THEME_ATTRIBUTE, ThemeModeContext, type ThemeMode } from '@/core/theme/themeMode';
import { antdLightTheme, antdTheme } from '@/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Applies the chosen appearance: the CSS variables of the screens follow the `data-theme`
 * attribute of <html> (see GlobalStyle) and Ant Design gets the matching theme.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readThemeMode);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  // "Sistema" acompanha a troca de tema do aparelho sem recarregar a página
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(mode, prefersDark);

  // antes de pintar a tela: evita um quadro com o esquema errado
  useLayoutEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    saveThemeMode(next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ConfigProvider theme={resolved === 'dark' ? antdTheme : antdLightTheme} locale={ptBR}>
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}
