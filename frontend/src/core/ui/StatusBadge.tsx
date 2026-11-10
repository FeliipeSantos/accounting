import type { ReactNode } from 'react';
import styled from 'styled-components';

import { radius, type Tone, tones } from '@/theme';

const Badge = styled.span<{ $tone: Tone; $dot: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: ${radius.badge}px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  background: ${({ $tone }) => tones[$tone].bg};
  color: ${({ $tone }) => tones[$tone].fg};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;

  &::before {
    content: '';
    display: ${({ $dot }) => ($dot ? 'block' : 'none')};
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`;

interface StatusBadgeProps {
  tone: Tone;
  children: ReactNode;
  /** Small dot before the text (default true). */
  dot?: boolean;
  title?: string;
}

/** Badge of the semantic scale: relevance, status and deadline use this same component. */
export function StatusBadge({ tone, children, dot = true, title }: StatusBadgeProps) {
  return (
    <Badge $tone={tone} $dot={dot} title={title}>
      {children}
    </Badge>
  );
}
