import { Empty, Radio, Select, Skeleton, Timeline } from 'antd';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, SectionCard } from '@/core/ui';
import { reformaApi } from '@/modules/reforma/api';
import { EventModal } from '@/modules/reforma/components/EventModal';
import { EventRow } from '@/modules/reforma/components/EventRow';
import { isoDay, KIND_GROUPS, kindGroup, type KindGroup } from '@/modules/reforma/format';
import type { CalendarEvent, Status } from '@/modules/reforma/types';
import { colors, fontSize, iconTones } from '@/theme';

// períodos da linha do tempo, em meses a partir de hoje (negativo: para trás)
const PERIODS = [
  { value: -3, label: 'Últimos 3 meses' },
  { value: 3, label: 'Próximos 3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
] as const;
const GROUP_ORDER: KindGroup[] = ['obrigatoriedade', 'prazo', 'vigencia', 'alteracao'];

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const Wide = styled(Select)`
  width: 260px;
  max-width: 100%;
` as typeof Select;

const Narrow = styled(Select)`
  width: 190px;
` as typeof Select;

const Month = styled.h3`
  margin: 0 0 4px;
  font-size: ${fontSize.body}px;
  font-weight: 600;
  color: ${colors.navy};

  span {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 500;
    color: ${colors.textMuted};
  }
`;

const MonthDot = styled.span`
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid ${colors.blue};
  background: ${colors.bgCard};
`;

const Counts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 4px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

const Count = styled.span<{ $tone: keyof typeof iconTones }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $tone }) => iconTones[$tone].fg};
  }
`;

const Padded = styled.div`
  padding: 8px 0;
`;

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1 + months, d));
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface TimelineViewProps {
  status: Status;
  refreshKey: number;
}

/** Every date of the period in order, month by month: what is coming (or what happened). */
export function TimelineView({ status, refreshKey }: TimelineViewProps) {
  const [months, setMonths] = useState<number>(6);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [kind, setKind] = useState<KindGroup | ''>('');
  const [open, setOpen] = useState<CalendarEvent | null>(null);
  const today = isoDay(new Date());
  const [from, to] = months < 0 ? [addMonths(today, months), today] : [today, addMonths(today, months)];
  const state = useLoad(() => reformaApi.events(from, to, { subjects, kind: kind || undefined }), [from, to, refreshKey, subjects.join(','), kind]);

  const byMonth = useMemo(() => {
    const events = months < 0 ? [...(state.data ?? [])].reverse() : (state.data ?? []);
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of events) groups.set(event.date.slice(0, 7), [...(groups.get(event.date.slice(0, 7)) ?? []), event]);
    return [...groups.entries()];
  }, [state.data, months]);

  return (
    <SectionCard title="Linha do tempo">
      <Controls>
        <Radio.Group optionType="button" buttonStyle="solid" value={months} onChange={(e) => setMonths(e.target.value as number)} options={[...PERIODS]} />
        <Wide
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder="Todos os assuntos"
          aria-label="Assunto"
          value={subjects}
          onChange={(value) => setSubjects(value as string[])}
          options={status.subjects.map(({ id, name }) => ({ value: id, label: name }))}
          optionFilterProp="label"
        />
        <Narrow
          aria-label="Tipo"
          value={kind}
          onChange={(value) => setKind(value as KindGroup | '')}
          options={[{ value: '', label: 'Todos os tipos' }, ...GROUP_ORDER.map((g) => ({ value: g, label: KIND_GROUPS[g].plural }))]}
        />
      </Controls>

      {state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : !state.data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : byMonth.length === 0 ? (
        <Empty description="Nenhuma data no período" />
      ) : (
        <Timeline
          items={byMonth.map(([month, events]) => {
            const counts = GROUP_ORDER.map((g) => [g, events.filter((e) => kindGroup(e.kind) === g).length] as const).filter(([, n]) => n > 0);
            return {
              key: month,
              dot: <MonthDot aria-hidden />,
              children: (
                <Padded>
                  <Month>
                    {monthLabel(month)}
                    <span>{events.length} data(s)</span>
                  </Month>
                  <Counts>
                    {counts.map(([g, n]) => (
                      <Count key={g} $tone={KIND_GROUPS[g].tone}>
                        {n} {n === 1 ? KIND_GROUPS[g].label.toLowerCase() : KIND_GROUPS[g].plural.toLowerCase()}
                      </Count>
                    ))}
                  </Counts>
                  {events.map((event) => (
                    <EventRow key={event.id} event={event} showDate onOpen={setOpen} />
                  ))}
                </Padded>
              ),
            };
          })}
        />
      )}

      <EventModal event={open} status={status} onClose={() => setOpen(null)} />
    </SectionCard>
  );
}
