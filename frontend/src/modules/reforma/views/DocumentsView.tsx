import { Checkbox, Input, Select, Table, Tag } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, SectionCard, StatusBadge, TableFrame, Toolbar } from '@/core/ui';
import { PAGE_SIZE, reformaApi } from '@/modules/reforma/api';
import { HintBadge } from '@/modules/reforma/components/HintBadge';
import { FILE_STATUS, formatDate, formatDateTime } from '@/modules/reforma/format';
import type { DocumentFilters, DocumentSummary, Status } from '@/modules/reforma/types';
import { colors, fontSize } from '@/theme';

const DocTitle = styled.div`
  font-weight: 600;
  color: ${colors.navy};
  overflow-wrap: anywhere;
`;

const Summary = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: ${colors.textMuted};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Numeric = styled.span`
  font-variant-numeric: tabular-nums;
`;

const Label = styled.span`
  font-size: ${fontSize.support}px;
  font-weight: 600;
  color: ${colors.textDark};
`;

const SearchBox = styled(Input.Search)`
  max-width: 320px;
`;

const SourceSelect = styled(Select)`
  min-width: 240px;
` as typeof Select;

const KindSelect = styled(Select)`
  min-width: 180px;
` as typeof Select;

// linhas abrem o documento
const ClickableRows = styled(TableFrame)`
  .ant-table-tbody > tr {
    cursor: pointer;
  }
`;

const EMPTY: DocumentFilters = { source: '', kind: '', q: '', changed: '' };

interface DocumentsViewProps {
  status: Status;
  refreshKey: number;
  onOpen: (documentId: string) => void;
  /** Term of the global search ("ver todos os documentos"). */
  initialSearch?: string;
}

/** Every document collected, newest change first, with search and filters. */
export function DocumentsView({ status, refreshKey, onOpen, initialSearch = '' }: DocumentsViewProps) {
  const [filters, setFilters] = useState<DocumentFilters>({ ...EMPTY, q: initialSearch });
  const [page, setPage] = useState(1);
  const state = useLoad(() => reformaApi.documents(filters, (page - 1) * PAGE_SIZE), [filters, page, refreshKey]);
  const sourceName = (id: string) => status.sources.find((s) => s.id === id)?.name ?? id;

  function change(update: Partial<DocumentFilters>) {
    setFilters((current) => ({ ...current, ...update }));
    setPage(1);
  }

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;

  return (
    <SectionCard
      flush
      title={
        <Toolbar>
          <SearchBox placeholder="Buscar no título e no resumo" defaultValue={initialSearch} allowClear onSearch={(q) => change({ q })} aria-label="Buscar documentos" />
          <SourceSelect
            value={filters.source}
            onChange={(source) => change({ source })}
            aria-label="Fonte"
            options={[{ value: '', label: 'Todas as fontes' }, ...status.sources.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <KindSelect
            value={filters.kind}
            onChange={(kind) => change({ kind })}
            aria-label="Tipo"
            options={[
              { value: '', label: 'Todos os tipos' },
              ...Object.entries(status.kinds).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <Checkbox checked={filters.changed === 'versions'} onChange={(e) => change({ changed: e.target.checked ? 'versions' : '' })}>
            Só com mais de uma versão
          </Checkbox>
        </Toolbar>
      }
    >
      <ClickableRows>
        <Table<DocumentSummary>
          rowKey="id"
          loading={state.loading}
          dataSource={state.data?.items ?? []}
          scroll={{ x: 980 }}
          onRow={(doc) => ({ onClick: () => onOpen(doc.id) })}
          locale={{ emptyText: 'Nenhum documento encontrado' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: state.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total) => `${total} documento(s)`,
          }}
          columns={[
            {
              title: 'Documento',
              key: 'title',
              render: (_, doc) => (
                <>
                  <DocTitle>{doc.title}</DocTitle>
                  {doc.currentVersion.summary && <Summary>{doc.currentVersion.summary}</Summary>}
                </>
              ),
            },
            {
              title: 'Tipo',
              dataIndex: 'kind',
              width: 150,
              render: (kind: string, doc) => (
                <>
                  <Tag>{status.kinds[kind] ?? kind}</Tag>
                  {doc.sourceStatus === 'não vigente' && <StatusBadge tone="neutral">não vigente</StatusBadge>}
                </>
              ),
            },
            {
              title: 'Fonte',
              dataIndex: 'sourceId',
              width: 200,
              render: (id: string) => sourceName(id),
            },
            {
              title: 'Publicado',
              dataIndex: 'publishedAt',
              width: 110,
              render: (v: string | null) => <Numeric>{formatDate(v)}</Numeric>,
            },
            {
              title: 'Versão',
              key: 'version',
              width: 150,
              render: (_, doc) => {
                const file = FILE_STATUS[doc.currentVersion.fileStatus];
                return (
                  <>
                    <Label>{doc.currentVersion.label ?? '—'}</Label>
                    {doc.versionCount > 1 && <StatusBadge tone="info">{doc.versionCount} versões</StatusBadge>}
                    {file && (
                      <div>
                        <HintBadge tone={file.tone} label={file.label} what={file.hint} />
                      </div>
                    )}
                  </>
                );
              },
            },
            {
              title: 'Atualizado',
              dataIndex: 'updatedAt',
              width: 140,
              render: (v: string) => <Numeric>{formatDateTime(v)}</Numeric>,
            },
          ]}
        />
      </ClickableRows>
    </SectionCard>
  );
}
