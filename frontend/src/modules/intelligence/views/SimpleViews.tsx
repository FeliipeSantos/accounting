import { Button, Card, Col, Empty, Row, Table, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { ViewState } from '@/modules/intelligence/components/ViewState';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDateTime, RUN_STATUS, TRIGGER_LABELS } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication, Run, Subject } from '@/modules/intelligence/types';

const CategoryCard = styled(Card)`
  height: 100%;
  cursor: pointer;
`;

export function CategoriesView() {
  const navigate = useNavigate();
  const { refreshKey } = useIntelligence();
  const state = useLoad(() => intelligenceApi.subjects(), [refreshKey]);

  return (
    <ViewState state={state}>
      {(subjects: Subject[]) => (
        <Row gutter={[16, 16]}>
          {subjects.map((s) => (
            <Col key={s.id} xs={24} sm={12} lg={8}>
              <CategoryCard hoverable size="small" onClick={() => navigate(publicationsPath({ subject: s.id }))}>
                <Typography.Text strong>{s.name}</Typography.Text>
                <br />
                <Typography.Text>{s.count} publicação(ões)</Typography.Text>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2, tooltip: s.keywords.join(', ') }}>
                  Termos: {s.keywords.join(', ')}
                </Typography.Paragraph>
                {!s.enabled && <Tag>Monitoramento desativado</Tag>}
              </CategoryCard>
            </Col>
          ))}
        </Row>
      )}
    </ViewState>
  );
}

export function FavoritesView() {
  const { refreshKey } = useIntelligence();
  const state = useLoad(() => intelligenceApi.favorites(), [refreshKey]);

  // desmarcar um favorito o tira da lista
  const update = (publication: Publication) =>
    state.setData((items) => (publication.favorite ? items?.map((p) => (p.id === publication.id ? publication : p)) : items?.filter((p) => p.id !== publication.id)));

  return (
    <ViewState state={state}>
      {(items: Publication[]) => (
        <PublicationList items={items} onChange={update} emptyText="Você ainda não salvou nenhuma publicação. Use ☆ nos cards para favoritar." />
      )}
    </ViewState>
  );
}

export function HistoryView() {
  const navigate = useNavigate();
  const { refreshKey, sourceName } = useIntelligence();
  const state = useLoad(() => intelligenceApi.runs(), [refreshKey]);

  return (
    <ViewState state={state}>
      {(runs: Run[]) =>
        runs.length === 0 ? (
          <Empty description="Nenhuma execução do monitoramento registrada ainda." />
        ) : (
          <Table<Run>
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={runs}
            columns={[
              { title: 'Início', dataIndex: 'startedAt', render: (value: string) => formatDateTime(value) },
              { title: 'Fim', dataIndex: 'finishedAt', render: (value: string | null) => formatDateTime(value) },
              { title: 'Origem', dataIndex: 'trigger', render: (value: string) => TRIGGER_LABELS[value] ?? value },
              { title: 'Status', dataIndex: 'status', render: (value: string) => RUN_STATUS[value] ?? value },
              { title: 'Novas', dataIndex: 'newCount' },
              { title: 'Duplicadas', dataIndex: 'duplicateCount' },
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
        )
      }
    </ViewState>
  );
}
