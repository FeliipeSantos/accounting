import { FileTextOutlined } from '@ant-design/icons';
import styled from 'styled-components';

import { colors, fontSize, type IconTone, iconTones, palette, radius } from '@/theme';

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Row = styled.button`
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 22px minmax(80px, 150px) minmax(0, 1fr) 32px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 6px;
  border-radius: ${radius.field}px;
  font-size: ${fontSize.support}px;
  color: ${colors.textDark};
  cursor: pointer;

  &:hover {
    background: ${colors.bgSubtle};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: -2px;
  }
`;

// ícone pequeno do assunto: azul para a Reforma Tributária, laranja para os demais
const SubjectIcon = styled.span<{ $tone: IconTone }>`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  background: ${({ $tone }) => iconTones[$tone].bg};
  color: ${({ $tone }) => iconTones[$tone].fg};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

const Label = styled.span`
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
`;

const Track = styled.span`
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: ${colors.bgMuted};
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

const Fill = styled.span<{ $percent: number }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${({ $percent }) => $percent}%;
  border-radius: inherit;
  background: ${palette.blue600};
`;

const Value = styled.span`
  text-align: right;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`;

const Empty = styled.p`
  margin: 0;
  padding: 8px 0;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

export interface BarListItem {
  id: string;
  label: string;
  count: number;
  highlight?: boolean;
}

interface BarListProps {
  items: BarListItem[];
  emptyText: string;
  /** Title of each row button (e.g. "Ver publicações de ICMS"). */
  itemTitle: (item: BarListItem) => string;
  onSelect: (item: BarListItem) => void;
}

/** List of counts with an icon and a proportional bar (subjects of the dashboard). */
export function BarList({ items, emptyText, itemTitle, onSelect }: BarListProps) {
  if (!items.length) return <Empty>{emptyText}</Empty>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <List>
      {items.map((item) => (
        <li key={item.id}>
          <Row type="button" onClick={() => onSelect(item)} title={itemTitle(item)}>
            <SubjectIcon $tone={item.highlight ? 'blue' : 'orange'} aria-hidden>
              <FileTextOutlined />
            </SubjectIcon>
            <Label>{item.label}</Label>
            <Track aria-hidden>
              <Fill $percent={(item.count / max) * 100} />
            </Track>
            <Value>{item.count}</Value>
          </Row>
        </li>
      ))}
    </List>
  );
}
