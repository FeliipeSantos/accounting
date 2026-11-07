import { Card, Col, Flex, Progress, Row, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { ViewState } from '@/modules/intelligence/components/ViewState';
import { useIntelligence } from '@/modules/intelligence/context';
import { lastRunText, localDaysAgo, nextRunText, REFORM_GROUP, RUN_STATUS } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication, Summary } from '@/modules/intelligence/types';

const StatCard = styled(Card)`
  height: 100%;
  cursor: pointer;
`;

const CategoryRow = styled.button`
  all: unset;
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 2fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  cursor: pointer;
  padding: 2px 0;

  &:focus-visible {
    outline: 2px solid currentColor;
  }
`;

interface StatProps {
  title: string;
  value: string | number;
  hint?: string;
  onClick: () => void;
}

function Stat({ title, value, hint, onClick }: StatProps) {
  return (
    <StatCard hoverable size="small" onClick={onClick} role="button" tabIndex={0} aria-label={`Ver: ${title}`} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <Statistic title={title} value={value} />
      {hint && <Typography.Text type="secondary">{hint}</Typography.Text>}
    </StatCard>
  );
}

export function DashboardView() {
  const navigate = useNavigate();
  const { refreshKey } = useIntelligence();
  const state = useLoad(() => intelligenceApi.summary(), [refreshKey]);

  const replaceItem = (publication: Publication) =>
    state.setData((summary) => summary && { ...summary, recentItems: summary.recentItems.map((p) => (p.id === publication.id ? publication : p)) });

  return (
    <ViewState state={state}>
      {(summary: Summary) => {
        const max = Math.max(1, ...summary.byCategory.map((c) => c.count));
        const categories = [...summary.byCategory].sort((a, b) => b.count - a.count);
        const runStatus = summary.lastRun ? (RUN_STATUS[summary.lastRun.status] ?? summary.lastRun.status) : 'monitoramento ainda não rodou';
        return (
          <Flex vertical gap={24}>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={8} xl={4}>
                <Stat title="Total de atualizações" value={summary.totals.publications} onClick={() => navigate(publicationsPath({}))} />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Stat title="Críticas" value={summary.totals.critical} onClick={() => navigate(publicationsPath({ relevance: 'critica' }))} />
              </Col>
              <Col xs={12} md={8} xl={5}>
                <Stat
                  title="Recentes"
                  value={summary.totals.recent}
                  hint={`últimos ${summary.recentDays} dias`}
                  onClick={() => navigate(publicationsPath({ from: localDaysAgo(summary.recentDays) }))}
                />
              </Col>
              <Col xs={12} md={8} xl={5}>
                <Stat
                  title="Reforma Tributária"
                  value={summary.totals.reform}
                  hint="IBS, CBS e Imposto Seletivo"
                  onClick={() => navigate(publicationsPath({ subject: REFORM_GROUP }))}
                />
              </Col>
              <Col xs={24} md={16} xl={6}>
                <Stat
                  title="Última execução"
                  value={lastRunText(summary.lastRun)}
                  hint={`${runStatus} · ${nextRunText(summary)}`}
                  onClick={() => navigate('/inteligencia/historico')}
                />
              </Col>
            </Row>
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={14}>
                <Card title="Publicações recentes">
                  <PublicationList items={summary.recentItems} emptyText="Nenhuma publicação coletada nos últimos dias." onChange={replaceItem} />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="Atualizações por categoria">
                  <Flex vertical gap={8}>
                    {categories.map((c) => (
                      <CategoryRow key={c.id} onClick={() => navigate(publicationsPath({ subject: c.id }))} title={`Ver publicações de ${c.name}`}>
                        <Typography.Text>{c.name}</Typography.Text>
                        <Progress percent={(c.count / max) * 100} showInfo={false} size="small" />
                        <Typography.Text strong>{c.count}</Typography.Text>
                      </CategoryRow>
                    ))}
                  </Flex>
                </Card>
              </Col>
            </Row>
          </Flex>
        );
      }}
    </ViewState>
  );
}
