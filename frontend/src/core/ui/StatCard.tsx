import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';

import { IconCircle } from '@/core/ui/primitives';
import { colors, fontSize, type IconTone, radius, shadows, type Tone, tones } from '@/theme';

const Box = styled.div<{ $clickable: boolean }>`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  width: 100%;
  /* mesma altura em toda a linha de indicadores */
  height: 100%;

  ${({ $clickable }) =>
    $clickable &&
    css`
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;

      &:hover {
        border-color: ${colors.borderStrong};
        box-shadow: ${shadows.md};
        transform: translateY(-1px);
      }

      &:focus-visible {
        outline: 2px solid ${colors.blue};
        outline-offset: 2px;
      }
    `}
`;


const Texts = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Label = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.textMuted};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Value = styled.span<{ $tone?: Tone; $small: boolean }>`
  font-size: ${({ $small }) => ($small ? 18 : fontSize.stat)}px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: ${({ $tone }) => ($tone ? tones[$tone].fg : colors.navy)};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const Hint = styled.span`
  min-height: 1.5em;
  font-size: 12px;
  color: ${colors.textSubtle};
  display: inline-flex;
  align-items: center;
  gap: 5px;
`;

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Icon in a soft colored circle on the left. */
  icon?: ReactNode;
  iconTone?: IconTone;
  /** Colors the value (e.g. "danger" for critical items). */
  tone?: Tone;
  /** Smaller value, for dates and texts. */
  small?: boolean;
  /** Extra content below the value. */
  children?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}

/** Indicator card: icon, label, big value and hint. Clickable when it opens a filtered list. */
export function StatCard({ label, value, hint, icon, iconTone = 'blue', tone, small = false, children, onClick, ariaLabel }: StatCardProps) {
  const content = (
    <>
      {icon && (
        <IconCircle $tone={iconTone} $size={48} aria-hidden>
          {icon}
        </IconCircle>
      )}
      <Texts>
        <Label>{label}</Label>
        <Value $tone={tone} $small={small}>
          {value}
        </Value>
        {children}
        {/* a linha de apoio sempre ocupa espaço: cards com e sem texto ficam do mesmo tamanho */}
        <Hint aria-hidden={!hint}>{hint}</Hint>
      </Texts>
    </>
  );
  if (onClick) {
    return (
      <Box as="button" type="button" $clickable onClick={onClick} aria-label={ariaLabel}>
        {content}
      </Box>
    );
  }
  return <Box $clickable={false}>{content}</Box>;
}
