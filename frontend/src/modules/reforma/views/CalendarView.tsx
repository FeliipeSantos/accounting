import { CalendarOutlined, FilterOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Badge, Button, Calendar, Checkbox, DatePicker, Empty, Flex, Modal, Popover, Radio, Select, Skeleton, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import styled, { css } from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, SectionCard } from '@/core/ui';
import { reformaApi } from '@/modules/reforma/api';
import { DocumentModal } from '@/modules/reforma/components/DocumentModal';
import { EventCard } from '@/modules/reforma/components/EventCard';
import { eventSubject, IMPORTANCE, isoDay, KIND_GROUPS, kindGroup, type KindGroup, longDate, monthGridRange, relativeDay } from '@/modules/reforma/format';
import type { CalendarEvent, EventFilters, Importance, Status } from '@/modules/reforma/types';
import { colors, fontSize, iconTones, radius, shadows, tones } from '@/theme';

// dias com eventos aparecem nos próximos 6 meses da lista "O que vem por aí"
const UPCOMING_DAYS = 180;
const MAX_IN_CELL = 3;
// a Reforma vai de 2026 a 2033; um ano antes para o histórico
const FIRST_YEAR = 2025;
const LAST_YEAR = 2033;
const GROUP_ORDER: KindGroup[] = ['obrigatoriedade', 'prazo', 'vigencia', 'alteracao'];

const Board = styled.section`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card + 4}px;
  box-shadow: ${shadows.sm};
  padding: 16px 16px 12px;
  min-width: 0;
`;

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const TitleIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: ${radius.card}px;
  background: ${colors.blue};
  color: #fff;
  font-size: 20px;
  box-shadow: 0 6px 14px -6px ${colors.blue};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: ${colors.navy};
  line-height: 1.25;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

const Divider = styled.span`
  align-self: stretch;
  width: 1px;
  background: ${colors.border};

  @media (max-width: 900px) {
    display: none;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.button<{ $tone: keyof typeof iconTones; $active: boolean }>`
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 8px;
  align-items: center;
  min-width: 86px;
  padding: 6px 12px 6px 10px;
  border-radius: ${radius.card}px;
  border: 1px solid ${({ $active, $tone }) => ($active ? iconTones[$tone].fg : 'transparent')};
  background: ${({ $tone }) => iconTones[$tone].bg};
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition:
    border-color 0.15s,
    transform 0.15s;

  &:hover {
    border-color: ${({ $tone }) => iconTones[$tone].fg};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  &::before {
    content: '';
    grid-row: 1 / span 2;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${({ $tone }) => iconTones[$tone].fg};
  }

  strong {
    font-size: 16px;
    line-height: 1.2;
    color: ${colors.textDark};
  }

  span {
    font-size: 12px;
    color: ${({ $tone }) => ($tone === 'gray' ? colors.textMuted : iconTones[$tone].fg)};
  }
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`;

const IconButton = styled(Button)`
  width: 40px;
  height: 40px;
`;

const Grid = styled.div<{ $loading: boolean }>`
  opacity: ${({ $loading }) => ($loading ? 0.55 : 1)};
  transition: opacity 0.2s;

  .ant-picker-calendar,
  .ant-picker-panel {
    background: transparent;
    border: 0 !important;
  }

  .ant-picker-body {
    padding: 0 !important;
  }

  table {
    border: 1px solid ${colors.border};
    border-radius: ${radius.card}px;
    border-collapse: separate !important;
    border-spacing: 0;
    overflow: hidden;
    table-layout: fixed;
  }

  thead th {
    padding: 10px 0 !important;
    background: ${colors.bgSubtle};
    border-bottom: 1px solid ${colors.border};
    font-size: ${fontSize.body}px;
    font-weight: 600;
    color: ${colors.textDark};
    text-align: center;
    text-transform: capitalize;
  }

  td.ant-picker-cell {
    padding: 0 !important;
    border-right: 1px solid ${colors.border};
    border-top: 1px solid ${colors.border};
    vertical-align: top;
  }

  td.ant-picker-cell:last-child {
    border-right: 0;
  }

  tbody tr:first-child td.ant-picker-cell {
    border-top: 0;
  }

  /* o antd sempre desenha 6 semanas; a semana toda do mês seguinte (ou anterior) não aparece */
  .ant-picker-date-panel tbody tr:not(:has(.ant-picker-cell-in-view)) {
    display: none;
  }

  td.ant-picker-cell::before {
    display: none;
  }
`;

const Cell = styled.div<{ $selected: boolean; $today: boolean; $outside: boolean; $tall: boolean }>`
  position: relative;
  height: ${({ $tall }) => ($tall ? 124 : 96)}px;
  padding: 8px 10px;
  overflow: hidden;
  text-align: left;
  background: ${({ $today }) => ($today ? colors.bgMuted : 'transparent')};
  transition: background 0.15s;
  cursor: pointer;

  &:hover {
    background: ${colors.bgSubtle};
  }

  ${({ $selected }) =>
    $selected &&
    css`
      background: ${colors.blueSelected} !important;
      box-shadow: inset 0 0 0 1.5px ${colors.blue};
      border-radius: ${radius.field}px;
    `}

  ${({ $outside }) =>
    $outside &&
    css`
      & > * {
        opacity: 0.55;
      }
    `}
`;

const DayNumber = styled.div<{ $selected: boolean }>`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 26px;
    padding: 0 6px;
    border-radius: ${radius.field}px;
    font-size: 15px;
    font-weight: 600;
    color: ${({ $selected }) => ($selected ? '#fff' : colors.textDark)};
    background: ${({ $selected }) => ($selected ? colors.blue : 'transparent')};
  }
