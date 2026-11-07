import { createGlobalStyle } from 'styled-components';

import { colors, FONT_FAMILY } from '@/theme';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: ${FONT_FAMILY};
    background-color: ${colors.bgApp};
    color: ${colors.textDark};
    line-height: 1.5;
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
