/** Layout primitives of the design system (styled containers without behavior). */
import styled from 'styled-components';

import { CONTENT_MAX_WIDTH, type IconTone, iconTones, radius, tones } from '@/theme';

/** Main area of a page: same width limit and gutters on every module. */
export const PageContainer = styled.div`
  max-width: ${CONTENT_MAX_WIDTH}px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 768px) {
    padding: 20px 16px 32px;
  }

  @media print {
    max-width: none;
    padding: 0;
  }
`;

/** Row of indicators: equal columns that wrap on narrow screens. */
export const StatGrid = styled.div<{ $min?: number }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${({ $min = 160 }) => `min(${$min}px, 100%)`}, 1fr));
  gap: 12px;
`;

/** Neutral rounded chip (subjects, sources). */
export const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: ${radius.pill}px;
  background: ${tones.neutral.bg};
  color: ${tones.neutral.fg};
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
`;

/** Icon in a soft colored circle (indicators, list items). */
export const IconCircle = styled.span<{ $tone: IconTone; $size?: number }>`
  width: ${({ $size = 40 }) => $size}px;
  height: ${({ $size = 40 }) => $size}px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: ${({ $size = 40 }) => Math.round($size * 0.44)}px;
  flex-shrink: 0;
  background: ${({ $tone }) => iconTones[$tone].bg};
  color: ${({ $tone }) => iconTones[$tone].fg};
`;
