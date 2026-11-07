import { createGlobalStyle } from 'styled-components';

import { colors, FONT_FAMILY } from '@/theme';

export const GlobalStyle = createGlobalStyle`
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

  /* números alinhados em colunas, tabelas e indicadores */
  .ant-table,
  .ant-statistic-content {
    font-variant-numeric: tabular-nums;
  }

  /* Impressão: só o relatório; menu e barras de controle ficam de fora */
  @media print {
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
