import { WarningFilled } from '@ant-design/icons';
import { Tooltip } from 'antd';
import styled from 'styled-components';

import { DATE_STATUS, eventSubject, IMPORTANCE, KIND_GROUPS, kindGroup } from '@/modules/reforma/format';
import type { CalendarEvent } from '@/modules/reforma/types';
import { colors, fontSize, iconTones, radius } from '@/theme';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const Row = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: ${radius.field}px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;

  &:hover {
    background: ${colors.bgSubtle};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: -2px;
  }
`;

const DateBox = styled.span<{ $tone: keyof typeof iconTones }>`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: ${radius.field}px;
  background: ${({ $tone }) => iconTones[$tone].bg};
  color: ${({ $tone }) => iconTones[$tone].fg};
  line-height: 1.05;

  strong {
    font-size: 17px;
    font-weight: 700;
  }

  small {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
`;

const Dot = styled.i<{ $tone: keyof typeof iconTones }>`
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $tone }) => iconTones[$tone].fg};
`;

const Texts = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const Name = styled.span`
  font-size: ${fontSize.support}px;
  font-weight: 600;
  color: ${colors.navy};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Alert = styled(WarningFilled)`
  color: ${iconTones.orange.fg};
`;

interface EventRowProps {
  event: CalendarEvent;
  /** Shows the day in a colored box (lists of several days); otherwise a colored dot. */
  showDate?: boolean;
  /** Shows the official excerpt instead of the subject (rows under the act's own title). */
  showQuote?: boolean;
  onOpen: (event: CalendarEvent) => void;
}

/** One date in a compact list: kind color, what it is about and the kind of date; opens the full card. */
export function EventRow({ event, showDate = false, showQuote = false, onOpen }: EventRowProps) {
  const group = KIND_GROUPS[kindGroup(event.kind)];
  const [year, month, day] = event.date.split('-');
  // o ano só quando não é o corrente: "fev 27"
  const otherYear = Number(year) !== new Date().getFullYear() ? ` ${year.slice(2)}` : '';
  return (
    <Row type="button" onClick={() => onOpen(event)} aria-label={`${group.label}: ${eventSubject(event.title)}`}>
      {showDate ? (
        <DateBox $tone={group.tone} aria-hidden>
          <strong>{day}</strong>
          <small>
            {MONTHS[Number(month) - 1]}
            {otherYear}
          </small>
        </DateBox>
      ) : (
        <Dot $tone={group.tone} aria-hidden />
      )}
      <Texts>
        <Name>{showQuote ? event.quote : eventSubject(event.title)}</Name>
        <Meta>
          {group.label} · {IMPORTANCE[event.importance].label} · {DATE_STATUS[event.dateStatus]?.label ?? event.dateStatus}
        </Meta>
      </Texts>
      {event.review && (
        <Tooltip title="Pode ter mudado: um ato novo fala em alterar este prazo">
          <Alert aria-label="Pode ter mudado" />
        </Tooltip>
      )}
    </Row>
  );
}
