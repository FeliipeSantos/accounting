import { Button, Table, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { EmptyState, ErrorState, LoadingState, StatusBadge, TableFrame } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDateTime, REFORM_SUBJECTS, RUN_STATUS, RUN_TONE, TRIGGER_LABELS } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication, Run, RunStatus } from '@/modules/intelligence/types';
import { colors, fontSize, radius, shadows } from '@/theme';

const CategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: 12px;
`;

// categorias com monitoramento desativado ficam esmaecidas
const CategoryCard = styled.button<{ $disabled: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px;
  font: inherit;
  text-align: left;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
  cursor: pointer;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: ${colors.borderStrong};
    box-shadow: ${shadows.md};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }
`;

const CategoryName = styled.span<{ $reform: boolean }>`
  font-size: ${fontSize.cardTitle}px;
  font-weight: 500;
  color: ${({ $reform }) => ($reform ? colors.blue : colors.navy)};
`;

const CategoryCount = styled.span`
  font-size: ${fontSize.support}px;
  font-weight: 500;
  color: ${colors.textDark};
  font-variant-numeric: tabular-nums;
`;

const CategoryKeywords = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  overflow-wrap: anywhere;
`;

const Numeric = styled.span`
  font-variant-numeric: tabular-nums;
`;

export function CategoriesView() {
  const navigate = useNavigate();
  const { refreshKey } = useIntelligence();
  const state = useLoad(() => intelligenceApi.subjects(), [refreshKey]);

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState rows={6} />;
  return (
    <CategoryGrid>
      {state.data.map((s) => (
        <CategoryCard key={s.id} type="button" $disabled={!s.enabled} onClick={() => navigate(publicationsPath({ subject: s.id }))}>
          <CategoryName $reform={REFORM_SUBJECTS.includes(s.id)}>{s.name}</CategoryName>
          <CategoryCount>{s.count} publicação(ões)</CategoryCount>
          <CategoryKeywords>Termos: {s.keywords.join(', ')}</CategoryKeywords>
          {!s.enabled && (
            <StatusBadge tone="neutral" dot={false}>
              Monitoramento desativado
            </StatusBadge>
          )}
        </CategoryCard>
      ))}
    </CategoryGrid>
  );
}

export function FavoritesView() {
  const { refreshKey } = useIntelligence();
  const state = useLoad(() => intelligenceApi.favorites(), [refreshKey]);

  // desmarcar um favorito o tira da lista
  const update = (publication: Publication) =>
    state.setData((items) => (publication.favorite ? items?.map((p) => (p.id === publication.id ? publication : p)) : items?.filter((p) => p.id !== publication.id)));

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState rows={6} />;
  return <PublicationList items={state.data} onChange={update} emptyText="Você ainda não salvou nenhuma publicação. Use ☆ nas publicações para favoritar." />;
}

export function HistoryView() {
  const navigate = useNavigate();
  const { refreshKey, sourceName } = useIntelligence();
  const state = useLoad(() => intelligenceApi.runs(), [refreshKey]);

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState rows={6} />;
  if (state.data.length === 0) return <EmptyState title="Nenhuma execução do monitoramento registrada ainda." />;

  return (
    <TableFrame>
      <Table<Run>
        rowKey="id"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={state.data}
        columns={[
          { title: 'Início', dataIndex: 'startedAt', render: (value: string) => formatDateTime(value) },
          { title: 'Fim', dataIndex: 'finishedAt', render: (value: string | null) => formatDateTime(value) },
          { title: 'Origem', dataIndex: 'trigger', render: (value: string) => TRIGGER_LABELS[value] ?? value },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: RunStatus) => <StatusBadge tone={RUN_TONE[value] ?? 'neutral'}>{RUN_STATUS[value] ?? value}</StatusBadge>,
          },
          { title: 'Novas', dataIndex: 'newCount', align: 'right', render: (value: number) => <Numeric>{value}</Numeric> },
          { title: 'Duplicadas', dataIndex: 'duplicateCount', align: 'right', render: (value: number) => <Numeric>{value}</Numeric> },
          {
            title: 'Falhas',
            key: 'failures',
            render: (_, run) => {
              const failures = run.sources.filter((s) => s.status === 'error');
              if (!failures.length) return '—';
              return (
                <Tooltip title={failures.map((s) => `${sourceName(s.sourceId)}: ${s.error}`).join('\n')}>
                  {failures.map((s) => sourceName(s.sourceId)).join(', ')}
                </Tooltip>
              );
            },
          },
          {
            key: 'open',
            render: (_, run) =>
              run.newCount > 0 && (
                <Button size="small" onClick={() => navigate(publicationsPath({ run: run.id }, formatDateTime(run.startedAt)))}>
                  Ver publicações
                </Button>
              ),
          },
        ]}
      />
    </TableFrame>
  );
}
