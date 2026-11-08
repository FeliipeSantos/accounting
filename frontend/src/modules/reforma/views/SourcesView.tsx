import { ClockCircleOutlined, DiffOutlined, FileSearchOutlined, FileTextOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Table, Tooltip } from 'antd';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { SectionCard, StatCard, StatGrid, StatusBadge, TableFrame } from '@/core/ui';
import { reformaApi } from '@/modules/reforma/api';
import { formatDate, formatDateTime, formatDuration, RUN_STATUS, runOutcome, TRIGGER_LABELS } from '@/modules/reforma/format';
import type { Source, Status, SyncRun } from '@/modules/reforma/types';
import { colors, fontSize } from '@/theme';

const Name = styled.a`
  font-weight: 600;
  color: ${colors.navy};
`;

const Note = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  overflow-wrap: anywhere;
`;

const Numeric = styled.span`
  font-variant-numeric: tabular-nums;
`;

const ReviewList = styled.ul`
  margin: 4px 0 0;
  padding-left: 18px;
  overflow-wrap: anywhere;
`;

const ErrorText = styled.span`
  font-size: ${fontSize.label}px;
  color: ${colors.red};
`;

function sourceState(source: Source) {
  if (!source.last) return <StatusBadge tone="neutral">Nunca consultada</StatusBadge>;
  if (source.last.status === 'error')
    return (
      <Tooltip title={source.last.error}>
        <span>
          <StatusBadge tone="danger">Erro</StatusBadge>
        </span>
      </Tooltip>
    );
  return <StatusBadge tone="success">OK</StatusBadge>;
}

/** Indicators, the state of each monitored source and the latest synchronizations. */
export function SourcesView({ status, refreshKey }: { status: Status; refreshKey: number }) {
  const runs = useLoad(() => reformaApi.runs(), [refreshKey]);
  const failing = status.sources.filter((s) => s.last?.status === 'error').length;
  const ok = status.sources.filter((s) => s.last?.status === 'success').length;
  const sourceName = (id: string) => status.sources.find((s) => s.id === id)?.name ?? id;

  return (
    <>
      <StatGrid $min={190}>
        <StatCard icon={<FileTextOutlined />} label="Documentos monitorados" value={status.totals.documents} hint={`${status.totals.versions} versões guardadas`} />
        <StatCard icon={<FileSearchOutlined />} iconTone="green" label="Novos neste mês" value={status.totals.newThisMonth} hint="documentos encontrados" />
        <StatCard icon={<DiffOutlined />} iconTone="purple" label="Alterados neste mês" value={status.totals.changedThisMonth} hint="novas versões de documentos" />
        <StatCard
          icon={<ClockCircleOutlined />}
          iconTone="orange"
          label="Pendentes de análise"
          value={status.totals.pendingAnalysis}
          hint={status.totals.pendingFiles ? `${status.totals.pendingFiles} PDF(s) a baixar` : 'análise por IA na etapa 2'}
        />
        <StatCard
          icon={<WarningOutlined />}
          iconTone={failing ? 'red' : 'gray'}
          label="Fontes"
          value={`${ok}/${status.sources.length}`}
          tone={failing ? 'danger' : undefined}
          hint={failing ? `${failing} com erro na última consulta` : 'consultadas com sucesso'}
        />
      </StatGrid>

      {status.recurringReviews.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Prazos recorrentes para revisar"
          description={
            <ReviewList>
              {status.recurringReviews.map((review) => (
                <li key={review.ruleId}>
                  <strong>{review.title}</strong> (conferido em {formatDate(review.since)}):{' '}
                  {review.acts.map((act, index) => (
                    <span key={act.documentId}>
                      {index > 0 && ' · '}
                      <a href={act.url} target="_blank" rel="noopener noreferrer">
                        {act.title} ({formatDate(act.date)}) ↗
                      </a>
                    </span>
                  ))}
                </li>
              ))}
            </ReviewList>
          }
        />
      )}

      <SectionCard title="Fontes monitoradas" flush>
        <TableFrame>
          <Table<Source>
            rowKey="id"
            pagination={false}
            dataSource={status.sources}
            scroll={{ x: 900 }}
            columns={[
              {
                title: 'Fonte',
                key: 'name',
                render: (_, source) => (
                  <>
                    {source.url.startsWith('http') ? (
                      <Name href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.name}
                      </Name>
                    ) : (
                      <Name as="span">{source.name}</Name>
                    )}
                    <Note>{source.method}</Note>
                    {source.note && <Note>{source.note}</Note>}
                  </>
                ),
              },
              {
                title: 'Situação',
                key: 'state',
                width: 110,
                render: (_, source) => sourceState(source),
              },
              {
                title: 'Documentos',
                dataIndex: 'documents',
                width: 110,
                align: 'right',
                render: (n: number) => <Numeric>{n}</Numeric>,
              },
              {
                title: 'Última consulta',
                key: 'checked',
                width: 190,
                render: (_, source) =>
                  source.last ? (
                    <>
                      <Numeric>{formatDateTime(source.last.checkedAt)}</Numeric>
                      <Note>
                        {source.last.fetched} lidos · {formatDuration(source.last.durationMs)}
                      </Note>
                      {source.last.status === 'error' && <ErrorText>{source.last.error}</ErrorText>}
                    </>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Último sucesso',
                key: 'success',
                width: 150,
                render: (_, source) => <Numeric>{formatDateTime(source.last?.lastSuccessAt)}</Numeric>,
              },
            ]}
          />
        </TableFrame>
      </SectionCard>

      <SectionCard title="Sincronizações" flush>
        <TableFrame>
          <Table<SyncRun>
            rowKey="id"
            loading={runs.loading && !runs.data}
            dataSource={runs.data ?? []}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
            locale={{ emptyText: 'Nenhuma sincronização realizada ainda' }}
            expandable={{
              expandedRowRender: (run) => <RunSources runId={run.id} sourceName={sourceName} />,
            }}
            columns={[
              {
                title: 'Início',
                dataIndex: 'startedAt',
                width: 160,
                render: (v: string) => <Numeric>{formatDateTime(v)}</Numeric>,
              },
              {
                title: 'Origem',
                dataIndex: 'trigger',
                width: 140,
                render: (v: string, run) => `${TRIGGER_LABELS[v] ?? v}${run.requestedBy ? ` · ${run.requestedBy}` : ''}`,
              },
              {
                title: 'Situação',
                dataIndex: 'status',
                width: 170,
                render: (v: SyncRun['status']) => <StatusBadge tone={RUN_STATUS[v].tone}>{RUN_STATUS[v].label}</StatusBadge>,
              },
              {
                title: 'Resultado',
                key: 'outcome',
                render: (_, run) => (run.error ? <ErrorText>{run.error}</ErrorText> : runOutcome(run)),
              },
            ]}
          />
        </TableFrame>
      </SectionCard>
    </>
  );
}

function RunSources({ runId, sourceName }: { runId: string; sourceName: (id: string) => string }) {
  const state = useLoad(() => reformaApi.run(runId), [runId]);
  return (
    <Table
      rowKey="sourceId"
      size="small"
      loading={state.loading}
      pagination={false}
      dataSource={state.data?.sources ?? []}
      columns={[
        {
          title: 'Fonte',
          dataIndex: 'sourceId',
          render: (id: string) => sourceName(id),
        },
        {
          title: 'Situação',
          dataIndex: 'status',
          width: 110,
          render: (v: string, row) =>
            v === 'error' ? (
              <Tooltip title={row.error}>
                <span>
                  <StatusBadge tone="danger">Erro</StatusBadge>
                </span>
              </Tooltip>
            ) : (
              <StatusBadge tone="success">OK</StatusBadge>
            ),
        },
        { title: 'Lidos', dataIndex: 'fetched', width: 80, align: 'right' },
        {
          title: 'Novos',
          dataIndex: 'newDocuments',
          width: 80,
          align: 'right',
        },
        {
          title: 'Versões',
          dataIndex: 'newVersions',
          width: 80,
          align: 'right',
        },
        {
          title: 'Duração',
          dataIndex: 'durationMs',
          width: 100,
          align: 'right',
          render: (ms: number) => formatDuration(ms),
        },
      ]}
    />
  );
}