`;

const CellList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const Dot = styled.i<{ $tone: keyof typeof iconTones }>`
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $tone }) => iconTones[$tone].fg};
`;

const CellItem = styled.li<{ $critical: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: ${colors.textDark};
  font-weight: ${({ $critical }) => ($critical ? 600 : 400)};

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const More = styled.li`
  margin-top: 2px;

  span {
    display: inline-block;
    padding: 1px 8px;
    border-radius: ${radius.badge}px;
    border: 1px solid ${tones.info.border};
    background: ${colors.blueSelected};
    font-size: 11px;
    font-weight: 600;
    color: ${colors.blue};
  }
`;

const MonthCell = styled(Cell)`
  height: 92px;
`;

const MonthName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${colors.textDark};
  text-transform: capitalize;
  margin-bottom: 8px;
`;

const MonthCounts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  color: ${colors.textMuted};

  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 22px;
  padding: 12px 4px 0;
  font-size: ${fontSize.support}px;
  color: ${colors.textDark};

  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
`;

const PopoverBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 280px;
`;

const PopoverLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

const DayTitle = styled.h3`
  margin: 0;
  font-size: ${fontSize.section}px;
  font-weight: 600;
  color: ${colors.navy};

  &::first-letter {
    text-transform: uppercase;
  }
`;

const Muted = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${colors.textMuted};
`;

// a lista do dia rola dentro do modal, sem empurrar o título para fora da tela
const DayBody = styled.div`
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
`;

const FullSelect = styled(Select)`
  width: 100%;
` as typeof Select;

const SubjectSelect = styled(Select)`
  width: 230px;
` as typeof Select;

// mesmo seletor de Recebimentos: setas para o período anterior/seguinte e o mês (ou ano) no meio
const PeriodPicker = styled(DatePicker)`
  width: 170px;
