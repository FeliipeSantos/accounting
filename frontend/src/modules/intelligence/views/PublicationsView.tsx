import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Col, DatePicker, Flex, Form, Input, Row, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { errorMessage } from '@/core/api/client';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { useLoad } from '@/core/hooks/useLoad';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationList } from '@/modules/intelligence/components/PublicationCard';
import { ViewState } from '@/modules/intelligence/components/ViewState';
import { useIntelligence } from '@/modules/intelligence/context';
import { REFORM_GROUP, RELEVANCE } from '@/modules/intelligence/format';
import { FILTER_KEYS } from '@/modules/intelligence/paths';
import type { Publication, PublicationFilters, PublicationPage, Relevance } from '@/modules/intelligence/types';

const SEARCH_DELAY_MS = 350;
const ISO = 'YYYY-MM-DD';

function readFilters(params: URLSearchParams): PublicationFilters {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])) as unknown as PublicationFilters;
}

export function PublicationsView() {
  const { sources, subjects, refreshKey } = useIntelligence();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const runLabel = params.get('runLabel');
  const [search, setSearch] = useState(filters.q);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const searchLimit = useCharLimit('publicationSearch');

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
  const dateValue = (value: string) => (value ? dayjs(value, ISO) : null);

  return (
    <Flex vertical gap={16}>
      <Form layout="vertical" component="div">
        <Row gutter={[16, 0]} align="bottom">
          <Col xs={24} md={12} lg={8}>
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
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Fonte">
              <Select
                value={filters.source}
                onChange={(value) => setFilter('source', value)}
                options={[{ value: '', label: 'Todas as fontes' }, ...sources.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} lg={8}>
            <Form.Item label="Relevância">
              <Select
                value={filters.relevance}
                onChange={(value) => setFilter('relevance', value)}
                options={[{ value: '', label: 'Todas' }, ...(Object.keys(RELEVANCE) as Relevance[]).map((id) => ({ value: id, label: RELEVANCE[id].label }))]}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={8} lg={5}>
            <Form.Item label="De">
              <DatePicker value={dateValue(filters.from)} onChange={(d) => setFilter('from', d ? d.format(ISO) : '')} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col xs={12} md={8} lg={5}>
            <Form.Item label="Até">
              <DatePicker value={dateValue(filters.to)} onChange={(d) => setFilter('to', d ? d.format(ISO) : '')} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} md={16} lg={10}>
            <Form.Item label="Busca">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Buscar no título ou trecho..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                {...searchLimit}
              />
            </Form.Item>
          </Col>
          {hasFilters && (
            <Col xs={24} lg={4}>
              <Form.Item>
                <Button block onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>

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

      <ViewState state={state}>
        {(page: PublicationPage) => (
          <Flex vertical gap={12}>
            <Typography.Text type="secondary">
              {page.total > page.items.length ? `Mostrando ${page.items.length} de ${page.total} publicação(ões)` : `${page.total} publicação(ões) encontrada(s)`}
            </Typography.Text>
            <PublicationList
              items={page.items}
              onChange={replaceItem}
              emptyText={hasFilters ? 'Nenhuma publicação corresponde aos filtros.' : 'Nenhuma publicação coletada ainda. Use "Atualizar agora" ou aguarde a coleta automática.'}
            />
            {page.total > page.items.length && (
              <Button loading={loadingMore} onClick={() => void loadMore(page)}>
                {moreError ? `Tentar novamente (${moreError})` : 'Carregar mais'}
              </Button>
            )}
          </Flex>
        )}
      </ViewState>
    </Flex>
  );
}
