import { Flex } from 'antd';
import styled from 'styled-components';

import { EmptyState } from '@/core/ui';
import { deadlineChip, type UpcomingDeadline } from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';
import { colors, radius, type Tone, tones } from '@/theme';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const Item = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgCard};
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: ${colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }
`;

const DateTile = styled.span`
  width: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  background: ${colors.blueSelected};
  color: ${colors.navy};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  line-height: 1.15;

  b {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  small {
    font-size: 11.5px;
    color: ${colors.textMuted};
  }
`;

const Texts = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  b {
    font-weight: 600;
    color: ${colors.textDark};
    font-size: 13.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: ${colors.textMuted};
  }
`;

const Chip = styled.span<{ $tone: Tone }>`
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  background: ${({ $tone }) => tones[$tone].bg};
  color: ${({ $tone }) => tones[$tone].fg};
`;

/** "Próximos Prazos": end dates of the open projects, nearest first. */
export function UpcomingDeadlines({ items, onOpen }: { items: UpcomingDeadline[]; onOpen: (project: Project) => void }) {
  if (!items.length) {
    return <EmptyState title="Nenhum prazo em aberto">Os projetos em andamento com data de término aparecem aqui.</EmptyState>;
  }
  return (
    <Flex vertical gap={10}>
      {items.map(({ project, date, deadline }) => (
        <Item key={project.id} type="button" onClick={() => onOpen(project)} aria-label={`${project.name}: ${deadline.label}`}>
          <DateTile aria-hidden>
            <b>{date.format('DD')}</b>
            <small>{MONTHS[date.month()]}</small>
          </DateTile>
          <Texts>
            <b>{project.name}</b>
            <small>Término do projeto · {date.format('YYYY')}</small>
          </Texts>
          <Chip $tone={deadline.tone}>{deadlineChip(deadline)}</Chip>
        </Item>
      ))}
    </Flex>
  );
}