`;

/** Whether a month (or year) is outside the years the calendar covers. */
const outsideRange = (date: Dayjs) => date.year() < FIRST_YEAR || date.year() > LAST_YEAR;

function shortKind(kind: string): string {
  return (
    {
      vigencia: 'Vigência',
      alteracao: 'Alteração',
      prazo: 'Prazo',
      obrigatoriedade: 'Obrigatoriedade',
    }[kind] ?? kind
  );
}

function cellLabel(event: CalendarEvent): string {
  // "Produção · NT 2026.008" — o nome curto do documento cabe na célula
  const doc = eventSubject(event.title)
    .replace(/^Nota Técnica\s*/i, 'NT ')
    .replace(/^RESOLUÇÃO CGIBS\s*/i, 'Res. CGIBS ');
  return `${shortKind(event.kind)} · ${doc}`;
}

function countByGroup(events: CalendarEvent[]): Record<KindGroup, number> {
  const counts: Record<KindGroup, number> = { obrigatoriedade: 0, prazo: 0, vigencia: 0, alteracao: 0 };
  events.forEach((event) => (counts[kindGroup(event.kind)] += 1));
  return counts;
}

interface CalendarViewProps {
  status: Status;
  refreshKey: number;
  onOpenDocument: (documentId: string) => void;
}

/** Month (and year) calendar of the changes, the selected day and what comes next. */
export function CalendarView({ status, refreshKey, onOpenDocument }: CalendarViewProps) {
  const today = isoDay(new Date());
  const [selected, setSelected] = useState<Dayjs>(() => dayjs());
  const [dayOpen, setDayOpen] = useState(false);
  const [group, setGroup] = useState<KindGroup | null>(null);
  const [panel, setPanel] = useState<{ date: Dayjs; mode: 'month' | 'year' }>(() => ({ date: dayjs(), mode: 'month' }));
  const [filters, setFilters] = useState<EventFilters>({
    kind: '',
    importance: [],
    hidePublications: true,
    officialOnly: false,
    subjects: [],
  });

  const range = useMemo(() => {
    if (panel.mode === 'year')
      return {
        from: `${panel.date.year()}-01-01`,
        to: `${panel.date.year()}-12-31`,
      };
    return monthGridRange(panel.date.year(), panel.date.month());
  }, [panel]);

  const events = useLoad(() => reformaApi.events(range.from, range.to, filters), [range.from, range.to, filters, refreshKey]);
  const upcomingTo = isoDay(new Date(Date.now() + UPCOMING_DAYS * 86_400_000));
  const upcoming = useLoad(
    () =>
      reformaApi.events(today, upcomingTo, {
        ...filters,
        hidePublications: true,
      }),
    [filters, refreshKey, today],
  );

  // os números do topo contam só o mês (ou o ano) exibido, sem os dias vizinhos da grade
  const inPeriod = useMemo(() => {
    const prefix = panel.mode === 'year' ? panel.date.format('YYYY') : panel.date.format('YYYY-MM');
    return (events.data ?? []).filter((event) => event.date.startsWith(prefix));
  }, [events.data, panel]);
  const counts = useMemo(() => countByGroup(inPeriod), [inPeriod]);

  const shown = useMemo(() => (events.data ?? []).filter((event) => !group || kindGroup(event.kind) === group), [events.data, group]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    shown.forEach((event) => map.set(event.date, [...(map.get(event.date) ?? []), event]));
    return map;
  }, [shown]);

  const byMonth = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    shown.forEach((event) => map.set(event.date.slice(0, 7), [...(map.get(event.date.slice(0, 7)) ?? []), event]));
    return map;
  }, [shown]);

  // semanas com muitos itens ganham células mais altas
  const tall = useMemo(() => [...byDay.values()].some((list) => list.length >= MAX_IN_CELL), [byDay]);

  const kindName = (kind: string) => status.eventKinds[kind] ?? kind;
  const sourceName = (id: string) => status.sources.find((s) => s.id === id)?.name ?? id;
  const subjectName = (id: string) => status.subjects.find((s) => s.id === id)?.name ?? id;
  const selectedIso = selected.format('YYYY-MM-DD');
  const dayEvents = byDay.get(selectedIso) ?? [];
  const activeFilters = (filters.kind ? 1 : 0) + filters.importance.length + (filters.officialOnly ? 1 : 0);

  // o documento abre no lugar do dia (dois modais empilhados confundem) e, ao fechar, o dia volta
  const [dayDocument, setDayDocument] = useState<string | null>(null);

  function change(update: Partial<EventFilters>) {
    setFilters((current) => ({ ...current, ...update }));
  }

  if (events.error) return <ErrorState message={events.error} onRetry={events.reload} />;

  const filterContent = (
    <PopoverBody>
      <PopoverLabel>Tipo de data</PopoverLabel>
      <FullSelect
        value={filters.kind}
        onChange={(kind) => change({ kind })}
        aria-label="Tipo de evento"
        options={[{ value: '', label: 'Todos os tipos de data' }, ...Object.entries(status.eventKinds).map(([value, label]) => ({ value, label }))]}
      />
      <PopoverLabel>Importância</PopoverLabel>
      <FullSelect
        mode="multiple"
        allowClear
        placeholder="Todas as importâncias"
        value={filters.importance}
        onChange={(importance) => change({ importance: importance as Importance[] })}
        aria-label="Importância"
        options={Object.entries(IMPORTANCE).map(([value, { label }]) => ({ value, label }))}
      />
      <Checkbox checked={filters.officialOnly} onChange={(e) => change({ officialOnly: e.target.checked })}>
        Só datas certas (sem as que o ato chama de previstas)
      </Checkbox>
      <Button size="small" type="link" disabled={!activeFilters} onClick={() => change({ kind: '', importance: [], officialOnly: false })}>
        Limpar filtros
      </Button>
    </PopoverBody>
  );

  return (
    <Flex vertical gap={16}>
      <Board>
        <Grid $loading={events.loading}>
          <Calendar
            value={selected}
            onSelect={(date, info) => {
              setSelected(date);
              if (info.source === 'month') setPanel({ date, mode: 'month' });
              if (info.source === 'date') setDayOpen(true);
            }}
            onPanelChange={(date, mode) => setPanel({ date, mode })}
            headerRender={({ value, type, onChange, onTypeChange }) => (
              <Header>
                <Flex align="center" gap={12}>
                  <TitleIcon>
                    <CalendarOutlined />
                  </TitleIcon>
                  <div>
                    <Title>Calendário de Obrigações</Title>
                    <Subtitle>Obrigatoriedades, prazos, vigências e alterações</Subtitle>
                  </div>
                </Flex>
                <Divider />
                <Chips>
                  <Chip type="button" $tone="blue" $active={group === null} onClick={() => setGroup(null)} aria-pressed={group === null}>
                    <strong>{inPeriod.length}</strong>
                    <span>Total de itens</span>
                  </Chip>
                  {GROUP_ORDER.map((id) => (
                    <Chip
                      key={id}
                      type="button"
                      $tone={KIND_GROUPS[id].tone}
                      $active={group === id}
                      aria-pressed={group === id}
                      title={group === id ? 'Mostrar todos' : `Mostrar só ${KIND_GROUPS[id].plural.toLowerCase()}`}
                      onClick={() => setGroup((current) => (current === id ? null : id))}
                    >
                      <strong>{counts[id]}</strong>
                      <span>{KIND_GROUPS[id].plural}</span>
                    </Chip>
                  ))}
                </Chips>
                <Controls>
                  <SubjectSelect
                    size="large"
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    placeholder="Todos os assuntos"
                    aria-label="Assunto"
                    value={filters.subjects}
                    onChange={(subjects) => change({ subjects: subjects as string[] })}
                    options={status.subjects.map(({ id, name }) => ({ value: id, label: name }))}
                    optionFilterProp="label"
                  />
                  <Flex gap={6} align="center">
                    <Button
                      size="large"
                      icon={<LeftOutlined />}
                      disabled={outsideRange(value.subtract(1, type))}
                      onClick={() => onChange(value.subtract(1, type))}
                      aria-label={type === 'month' ? 'Mês anterior' : 'Ano anterior'}
                    />
                    <PeriodPicker
                      size="large"
                      picker={type}
                      format={type === 'month' ? 'MMMM/YYYY' : 'YYYY'}
                      allowClear={false}
                      value={value}
                      disabledDate={outsideRange}
                      onChange={(date) => date && onChange(date as Dayjs)}
                      aria-label={type === 'month' ? 'Mês' : 'Ano'}
                    />
                    <Button
                      size="large"
                      icon={<RightOutlined />}
                      disabled={outsideRange(value.add(1, type))}
                      onClick={() => onChange(value.add(1, type))}
                      aria-label={type === 'month' ? 'Próximo mês' : 'Próximo ano'}
                    />
                  </Flex>
                  <Radio.Group
                    size="large"
                    optionType="button"
                    buttonStyle="solid"
                    value={type}
                    onChange={(e) => onTypeChange(e.target.value)}
                    options={[
                      { value: 'month', label: 'Mês' },
                      { value: 'year', label: 'Ano' },
                    ]}
                  />
                  <Popover trigger="click" placement="bottomRight" title="Filtros" content={filterContent}>
                    <Badge count={activeFilters} size="small">
                      <Tooltip title="Filtros">
                        <IconButton icon={<FilterOutlined />} aria-label="Filtros" />
                      </Tooltip>
                    </Badge>
                  </Popover>
                </Controls>
              </Header>
            )}
            fullCellRender={(current, info) => {
              if (info.type === 'month') {
                const list = byMonth.get(current.format('YYYY-MM')) ?? [];
                const monthCounts = countByGroup(list);
                return (
                  <MonthCell $selected={false} $today={current.isSame(dayjs(), 'month')} $outside={false} $tall={false}>
                    <MonthName>{current.format('MMMM')}</MonthName>
                    {list.length ? (
                      <MonthCounts>
                        {GROUP_ORDER.filter((id) => monthCounts[id]).map((id) => (
                          <span key={id}>
                            <Dot $tone={KIND_GROUPS[id].tone} />
                            {monthCounts[id]} {KIND_GROUPS[id].label.toLowerCase()}
                          </span>
                        ))}
                      </MonthCounts>
                    ) : (
                      <Muted>Sem itens</Muted>
                    )}
                  </MonthCell>
                );
              }
              if (info.type !== 'date') return info.originNode;
              const iso = current.format('YYYY-MM-DD');
              const list = byDay.get(iso) ?? [];
              const isSelected = iso === selectedIso;
              const extra = list.length - MAX_IN_CELL;
              return (
                <Cell $selected={isSelected} $today={iso === today} $outside={!current.isSame(panel.date, 'month')} $tall={tall}>
                  <DayNumber $selected={isSelected}>
                    <span>{current.format('DD')}</span>
                  </DayNumber>
                  {list.length > 0 && (
                    <CellList>
                      {list.slice(0, MAX_IN_CELL).map((event) => (
                        <CellItem key={event.id} $critical={event.importance === 'critico'} title={event.title}>
                          <Dot $tone={KIND_GROUPS[kindGroup(event.kind)].tone} />
                          <span>{cellLabel(event)}</span>
                        </CellItem>
                      ))}
                      {extra > 0 && (
                        <More>
                          <span>+{extra} itens</span>
                        </More>
                      )}
                    </CellList>
                  )}
                </Cell>
              );
            }}
          />
        </Grid>
        <Legend>
          {GROUP_ORDER.map((id) => (
            <span key={id}>
              <Dot $tone={KIND_GROUPS[id].tone} />
              {KIND_GROUPS[id].label} ({counts[id]})
            </span>
          ))}
        </Legend>
      </Board>

      <Modal
        open={dayOpen && dayDocument === null}
        onCancel={() => setDayOpen(false)}
        footer={null}
        centered
        width={760}
        title={
          <Flex vertical>
            <DayTitle>{longDate(selectedIso)}</DayTitle>
            <Muted>{relativeDay(selectedIso, today)}</Muted>
          </Flex>
        }
      >
        <DayBody>
          {events.loading && !events.data ? (
            <Skeleton active />
          ) : dayEvents.length ? (
            <Flex vertical gap={10}>
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} kindName={kindName} subjectName={subjectName} sourceName={sourceName} onOpenDocument={setDayDocument} />
              ))}
            </Flex>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma alteração neste dia com os filtros escolhidos" />
          )}
        </DayBody>
      </Modal>
      <DocumentModal documentId={dayDocument} sourceName={sourceName} kindName={(id) => status.kinds[id] ?? id} onClose={() => setDayDocument(null)} />

      <SectionCard title={`O que vem por aí (próximos ${UPCOMING_DAYS} dias)`}>
        {upcoming.error ? (
          <ErrorState message={upcoming.error} onRetry={upcoming.reload} />
        ) : !upcoming.data ? (
          <Skeleton active />
        ) : upcoming.data.length ? (
          <Flex vertical gap={10}>
            {upcoming.data.map((event) => (
              <EventCard key={event.id} event={event} kindName={kindName} subjectName={subjectName} sourceName={sourceName} showDate onOpenDocument={onOpenDocument} />
            ))}
          </Flex>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma alteração prevista com os filtros escolhidos" />
        )}
      </SectionCard>
    </Flex>
  );
}
