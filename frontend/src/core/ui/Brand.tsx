import styled from 'styled-components';

import { BRAND_NAME } from '@/core/ui/constants';

/** The three rising bars of the opencontabil mark, light to deep blue (same drawing as src/assets/favicon.svg). */
const BARS = [
  { points: '3,27 3,19.5 9.5,16 9.5,27', color: '#63B9FF' },
  { points: '13.5,27 13.5,14 20,10.5 20,27', color: '#2E96FF' },
  { points: '24,27 24,8 30.5,4.5 30.5,27', color: '#1F6BEA' },
];

const Mark = styled.svg<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;
`;

/** Symbol of opencontabil: three rising bars. The stroke with round joins rounds their corners. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Mark $size={size} viewBox="0 0 34 30" aria-hidden focusable="false">
      {BARS.map(({ points, color }) => (
        <polygon key={points} points={points} fill={color} stroke={color} strokeWidth="2.6" strokeLinejoin="round" />
      ))}
    </Mark>
  );
}

const Logo = styled.span<{ $size: number; $fontSize?: number }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ $size }) => Math.round($size * 0.36)}px;
  color: inherit;
  font-size: ${({ $size, $fontSize }) => $fontSize ?? Math.round($size * 0.78)}px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
  white-space: nowrap;
`;

/** Full logo: the mark and the name in lower case. The name takes the text color of its parent. */
export function BrandLogo({ size = 28, fontSize, className }: { size?: number; /** Size of the name, when not the one that goes with the mark. */ fontSize?: number; className?: string }) {
  return (
    <Logo $size={size} $fontSize={fontSize} className={className}>
      <BrandMark size={size} />
      <span>{BRAND_NAME}</span>
    </Logo>
  );
}
