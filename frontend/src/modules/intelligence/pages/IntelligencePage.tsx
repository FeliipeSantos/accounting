import { ReadOutlined, SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Tabs, Tooltip } from 'antd';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { Page } from '@/core/layout/Page';
import { ErrorState, LoadingState, PageContainer } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { PublicationDetail } from '@/modules/intelligence/components/PublicationDetail';
import { IntelligenceContext, type IntelligenceContextValue } from '@/modules/intelligence/context';
import { nextRunText, RUN_TONE, runOutcomeText, updatedAtText } from '@/modules/intelligence/format';
import { useRunStatus } from '@/modules/intelligence/hooks/useRunStatus';
import { DEFAULT_LOCATION, rememberLocation } from '@/modules/intelligence/lastLocation';
import { INTELLIGENCE_TABS, type IntelligenceTab, tabPath } from '@/modules/intelligence/paths';
import { isOpenPublicationState } from '@/modules/intelligence/search';
import type { Publication, RunState, Source, Subject } from '@/modules/intelligence/types';
import { DashboardView } from '@/modules/intelligence/views/DashboardView';
import { PublicationsView } from '@/modules/intelligence/views/PublicationsView';
import { SettingsView } from '@/modules/intelligence/views/SettingsView';
import { CategoriesView, FavoritesView, HistoryView } from '@/modules/intelligence/views/SimpleViews';
import { colors, fontSize, type Tone, tones } from '@/theme';

const RunButton = styled(Button)`
  &&:disabled {
    cursor: wait;
  }
`;

// linha "Atualizado em: ..." do cabeçalho: leva ao Histórico, como o antigo card "Última execução"
const CollectionStatus = styled.button<{ $tone: Tone }>`
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
  cursor: pointer;
  border-radius: 4px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $tone }) => tones[$tone].solid};
  }

  &:hover {
    color: ${colors.textDark};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }
`;

const TabCount = styled.span`
  margin-left: 6px;
  font-size: ${fontSize.label}px;
  color: ${colors.textSubtle};
  font-variant-numeric: tabular-nums;
`;

const VIEWS: Record<IntelligenceTab, () => ReactNode> = {
  painel: () => <DashboardView />,
  lista: () => <PublicationsView />,
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

function LastCollection({ state, running }: { state: RunState | null; running: boolean }) {
  const navigate = useNavigate();
  if (!state && !running) return null;
  const run = state?.lastRun ?? null;
  const tone: Tone = running ? 'info' : run ? RUN_TONE[run.status] : 'neutral';
  const detail = [run && !running ? runOutcomeText(run) : null, state ? nextRunText(state) : null].filter(Boolean).join(' · ');
  return (
    <Tooltip title={detail || undefined}>
      <CollectionStatus type="button" $tone={tone} onClick={() => navigate(tabPath('historico'))}>
        {updatedAtText(run, running)}
      </CollectionStatus>
    </Tooltip>
  );
}

function ModuleContent({ tab, catalog, reloadCatalog }: { tab: IntelligenceTab; catalog: Catalog; reloadCatalog: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<Publication | null>(null);
  const detailListener = useRef<((publication: Publication) => void) | undefined>(undefined);

  // publicação escolhida na busca global: abre o painel de detalhes e limpa o estado da rota
  useEffect(() => {
    if (!isOpenPublicationState(location.state)) return;
    detailListener.current = undefined;
    setDetail(location.state.openPublication);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  const sourceName = useCallback((id: string) => catalog.sources.find((s) => s.id === id)?.name ?? id, [catalog.sources]);
  const subjectName = useCallback((id: string) => catalog.subjects.find((s) => s.id === id)?.name ?? id, [catalog.subjects]);

  const { running, notice, start, state } = useRunStatus(sourceName, () => {
    // coleta terminou: atualiza a aba aberta e a situação das fontes
    setRefreshKey((n) => n + 1);
    reloadCatalog();
  });

  // total de publicações = soma das contagens por fonte (já carregadas no catálogo)
  const publicationCount = useMemo(() => catalog.sources.reduce((sum, s) => sum + (s.count ?? 0), 0), [catalog.sources]);

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
        title="Publicações"
        description="Atualizações fiscais, tributárias e trabalhistas das fontes oficiais."
        icon={<ReadOutlined />}
        actions={
          <>
            <LastCollection state={state} running={running} />
            <RunButton type="primary" icon={<SyncOutlined spin={running} />} disabled={running} onClick={() => void start()} title="Buscar agora novas publicações em todas as fontes ativas">
              {running ? 'Coletando...' : 'Atualizar agora'}
            </RunButton>
          </>
        }
      >
        {notice && <Alert type={notice.tone} showIcon message={notice.text} role="status" />}
        <div>
          <Tabs
            activeKey={tab}
            onChange={(key) => navigate(tabPath(key as IntelligenceTab))}
            items={INTELLIGENCE_TABS.map(({ key, label }) => ({
              key,
              label:
                key === 'lista' && publicationCount > 0 ? (
                  <>
                    {label}
                    <TabCount>{publicationCount}</TabCount>
                  </>
                ) : (
                  label
                ),
            }))}
          />
          {VIEWS[tab]()}
        </div>
      </Page>
      <PublicationDetail publication={detail} onClose={() => setDetail(null)} onChange={changeFromDetail} />
    </IntelligenceContext.Provider>
  );
}

export function IntelligencePage() {
  const { tab } = useParams();
  const { pathname, search } = useLocation();
  const catalog = useLoad(loadCatalog, []);
  const validTab = INTELLIGENCE_TABS.some((t) => t.key === tab);

  // lembra aba e filtros para o menu lateral voltar ao mesmo ponto
  useEffect(() => {
    if (validTab) rememberLocation(pathname, search);
  }, [validTab, pathname, search]);

  if (!validTab) return <Navigate to={DEFAULT_LOCATION} replace />;

  return (
    <div data-print-hide>
      {catalog.error || catalog.data === undefined ? (
        <PageContainer>{catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : <LoadingState rows={6} />}</PageContainer>
      ) : (
        <ModuleContent tab={tab as IntelligenceTab} catalog={catalog.data} reloadCatalog={catalog.reload} />
      )}
    </div>
  );
}
