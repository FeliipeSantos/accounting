/**
 * Layout of the status report sheet (screen and print). Ant Design has no component
 * for this printable layout, so it is styled here, following the previous design.
 */
import styled, { css } from 'styled-components';

import { colors, shadows } from '@/theme';

/** Logical size of one printed page (landscape A4 at the base zoom). */
export const PRINT_PAGE_WIDTH = 1440;
export const PRINT_PAGE_HEIGHT = 1020;

const printExact = css`
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

export const Viewport = styled.section`
  padding: 24px;
  overflow-x: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;

  @media print {
    padding: 0;
    display: block;
    overflow: visible;
  }
`;

export const Paper = styled.div`
  background-color: ${colors.bgSubtle};
  width: 80%;
  min-width: 960px;
  min-height: 630px;
  box-shadow: ${shadows.lg};
  border-radius: 8px;
  border: 1px solid ${colors.border};
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  gap: 16px;

  @media print {
    width: ${PRINT_PAGE_WIDTH}px;
    min-height: ${PRINT_PAGE_HEIGHT}px;
    margin: 0 auto;
    box-shadow: none;
    border: none;
    background-color: #fff;
    break-after: avoid;
  }
`;

export const ReportHeaderBar = styled.div`
  background-color: ${colors.navy};
  color: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  ${printExact}

  @media print {
    padding: 12px 18px;
  }
`;

export const ProjectName = styled.h2`
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
  color: #fff;
`;

export const StatusReportLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 4px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
`;

export const ReportDate = styled.span`
  font-weight: 700;
  letter-spacing: 2px;
  color: #fff;
`;

export const DatesCard = styled.div`
  background: #fff;
  color: ${colors.textDark};
  border-radius: 8px;
  padding: 10px 20px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  box-shadow: ${shadows.sm};
  font-size: 0.8rem;
`;

export const DatesDivider = styled.div`
  width: 1px;
  height: 40px;
  background-color: ${colors.border};
`;

export const MetricLabel = styled.span`
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 1.5px;
`;

export const MetricValue = styled.span`
  display: block;
  font-weight: 700;
  font-size: 0.85rem;
`;

const cardBase = css`
  background: #fff;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  box-shadow: ${shadows.sm};
`;

export const InfoRow = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
`;

export const InfoCard = styled.div<{ $muted?: boolean }>`
  ${cardBase}
  padding: 12px 18px;
  min-height: 85px;
  display: flex;
  flex-direction: column;
  background: ${({ $muted }) => ($muted ? colors.bgSubtle : '#fff')};
`;

export const CardLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: ${colors.textMuted};
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${colors.blue};
  display: inline-block;
`;

export const CardText = styled.div`
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
`;

export const MiddleRow = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
  align-items: stretch;
`;

export const MiddleCard = styled.div`
  ${cardBase}
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

export const MiddleTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${colors.navy};
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`;

export const Subtitle = styled.span`
  font-size: 0.72rem;
  font-weight: 400;
  color: ${colors.textMuted};
  margin-left: 6px;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
  text-align: left;
  border: 1px solid ${colors.border};

  th {
    background-color: ${colors.blue};
    color: #fff;
    font-weight: 700;
    padding: 10px 12px;
    text-transform: uppercase;
    font-size: 0.65rem;
    letter-spacing: 0.5px;
    ${printExact}
  }

  td {
    padding: 9px 12px;
    border-bottom: 1px solid ${colors.border};
    font-weight: 500;
    vertical-align: middle;
  }
`;

export const ActivityRow = styled.tr<{ $selected: boolean; $dragging: boolean; $dropTarget: boolean }>`
  cursor: pointer;
  transition: background-color 0.15s ease;
  background-color: ${({ $selected }) => ($selected ? colors.blueSelected : 'transparent')};
  font-weight: ${({ $selected }) => ($selected ? 600 : 'inherit')};
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  box-shadow: ${({ $dropTarget }) => ($dropTarget ? `inset 0 2px 0 ${colors.blue}` : 'none')};

  &:nth-child(even) {
    background-color: ${({ $selected }) => ($selected ? colors.blueSelected : colors.bgSubtle)};
  }

  &:hover {
    background-color: ${({ $selected }) => ($selected ? colors.blueSelected : colors.bgMuted)};
  }
