import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, DatePicker, Flex, Form, Input, Segmented, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, FilterPanel, LoadingState, Toolbar, ToolbarSpacer } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { useIntelligence } from '@/modules/intelligence/context';
import { groupSameAct, REFORM_GROUP, RELEVANCE, resultCountText } from '@/modules/intelligence/format';
import { FILTER_KEYS } from '@/modules/intelligence/paths';
import type { Publication, PublicationFilters, PublicationPage, Relevance } from '@/modules/intelligence/types';
import { colors, radius, shadows } from '@/theme';

// barra de busca e filtros rápidos num card branco, como os demais blocos do módulo
const ToolbarCard = styled(Toolbar)`
  padding: 12px 14px;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
`;

const FilterCard = styled(FilterPanel)`
  box-shadow: ${shadows.sm};
`;

// filtros avançados em grade compacta dentro do painel recolhível
const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0 12px;
  align-items: end;

  .ant-form-item {
    margin-bottom: 12px;
  }

  .ant-select,
  .ant-picker {
    width: 100%;
  }
`;

const SearchInput = styled(Input)`
  width: 320px;
  max-width: 100%;
`;

const CountBadge = styled(Badge)`
  margin-left: 6px;
`;

const ResultCount = styled(Typography.Text)`
  &&& {
    font-size: 12.5px;
    color: ${colors.textMuted};
  }
`;

// filtro rápido de relevância: mesmo parâmetro "relevance" do endereço
const RELEVANCE_OPTIONS = [
  { value: '', label: 'Todas' },
  ...(Object.keys(RELEVANCE) as Relevance[]).map((id) => ({ value: id, label: RELEVANCE[id].plural })),
];

const ADVANCED_KEYS: (keyof PublicationFilters)[] = ['subject', 'source', 'from', 'to'];

const SEARCH_DELAY_MS = 350;
const ISO = 'YYYY-MM-DD';

function readFilters(params: URLSearchParams): PublicationFilters {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])) as unknown as PublicationFilters;
}

// em telas estreitas o filtro rola de lado em vez de ser cortado
const SegmentedScroll = styled.div`
  max-width: 100%;
  overflow-x: auto;
`;

export function PublicationsView() {
  const { sources, subjects, refreshKey } = useIntelligence();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const runLabel = params.get('runLabel');
  const [search, setSearch] = useState(filters.q);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const searchLimit = useCharLimit('publicationSearch');
  // painel de filtros avançados começa aberto quando o endereço já traz algum deles
  const [showAdvanced, setShowAdvanced] = useState(() => ADVANCED_KEYS.some((key) => filters[key]));

  const state = useLoad(() => intelligenceApi.publications(filters), [params.toString(), refreshKey]);

  // busca aplicada depois de uma pausa na digitação
  useEffect(() => {
    if (search.trim() === filters.q) return undefined;
    const timer = setTimeout(() => setFilter('q', search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [search]);

  function setFilter(key: keyof PublicationFilters, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === 'run' && !value) next.delete('runLabel');
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setParams(new URLSearchParams());
  }

  async function loadMore(page: PublicationPage) {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await intelligenceApi.publications(filters, page.items.length);
      state.setData((current) => current && { total: next.total, items: [...current.items, ...next.items] });
    } catch (error) {
      setMoreError(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  const replaceItem = (publication: Publication) =>
    state.setData((page) => page && { ...page, items: page.items.map((p) => (p.id === publication.id ? publication : p)) });

  const hasFilters = FILTER_KEYS.some((key) => filters[key]);
  const advancedCount = ADVANCED_KEYS.filter((key) => filters[key]).length;
  const dateValue = (value: string) => (value ? dayjs(value, ISO) : null);
  const page = state.data;

  return (
    <Flex vertical gap={16}>
      <ToolbarCard>
        <SearchInput
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Buscar no título ou trecho..."
          aria-label="Buscar publicações"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          {...searchLimit}
        />
        <SegmentedScroll>
          <Segmented
            value={filters.relevance}
            onChange={(value) => setFilter('relevance', String(value))}
            options={RELEVANCE_OPTIONS}
            aria-label="Filtrar por relevância"
          />
        </SegmentedScroll>
        <Button icon={<FilterOutlined />} aria-expanded={showAdvanced} onClick={() => setShowAdvanced((open) => !open)}>
          Mais filtros
          {advancedCount > 0 && <CountBadge count={advancedCount} color={colors.blue} size="small" />}
        </Button>
        <ToolbarSpacer />
        {hasFilters && <Button onClick={clearFilters}>Limpar filtros</Button>}
      </ToolbarCard>

      {showAdvanced && (
        <FilterCard>
          <Form layout="vertical" component="div">
            <FilterGrid>
              <Form.Item label="Assunto">
                <Select
                  value={filters.subject}
                  onChange={(value) => setFilter('subject', value)}
                  options={[
                    { value: '', label: 'Todos os assuntos' },
                    { value: REFORM_GROUP, label: 'Reforma Tributária (IBS, CBS e IS)' },
                    ...subjects.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </Form.Item>
              <Form.Item label="Fonte">
                <Select
                  value={filters.source}
                  onChange={(value) => setFilter('source', value)}
                  options={[{ value: '', label: 'Todas as fontes' }, ...sources.map((s) => ({ value: s.id, label: s.name }))]}
                />
              </Form.Item>
              <Form.Item label="De">
                <DatePicker value={dateValue(filters.from)} onChange={(d) => setFilter('from', d ? d.format(ISO) : '')} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item label="Até">
                <DatePicker value={dateValue(filters.to)} onChange={(d) => setFilter('to', d ? d.format(ISO) : '')} format="DD/MM/YYYY" />
              </Form.Item>
            </FilterGrid>
          </Form>
        </FilterCard>
      )}

      {filters.run && (
        <Alert
          type="info"
          showIcon
          message={`Mostrando as publicações guardadas pela execução de ${runLabel || 'histórico'}.`}
          action={
            <Button size="small" onClick={() => setFilter('run', '')}>
              Ver todas
            </Button>
          }
        />
      )}

      {state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : !page ? (
        <LoadingState rows={8} />
      ) : (
        <Flex vertical gap={12}>
          <ResultCount>
            {resultCountText(page.total, page.items.length, groupSameAct(page.items).length)}
          </ResultCount>
          <PublicationList
            items={page.items}
            onChange={replaceItem}
            groupSources
            emptyText={hasFilters ? 'Nenhuma publicação corresponde aos filtros.' : 'Nenhuma publicação coletada ainda. Use "Atualizar agora" ou aguarde a coleta automática.'}
          />
          {page.total > page.items.length && (
            <Flex justify="center">
              <Button loading={loadingMore} onClick={() => void loadMore(page)}>
                {moreError ? `Tentar novamente (${moreError})` : 'Carregar mais'}
              </Button>
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  );
}
