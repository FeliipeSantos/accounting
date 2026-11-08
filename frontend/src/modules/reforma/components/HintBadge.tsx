import { Tooltip } from 'antd';
import styled from 'styled-components';

import { StatusBadge } from '@/core/ui';
import type { Tone } from '@/theme';

// o wrapper existe só para o Tooltip; inline-flex mantém o selo na mesma linha dos outros
const Hover = styled.span`
  display: inline-flex;
  cursor: help;
`;

const TipTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
`;

const TipLine = styled.div`
  & + & {
    margin-top: 6px;
  }

  strong {
    font-weight: 600;
  }
`;

interface HintBadgeProps {
  tone: Tone;
  label: string;
  /** Heading of the tooltip (defaults to the label). */
  heading?: string;
  /** What the badge means in general. */
  what: string;
  /** Why this item got it. */
  why?: string;
}

/** Badge that explains, on hover or focus, what it means and why this item has it. */
export function HintBadge({ tone, label, heading, what, why }: HintBadgeProps) {
  return (
    <Tooltip
      title={
        <>
          <TipTitle>{heading ?? label}</TipTitle>
          <TipLine>
            <strong>O que é:</strong> {what}
          </TipLine>
          {why && (
            <TipLine>
              <strong>Por que este item:</strong> {why}
            </TipLine>
          )}
        </>
      }
    >
      <Hover tabIndex={0} aria-label={[heading ?? label, what, why].filter(Boolean).join('. ')}>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </Hover>
    </Tooltip>
  );
}
