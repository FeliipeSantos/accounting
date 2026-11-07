import styled from 'styled-components';

import { palette } from '@/theme';

const Mark = styled.svg`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
`;

/** Logo of the system: a "C" drawn in two strokes over the institutional blue. */
export function BrandMark() {
  return (
    <Mark viewBox="0 0 32 32" aria-hidden focusable="false">
      <path d="M24.5 9.2A11 11 0 1 0 24.5 22.8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M21 12.6A6.2 6.2 0 1 0 21 19.4" fill="none" stroke={palette.blue600} strokeWidth="3.4" strokeLinecap="round" />
    </Mark>
  );
}
