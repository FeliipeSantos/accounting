import { AlertOutlined, CalendarOutlined, ClockCircleOutlined, FileSearchOutlined } from '@ant-design/icons';
import { Alert, Empty, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, SectionCard, StatCard, StatGrid } from '@/core/ui';
import { reformaApi } from '@/modules/reforma/api';
import { EventModal } from '@/modules/reforma/components/EventModal';
import { EventRow } from '@/modules/reforma/components/EventRow';
import { eventSubject, formatDate, isoDay, longDate, relativeDay } from '@/modules/reforma/format';
import type { CalendarEvent, Status } from '@/modules/reforma/types';
import { colors, fontSize } from '@/theme';

// "próximos prazos": duas semanas na lista; o indicador conta 30 dias
const LIST_DAYS = 14;
const AHEAD_DAYS = 30;
// "mudanças da semana": atos publicados nos últimos 7 dias, hoje incluído
const WEEK_DAYS = 7;

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: 16px;
  align-items: start;
`;

const Group = styled.section`
  padding: 8px 8px 4px;

  & + & {
    border-top: 1px solid ${colors.border};
  }
`;

const GroupTitle = styled.h3`
  margin: 4px 4px 2px;
  font-size: ${fontSize.label}px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${colors.textSubtle};

  span {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    color: ${colors.textMuted};
  }
`;

const ActTitle = styled.a`
  display: block;
  margin: 4px 4px 0;
  font-size: ${fontSize.support}px;
  font-weight: 500;
  color: ${colors.navy};
  overflow-wrap: anywhere;
`;

const Padded = styled.div`
  padding: 16px;
`;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + days));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Events grouped by a key, in the order they come. */
function groupBy(events: CalendarEvent[], key: (event: CalendarEvent) => string): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) groups.set(key(event), [...(groups.get(key(event)) ?? []), event]);
  return [...groups.entries()];
}

interface PanelViewProps {
  status: Status;
  refreshKey: number;
}

/** What needs attention now: the deadlines of the next days and the acts published this week. */
export function PanelView({ status, refreshKey }: PanelViewProps) {
  const [open, setOpen] = useState<CalendarEvent | null>(null);
  const today = isoDay(new Date());
  const ahead = useLoad(() => reformaApi.events(today, addDays(today, AHEAD_DAYS)), [today, refreshKey]);
  const changes = useLoad(() => reformaApi.events(addDays(today, -(WEEK_DAYS - 1)), today, {}, true), [today, refreshKey]);

  const week = useMemo(() => (ahead.data ?? []).filter((e) => e.date <= addDays(today, WEEK_DAYS - 1)), [ahead.data, today]);
  const nextDays = useMemo(
    () =>
      groupBy(
        (ahead.data ?? []).filter((e) => e.date <= addDays(today, LIST_DAYS - 1)),
        (e) => e.date,
      ),
    [ahead.data, today],
  );
  const acts = useMemo(() => {
    // só datas com a publicação informada: sem ela não dá para dizer que o ato é da semana
    const sorted = (changes.data ?? []).filter((e) => e.publishedAt).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.date.localeCompare(b.date));
    return groupBy(sorted, (e) => e.documentId);
  }, [changes.data]);

  return (
    <>
      <StatGrid $min={200}>
        <StatCard icon={<ClockCircleOutlined />} iconTone="orange" label="Nos próximos 7 dias" value={ahead.data ? week.length : '—'} hint="prazos e obrigações" />
        <StatCard icon={<CalendarOutlined />} iconTone="green" label={`Nos próximos ${AHEAD_DAYS} dias`} value={ahead.data ? ahead.data.length : '—'} hint="datas no calendário" />
        <StatCard
          icon={<FileSearchOutlined />}
          iconTone="purple"
          label="Atos publicados na semana"
          value={changes.data ? acts.length : '—'}
          hint={changes.data ? `${acts.reduce((sum, [, events]) => sum + events.length, 0)} data(s) nova(s)` : undefined}
        />
        <StatCard
          icon={<AlertOutlined />}
          iconTone={status.recurringReviews.length ? 'red' : 'gray'}
          label="Prazos para revisar"
          value={status.recurringReviews.length}
          tone={status.recurringReviews.length ? 'danger' : undefined}
          hint={status.recurringReviews.length ? 'regra recorrente pode ter mudado' : 'nenhuma regra afetada'}
        />
      </StatGrid>

      {status.recurringReviews.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Prazos recorrentes para revisar"
          description={status.recurringReviews.map((review) => `${review.title}: ${review.acts.map((act) => act.title).join('; ')}`).join(' · ')}
        />
      )}

      <Columns>
        <SectionCard title={`Próximos prazos (${LIST_DAYS} dias)`} flush>
          {ahead.error ? (
            <ErrorState message={ahead.error} onRetry={ahead.reload} />
          ) : !ahead.data ? (
            <Padded>
              <Skeleton active />
            </Padded>
          ) : nextDays.length === 0 ? (
            <Padded>
              <Empty description="Nenhuma data nos próximos dias" />
            </Padded>
          ) : (
            nextDays.map(([day, events]) => (
              <Group key={day} aria-label={longDate(day)}>
                <GroupTitle>
                  {capitalize(longDate(day))} <span>· {relativeDay(day, today)}</span>
                </GroupTitle>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} onOpen={setOpen} />
                ))}
              </Group>
            ))
          )}
        </SectionCard>

        <SectionCard title="Mudanças da semana" flush>
          {changes.error ? (
            <ErrorState message={changes.error} onRetry={changes.reload} />
          ) : !changes.data ? (
            <Padded>
              <Skeleton active />
            </Padded>
          ) : acts.length === 0 ? (
            <Padded>
              <Empty description="Nenhum ato com data publicado nos últimos 7 dias" />
            </Padded>
          ) : (
            acts.map(([documentId, events]) => (
              <Group key={documentId}>
                <GroupTitle>
                  Publicado em {formatDate(events[0].publishedAt)} <span>· {relativeDay(events[0].publishedAt ?? today, today)}</span>
                </GroupTitle>
                <ActTitle href={events[0].document.url} target="_blank" rel="noopener noreferrer">
                  {events[0].document.title} ↗
                </ActTitle>
                {events.map((event) => (
                  // o título do ato já está acima: a linha mostra o trecho, salvo quando é uma linha de tabela ("NFS-e")
                  <EventRow key={event.id} event={event} showDate showQuote={eventSubject(event.title) === event.document.title} onOpen={setOpen} />
                ))}
              </Group>
            ))
          )}
        </SectionCard>
      </Columns>

      <EventModal event={open} status={status} onClose={() => setOpen(null)} />
    </>
  );
}
