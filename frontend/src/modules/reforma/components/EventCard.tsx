import { Alert, Button, Flex, Tag } from 'antd';
import styled from 'styled-components';

import { HintBadge } from '@/modules/reforma/components/HintBadge';
import { DATE_STATUS, eventSubject, formatDate, IMPORTANCE } from '@/modules/reforma/format';
import type { CalendarEvent } from '@/modules/reforma/types';
import { colors, fontSize, radius, tones } from '@/theme';

const Card = styled.article<{ $tone: keyof typeof tones }>`
  padding: 12px 14px;
  border: 1px solid ${colors.border};
  border-left: 4px solid ${({ $tone }) => tones[$tone].solid};
  border-radius: ${radius.card}px;
  background: ${colors.bgCard};
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Kind = styled.span`
  font-size: ${fontSize.label}px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${colors.textSubtle};
`;

const Title = styled.h4`
  margin: 0;
  font-size: ${fontSize.support}px;
  font-weight: 600;
  line-height: 1.4;
  color: ${colors.navy};
  overflow-wrap: anywhere;
`;

// o trecho literal do documento oficial que sustenta a data
const Quote = styled.blockquote`
  margin: 0;
  padding: 8px 10px;
  border-left: 3px solid ${colors.borderStrong};
  background: ${colors.bgSubtle};
  font-size: 13px;
  line-height: 1.5;
  color: ${colors.textDark};
  overflow-wrap: anywhere;
`;

// os dois selos ficam na mesma linha e altura
const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`;

// a ementa do ato: o que a legislação ou a alteração faz
const Changes = styled.p`
  margin: 0;
  font-size: ${fontSize.support}px;
  line-height: 1.5;
  color: ${colors.textDark};
  overflow-wrap: anywhere;
  /* ementas longas: três linhas; o texto inteiro fica no documento */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;

  strong {
    font-weight: 600;
  }
`;

const Meta = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${colors.textMuted};
`;

interface EventCardProps {
  event: CalendarEvent;
  kindName: (kind: string) => string;
  /** Name of a subject id (Reforma Tributária, ICMS...). */
  subjectName?: (id: string) => string;
  sourceName: (id: string) => string;
  /** Shows the date (lists of several days). */
  showDate?: boolean;
  onOpenDocument: (documentId: string) => void;
}

/** One change of the calendar: what happens, the official excerpt and where it comes from. */
export function EventCard({ event, kindName, subjectName = (id) => id, sourceName, showDate = false, onOpenDocument }: EventCardProps) {
  const importance = IMPORTANCE[event.importance];
  const dateStatus = DATE_STATUS[event.dateStatus];
  const subject = eventSubject(event.title);
  return (
    <Card $tone={importance.tone}>
      <Flex justify="space-between" align="center" gap={8} wrap>
        <Kind>
          {showDate ? `${formatDate(event.date)} · ` : ''}
          {kindName(event.kind)}
        </Kind>
        <Badges>
          <HintBadge tone={importance.tone} label={importance.label} heading={`Importância: ${importance.label}`} what={importance.hint} why={event.importanceReason} />
          <HintBadge tone={dateStatus.tone} label={dateStatus.label} what={dateStatus.hint} why={event.dateReason} />
        </Badges>
      </Flex>
      <Title>{subject}</Title>
      {event.subjects.length > 0 && (
        <Flex gap={4} wrap>
          {event.subjects.map((id) => (
            <Tag key={id} bordered={false}>
              {subjectName(id)}
            </Tag>
          ))}
        </Flex>
      )}
      {subject !== event.document.title && <Meta>Em: {event.document.title}</Meta>}
      {event.document.summary && (
        <Changes>
          <strong>{event.origin === 'recorrente' ? 'Base legal:' : 'O que muda:'}</strong> {event.document.summary}
        </Changes>
      )}
      {event.review && (
        <Alert
          type="warning"
          showIcon
          message="Pode ter mudado"
          description={
            <>
              Depois de {formatDate(event.review.since)}, quando a regra foi conferida, saiu um ato que pode alterar este prazo. Confira antes de usar a data:{' '}
              {event.review.acts.map((act, index) => (
                <span key={act.documentId}>
                  {index > 0 && ' · '}
                  <a href={act.url} target="_blank" rel="noopener noreferrer">
                    {act.title} ({formatDate(act.date)}) ↗
                  </a>
                </span>
              ))}
            </>
          }
        />
      )}
      <Quote>{event.quote}</Quote>
      <Meta>
        {event.legalStatus} · {sourceName(event.document.sourceId)}
        {event.dateNote ? ` · ${event.dateNote}` : ''} · {event.origin === 'recorrente' ? 'calculado pela regra da legislação' : 'extraído por regra do texto oficial'}
      </Meta>
      {event.alsoIn.length > 0 && (
        <Meta>
          Também publicado em:{' '}
          {event.alsoIn.map((other, index) => (
            <span key={other.eventId}>
              {index > 0 && ' · '}
              <a href={other.url} target="_blank" rel="noopener noreferrer">
                {sourceName(other.sourceId)} ↗
              </a>
            </span>
          ))}
        </Meta>
      )}
      <Flex gap={8} wrap>
        {/* prazos recorrentes não vêm de um documento guardado: só a fonte oficial da regra */}
        {event.documentId && (
          <Button size="small" onClick={() => onOpenDocument(event.documentId)}>
            Ver documento e versões
          </Button>
        )}
        <Button size="small" type="link" href={event.document.url} target="_blank" rel="noopener noreferrer">
          Fonte oficial ↗
        </Button>
      </Flex>
    </Card>
  );
}