`;

export const SummaryRow = styled.tr`
  background-color: ${colors.navy};
  color: #fff;
  font-weight: 700;
  ${printExact}

  td {
    padding: 11px 12px;
    border-bottom: none;
  }
`;

export const IdCell = styled.td`
  width: 35px;
  text-align: center;
`;

export const StatusCell = styled.td`
  width: 155px;
  text-align: center;
`;

export const DragCell = styled.td`
  width: 26px;
  text-align: center;
  cursor: grab;
  color: ${colors.textMuted};
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

export const StatusBadge = styled.span<{ $tone: 'done' | 'delayed' | 'ongoing' | 'todo' }>`
  display: inline-block;
  width: 100%;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.68rem;
  text-align: center;
  white-space: nowrap;
  background-color: ${({ $tone }) => colors.status[$tone].bg};
  color: ${({ $tone }) => colors.status[$tone].text};
  ${printExact}
`;

export const AttentionRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const accent = { blue: colors.blue, green: colors.green, orange: colors.orange } as const;
export type Accent = keyof typeof accent;

export const AttentionCard = styled.div<{ $accent: Accent }>`
  ${cardBase}
  padding: 12px 18px;
  min-height: 85px;
  display: flex;
  flex-direction: column;
  border-left: 5px solid ${({ $accent }) => accent[$accent]};
`;

export const AttentionTitle = styled.div<{ $accent: Accent }>`
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  color: ${({ $accent }) => accent[$accent]};

  span + span {
    font-size: 0.65rem;
    font-weight: 400;
    color: ${colors.textMuted};
    text-transform: none;
    letter-spacing: normal;
  }
`;

export const BulletList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.72rem;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
`;

export const Bullet = styled.li<{ $plain?: boolean }>`
  position: relative;
  padding-left: ${({ $plain }) => ($plain ? 0 : '12px')};
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;

  &::before {
    content: ${({ $plain }) => ($plain ? 'none' : '"•"')};
    position: absolute;
    left: 0;
    font-weight: bold;
  }
`;

export const KanbanRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const kanbanText = { done: colors.green, doing: colors.orange, todo: colors.navy } as const;

export const KanbanColumnBox = styled.div`
  ${cardBase}
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 110px;
`;

export const KanbanHeader = styled.div<{ $column: 'done' | 'doing' | 'todo' }>`
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 1px;
  background-color: ${({ $column }) => colors.kanban[$column].bg};
  color: ${({ $column }) => kanbanText[$column]};
  border-bottom: 2px solid ${({ $column }) => colors.kanban[$column].border};
  ${printExact}
`;

export const CountBadge = styled.span<{ $color: string }>`
  background-color: ${({ $color }) => $color};
  color: #fff;
  border-radius: 12px;
  padding: 1px 10px;
  font-size: 0.75rem;
  font-weight: 700;
  ${printExact}
`;

export const KanbanBody = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const SubActivityItem = styled.li<{ $completed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  background: ${colors.bgSubtle};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: ${({ $completed }) => ($completed ? colors.textMuted : colors.textDark)};

  &:hover {
    background: ${colors.bgMuted};
    border-color: ${colors.borderStrong};
  }
`;

export const EmptyBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed ${colors.border};
  border-radius: 4px;
  color: ${colors.textMuted};
  font-size: 0.78rem;
  font-weight: 500;
  text-align: center;
  padding: 20px;
`;

export const ScrollList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
  max-height: 340px;

  @media print {
    max-height: none;
    overflow: visible;
  }
`;

/** Hidden on screen; only the printed report shows it. */
export const PrintOnly = styled.div`
  display: none;

  @media print {
    display: block;
  }
`;

/** Hidden on paper: edit controls (add/remove buttons, drag handles). */
export const ScreenOnly = styled.div`
  @media print {
    display: none;
  }
`;
