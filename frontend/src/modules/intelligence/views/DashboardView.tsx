import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ExclamationCircleFilled,
  FileTextOutlined,
  NotificationOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { type ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, LoadingState, SectionCard, StatCard, StatGrid } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { BarList } from '@/modules/intelligence/components/BarList';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDateTime, groupSameAct, localDaysAgo, REFORM_GROUP, REFORM_SUBJECTS, RUN_STATUS, RUN_TONE } from '@/modules/intelligence/format';
import { publicationsPath, tabPath } from '@/modules/intelligence/paths';
import type { Publication, Run, RunStatus, Summary } from '@/modules/intelligence/types';
import { fontSize, type Tone, tones } from '@/theme';

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

// publicações recentes (~60%) à esquerda e categorias (~40%) à direita
const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 16px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const CardLink = styled(Button)`
  &&& {
    height: auto;
    padding: 0;
    font-size: ${fontSize.support}px;
    font-weight: 600;
  }
`;

const StatusIcon = styled.span<{ $tone: Tone }>`
  display: inline-flex;
  color: ${({ $tone }) => tones[$tone].fg};
`;

const StatusText = styled.span<{ $tone: Tone }>`
  font-weight: 500;
  color: ${({ $tone }) => ($tone === 'success' ? tones.success.fg : 'inherit')};
`;

const RUN_ICONS: Record<RunStatus, ReactNode> = {
  success: <CheckCircleFilled />,
  partial: <ExclamationCircleFilled />,
  failed: <CloseCircleFilled />,
  running: <SyncOutlined spin />,
};

/** Status line under the "Última Execução" indicator (real status of the last run). */
function RunHint({ run }: { run: Run | null }) {
  if (!run) return <>Nenhuma coleta realizada ainda</>;
  const tone = RUN_TONE[run.status] ?? 'neutral';
  const text = run.status === 'success' ? 'Concluída com sucesso' : (RUN_STATUS[run.status] ?? run.status);
  return (
    <>
      <StatusIcon $tone={tone} aria-hidden>
        {RUN_ICONS[run.status]}
      </StatusIcon>
      <StatusText $tone={tone}>{text}</StatusText>
    </>
  );
}

function DashboardContent({ summary: data, critical, onChange }: { summary: Summary; critical: Publication[]; onChange: (publication: Publication) => void }) {
  const navigate = useNavigate();
  const { sourceName } = useIntelligence();
  // publicações críticas (pelo filtro da API), já agrupadas pela mesma norma
  const groups = useMemo(() => groupSameAct(critical), [critical]);
  const { totals, lastRun } = data;
  const firstCritical = groups[0];
  const criticalSources = firstCritical ? [firstCritical.primary, ...firstCritical.others].map((p) => sourceName(p.sourceId)) : [];
  const shownCritical = groups.reduce((sum, g) => sum + 1 + g.others.length, 0);
  const criticalHint =
    totals.critical === 0
      ? 'nenhuma no momento'
      : groups.length === 1 && shownCritical === totals.critical && criticalSources.length > 1
        ? `mesma norma, ${criticalSources.length} fontes`
        : 'exigem atenção';

  const subjectItems = data.byCategory
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ id: c.id, label: c.name, count: c.count, highlight: REFORM_SUBJECTS.includes(c.id) }));

  return (
    <Stack>
      <StatGrid $min={190}>
        <StatCard
          icon={<AuditOutlined />}
          label="Total de Atualizações"
          value={totals.publications}
          hint="todas as fontes"
          ariaLabel="Ver todas as publicações"
          onClick={() => navigate(publicationsPath({}))}
        />
        <StatCard
          icon={<NotificationOutlined />}
          label="Críticas"
          value={totals.critical}
          tone={totals.critical > 0 ? 'danger' : undefined}
          hint={criticalHint}
          ariaLabel="Ver publicações críticas"
          onClick={() => navigate(publicationsPath({ relevance: 'critica' }))}
        />
        <StatCard
          icon={<CalendarOutlined />}
          label="Recentes"
          value={totals.recent}
          hint={`Últimos ${data.recentDays} dias`}
          ariaLabel={`Ver publicações dos últimos ${data.recentDays} dias`}
          onClick={() => navigate(publicationsPath({ from: localDaysAgo(data.recentDays) }))}
        />
        <StatCard
          icon={<FileTextOutlined />}
          label="Reforma Tributária"
          value={totals.reform}
          hint="IBS, CBS e Imposto Seletivo"
          ariaLabel="Ver publicações da Reforma Tributária"
          onClick={() => navigate(publicationsPath({ subject: REFORM_GROUP }))}
        />
        <StatCard
          icon={<ClockCircleOutlined />}
          label="Última Execução"
          value={lastRun ? formatDateTime(lastRun.finishedAt || lastRun.startedAt) : '—'}
          small
          hint={<RunHint run={lastRun} />}
          ariaLabel="Ver o histórico de execuções"
          onClick={() => navigate(tabPath('historico'))}
        />
      </StatGrid>

      <Columns>
        <SectionCard
          title="Publicações Recentes"
          extra={
            <CardLink type="link" onClick={() => navigate(publicationsPath({ from: localDaysAgo(data.recentDays) }))}>
              Ver todas →
            </CardLink>
          }
        >
          <PublicationList items={data.recentItems} emptyText="Nenhuma publicação coletada nos últimos dias." onChange={onChange} groupSources excerptRows={1} bare />
        </SectionCard>
        <SectionCard
          title="Atualizações por Categoria"
          extra={
            <CardLink type="link" onClick={() => navigate(tabPath('categorias'))}>
              Ver detalhes →
            </CardLink>
          }
        >
          <BarList
            items={subjectItems}
            emptyText="Nenhuma publicação classificada ainda."
            itemTitle={(item) => `Ver publicações de ${item.label}`}
            onSelect={(item) => navigate(publicationsPath({ subject: item.id }))}
          />
        </SectionCard>
      </Columns>
    </Stack>
  );
}

export function DashboardView() {
  const { refreshKey } = useIntelligence();
  const state = useLoad(
    () => Promise.all([intelligenceApi.summary(), intelligenceApi.publications({ relevance: 'critica' })]).then(([summary, critical]) => ({ summary, critical: critical.items })),
    [refreshKey],
  );

  const replaceItem = (publication: Publication) =>
    state.setData(
      (current) =>
        current && {
          ...current,
          summary: { ...current.summary, recentItems: current.summary.recentItems.map((p) => (p.id === publication.id ? publication : p)) },
        },
    );

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState rows={8} />;
  return <DashboardContent summary={state.data.summary} critical={state.data.critical} onChange={replaceItem} />;
}
