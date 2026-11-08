import { CalendarOutlined, LockOutlined, SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Tabs } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useLoad } from '@/core/hooks/useLoad';
import { Page } from '@/core/layout/Page';
import { EmptyState, ErrorState, LoadingState } from '@/core/ui';
import { reformaApi } from '@/modules/reforma/api';
import { DocumentModal } from '@/modules/reforma/components/DocumentModal';
import { formatDateTime, nextRunText, RUN_STATUS, runOutcome } from '@/modules/reforma/format';
import { isOpenDocumentState } from '@/modules/reforma/search';
import type { Status } from '@/modules/reforma/types';
import { CalendarView } from '@/modules/reforma/views/CalendarView';
import { DocumentsView } from '@/modules/reforma/views/DocumentsView';
import { SourcesView } from '@/modules/reforma/views/SourcesView';
import { colors, fontSize, tones } from '@/theme';

const POLL_MS = 4000;

const LastSync = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
  }
`;

const TABS = [
  { key: 'calendario', label: 'Calendário' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'fontes', label: 'Fontes e sincronização' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function lastSyncText(status: Status): string {
  if (status.running) return 'Sincronização em andamento...';
  if (!status.lastRun) return 'Nenhuma sincronização realizada ainda';
  return `Última sincronização ${formatDateTime(status.lastRun.finishedAt ?? status.lastRun.startedAt)} · ${nextRunText(status.schedulerEnabled, status.nextRunAt)}`;
}

function ReformaContent() {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = TABS.find((t) => t.key === params.get('aba'))?.key ?? 'calendario';
  const [refreshKey, setRefreshKey] = useState(0);
  const [openDocument, setOpenDocument] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const status = useLoad(() => reformaApi.status(), [refreshKey]);
  const wasRunning = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchTerm = params.get('q') ?? '';

  // documento escolhido na busca global: abre o modal e limpa o estado da rota
  useEffect(() => {
    if (!isOpenDocumentState(location.state)) return;
    setOpenDocument(location.state.openDocument);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  const running = Boolean(status.data?.running);

  // enquanto sincroniza, acompanha o andamento; ao terminar, atualiza as abas e avisa o resultado
  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      const timer = window.setTimeout(() => status.reload(), POLL_MS);
      return () => window.clearTimeout(timer);
    }
    if (wasRunning.current && status.data?.lastRun) {
      wasRunning.current = false;
      const run = status.data.lastRun;
      setNotice({
        tone: run.status === 'success' ? 'success' : run.status === 'failed' ? 'error' : 'warning',
        text: `${RUN_STATUS[run.status].label}: ${runOutcome(run)}.`,
      });
      setRefreshKey((n) => n + 1);
    }
    return undefined;
  }, [running, status]);

  async function start() {
    setNotice(null);
    try {
      await reformaApi.startRun();
      wasRunning.current = true;
      status.reload();
    } catch (error) {
      setNotice({ tone: 'warning', text: errorMessage(error) });
    }
  }

  if (status.error && !status.data) return <ErrorState message={status.error} onRetry={status.reload} />;
  if (!status.data) return <LoadingState rows={4} />;
  const data = status.data;
  const lastTone = data.running ? tones.info.solid : data.lastRun ? tones[RUN_STATUS[data.lastRun.status].tone].solid : tones.neutral.solid;
  const sourceName = (id: string) => data.sources.find((s) => s.id === id)?.name ?? id;

  return (
    <Page
      title="Calendário"
      description="Obrigatoriedades, prazos e início de vigência de legislações e alterações, com a data tirada do ato oficial."
      icon={<CalendarOutlined />}
      actions={
        <>
          <LastSync $color={lastTone}>{lastSyncText(data)}</LastSync>
          <Button type="primary" icon={<SyncOutlined spin={running} />} disabled={running} onClick={() => void start()}>
            {running ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        </>
      }
    >
      {notice && <Alert type={notice.tone} showIcon closable onClose={() => setNotice(null)} message={notice.text} role="status" />}
      <div>
        <Tabs
          activeKey={tab}
          onChange={(key) => setParams(key === 'calendario' ? {} : { aba: key })}
          items={TABS.map(({ key, label }) => ({
            key,
            label: key === 'documentos' ? `${label} (${data.totals.documents})` : key === 'calendario' ? `${label} (${data.events.upcoming} a seguir)` : label,
          }))}
        />
        {tab === 'calendario' && <CalendarView status={data} refreshKey={refreshKey} onOpenDocument={setOpenDocument} />}
        {tab === 'documentos' && <DocumentsView key={searchTerm} initialSearch={searchTerm} status={data} refreshKey={refreshKey} onOpen={setOpenDocument} />}
        {tab === 'fontes' && <SourcesView status={data} refreshKey={refreshKey} />}
      </div>
      <DocumentModal documentId={openDocument} sourceName={sourceName} kindName={(id) => data.kinds[id] ?? id} onClose={() => setOpenDocument(null)} />
    </Page>
  );
}

/** Personal module: only the user in REFORMA_USERS gets past this screen. */
export function ReformaPage() {
  const access = useLoad(() => reformaApi.access(), []);
  if (access.error) return <ErrorState message={access.error} onRetry={access.reload} />;
  if (access.data === undefined) return <LoadingState rows={4} />;
  if (!access.data)
    return (
      <Page title="Calendário" icon={<CalendarOutlined />}>
        <EmptyState icon={<LockOutlined />} title="Acesso restrito">
          Este módulo é de uso pessoal e está liberado apenas para o usuário configurado em REFORMA_USERS.
        </EmptyState>
      </Page>
    );
  return <ReformaContent />;
}
