import { ReadOutlined, SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Tabs } from 'antd';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { useLoad } from '@/core/hooks/useLoad';
import { Page } from '@/core/layout/Page';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationDetail } from '@/modules/intelligence/components/PublicationDetail';
import { ViewState } from '@/modules/intelligence/components/ViewState';
import { IntelligenceContext, type IntelligenceContextValue } from '@/modules/intelligence/context';
import { useRunStatus } from '@/modules/intelligence/hooks/useRunStatus';
import { INTELLIGENCE_TABS, type IntelligenceTab } from '@/modules/intelligence/paths';
import type { Publication, Source, Subject } from '@/modules/intelligence/types';
import { DashboardView } from '@/modules/intelligence/views/DashboardView';
import { PublicationsView } from '@/modules/intelligence/views/PublicationsView';
import { SettingsView } from '@/modules/intelligence/views/SettingsView';
import { CategoriesView, FavoritesView, HistoryView } from '@/modules/intelligence/views/SimpleViews';

const VIEWS: Record<IntelligenceTab, () => ReactNode> = {
  painel: () => <DashboardView />,
  publicacoes: () => <PublicationsView />,
  categorias: () => <CategoriesView />,
  favoritos: () => <FavoritesView />,
  historico: () => <HistoryView />,
  configuracoes: () => <SettingsView />,
};

interface Catalog {
  sources: Source[];
  subjects: Subject[];
}

async function loadCatalog(): Promise<Catalog> {
  const [sources, subjects] = await Promise.all([intelligenceApi.sources(), intelligenceApi.subjects()]);
  return { sources, subjects };
}

function ModuleContent({ tab, catalog, reloadCatalog }: { tab: IntelligenceTab; catalog: Catalog; reloadCatalog: () => void }) {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<Publication | null>(null);
  const detailListener = useRef<((publication: Publication) => void) | undefined>(undefined);

  const sourceName = useCallback((id: string) => catalog.sources.find((s) => s.id === id)?.name ?? id, [catalog.sources]);
  const subjectName = useCallback((id: string) => catalog.subjects.find((s) => s.id === id)?.name ?? id, [catalog.subjects]);

  const { running, notice, start } = useRunStatus(sourceName, () => {
    // coleta terminou: atualiza a aba aberta e a situação das fontes
    setRefreshKey((n) => n + 1);
    reloadCatalog();
  });

  const context = useMemo<IntelligenceContextValue>(
    () => ({
      sources: catalog.sources,
      subjects: catalog.subjects,
      sourceName,
      subjectName,
      reloadCatalog: async () => reloadCatalog(),
      refreshKey,
      openDetail: (publication, onChange) => {
        detailListener.current = onChange;
        setDetail(publication);
      },
    }),
    [catalog, sourceName, subjectName, reloadCatalog, refreshKey],
  );

  function changeFromDetail(publication: Publication) {
    setDetail(publication);
    detailListener.current?.(publication);
  }

  return (
    <IntelligenceContext.Provider value={context}>
      <Page
        icon={<ReadOutlined />}
        title="Inteligência Contábil"
        subtitle="Atualizações fiscais, tributárias e trabalhistas das fontes oficiais"
        actions={
          <Button type="primary" icon={<SyncOutlined spin={running} />} disabled={running} onClick={() => void start()} title="Buscar agora novas publicações em todas as fontes ativas">
            {running ? 'Coletando...' : 'Atualizar agora'}
          </Button>
        }
      >
        <Flex vertical gap={16}>
          {notice && <Alert type={notice.tone} showIcon message={notice.text} role="status" />}
          <Tabs
            activeKey={tab}
            onChange={(key) => navigate(`/inteligencia/${key}`)}
            items={INTELLIGENCE_TABS.map(({ key, label }) => ({ key, label }))}
          />
          {VIEWS[tab]()}
        </Flex>
      </Page>
      <PublicationDetail publication={detail} onClose={() => setDetail(null)} onChange={changeFromDetail} />
    </IntelligenceContext.Provider>
  );
}

export function IntelligencePage() {
  const { tab } = useParams();
  const catalog = useLoad(loadCatalog, []);

  if (!INTELLIGENCE_TABS.some((t) => t.key === tab)) return <Navigate to="/inteligencia/painel" replace />;

  return (
    <ViewState state={catalog}>{(data: Catalog) => <ModuleContent tab={tab as IntelligenceTab} catalog={data} reloadCatalog={catalog.reload} />}</ViewState>
  );
}
