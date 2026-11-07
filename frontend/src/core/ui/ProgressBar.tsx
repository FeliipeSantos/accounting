import { Flex } from 'antd';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { colors, type Tone, tones } from '@/theme';

const Track = styled.div<{ $height: number }>`
  position: relative;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $height }) => $height / 2}px;
  background: ${colors.bgMuted};
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

const Fill = styled.div<{ $value: number; $color: string }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${({ $value }) => Math.max(0, Math.min(100, $value))}%;
  background: ${({ $color }) => $color};
  border-radius: inherit;
`;

interface ProgressBarProps {
  /** 0 to 100. */
  value: number;
  tone?: Tone;
  height?: number;
  label?: string;
}

/** Thin progress bar of the system. */
export function ProgressBar({ value, tone = 'info', height = 6, label }: ProgressBarProps) {
  return (
    <Track $height={height} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <Fill $value={value} $color={tones[tone].solid} />
    </Track>
  );
}

const Stack = styled.div<{ $height: number }>`
  display: flex;
  gap: 2px;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $height }) => $height / 2}px;
  overflow: hidden;
  background: ${colors.bgMuted};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

const Segment = styled.span<{ $grow: number; $color: string }>`
  flex: ${({ $grow }) => $grow} 0 0;
  background: ${({ $color }) => $color};
`;

const LegendItem = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: ${colors.textMuted};
  font-variant-numeric: tabular-nums;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: ${({ $color }) => $color};
  }
`;

export interface BarSegment {
  value: number;
  tone: Tone;
  label: ReactNode;
}

/** Stacked bar (e.g. activities by status, publications by relevance) with an optional legend. */
export function SegmentBar({ segments, height = 6, legend = true }: { segments: BarSegment[]; height?: number; legend?: boolean }) {
  const visible = segments.filter((s) => s.value > 0);
  return (
    <Flex vertical gap={6}>
      <Stack $height={height}>
        {visible.map((s, i) => (
          <Segment key={i} $grow={s.value} $color={tones[s.tone].solid} />
        ))}
      </Stack>
      {legend && (
        <Flex gap={12} wrap>
          {visible.map((s, i) => (
            <LegendItem key={i} $color={tones[s.tone].solid}>
              {s.label}
            </LegendItem>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
