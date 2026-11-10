import { createGlobalStyle } from 'styled-components';

import { THEME_ATTRIBUTE } from '@/core/theme/themeMode';
import { colors, FONT_FAMILY, LIGHT_SURFACE_CLASS, SCHEME_CSS } from '@/theme';

export const GlobalStyle = createGlobalStyle`
  /* aparência escolhida no menu do perfil (as cores das telas são estas variáveis, veja src/theme.ts):
     escura por padrão, clara quando <html data-theme="light"> */
  :root {
    ${SCHEME_CSS.dark}
    color-scheme: dark;
  }

  :root[${THEME_ATTRIBUTE}='light'] {
    ${SCHEME_CSS.light}
    color-scheme: light;
  }

  /* papel (relatório A4 de projetos): volta ao esquema claro só dentro dele */
  .${LIGHT_SURFACE_CLASS} {
    ${SCHEME_CSS.light}
    color-scheme: light;
    color: ${colors.textDark};
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* reserva o espaço da barra de rolagem: o cabeçalho global não muda de largura entre rotas */
  html {
    scrollbar-gutter: stable;
  }

  body {
    margin: 0;
    font-family: ${FONT_FAMILY};
    background-color: ${colors.bgApp};
    color: ${colors.textDark};
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* barras de rolagem discretas no fundo escuro */
  * {
    scrollbar-color: ${colors.borderStrong} transparent;
  }

  /* números alinhados em colunas, tabelas e indicadores */
  .ant-table,
  .ant-statistic-content {
    font-variant-numeric: tabular-nums;
  }

  /* Impressão: só o relatório, em papel branco; menu e barras de controle ficam de fora */
  @media print {
    :root {
      ${SCHEME_CSS.light}
      color-scheme: light;
    }

    body {
      background-color: #fff !important;
    }

    [data-print-hide] {
      display: none !important;
    }

    @page {
      size: A4 landscape;
      margin: 0;
    }
  }
`;
