// Geist (variável, pesos 100 a 900), a mesma fonte do OpenMonetis; vai junto no build, sem Google Fonts
import '@fontsource-variable/geist';
import 'dayjs/locale/pt-br';

import { App as AntApp } from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { GlobalStyle } from '@/core/layout/GlobalStyle';
import { ThemeModeProvider } from '@/core/theme/ThemeModeProvider';

dayjs.locale('pt-br');
dayjs.extend(customParseFormat);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* aparência (Sistema / Claro / Escuro) e o tema do antd que combina com ela */}
    <ThemeModeProvider>
      <AntApp>
        <GlobalStyle />
        <AuthProvider>
          <App />
        </AuthProvider>
      </AntApp>
    </ThemeModeProvider>
  </StrictMode>,
);
