import { EditOutlined, FolderOpenOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Flex, Result } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { LoadingState, StatusBadge } from '@/core/ui';
import { getProject, saveProject } from '@/modules/projects/api';
import { toggleSubActivity, withProjectProgress } from '@/modules/projects/model';
import { ActivitiesTable } from '@/modules/projects/report/ActivitiesTable';
import { AttentionCards, KanbanBoard } from '@/modules/projects/report/BoardSections';
import { fitPagesForPrint } from '@/modules/projects/report/print';
import { PrintPages } from '@/modules/projects/report/PrintPages';
import { InfoCards, ReportHeader } from '@/modules/projects/report/ReportHeader';
import { MiddleRow, Paper, Viewport } from '@/modules/projects/report/styles';
import { SubActivitiesCard } from '@/modules/projects/report/SubActivitiesCard';
import type { Project } from '@/modules/projects/types';

const serialize = (project: Project | null) => JSON.stringify(project);

export function ProjectEditorPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // "Editar" no card da lista abre o relatório já em modo de edição
  const startEditing = (location.state as { edit?: boolean } | null)?.edit === true;
  const { message } = App.useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [backup, setBackup] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // durante a impressão o relatório é desenhado como texto, sem os controles de edição
  const [printing, setPrinting] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  // última versão gravada no servidor e versão atual, para salvar ao sair da tela
  const savedRef = useRef<string>('null');
  const currentRef = useRef<Project | null>(null);
  currentRef.current = project;

  useEffect(() => {
    let active = true;
    getProject(projectId)
      .then((found) => {
        if (!active) return;
        if (!found) {
          setStatus('missing');
          return;
        }
        const loaded = withProjectProgress(found);
        savedRef.current = serialize(found);
        setProject(loaded);
        setSelectedId(loaded.activities[0]?.id ?? null);
        if (startEditing) {
          setBackup(structuredClone(loaded));
          setEditing(true);
        }
        setStatus('ready');
      })
      .catch((error) => active && !(error instanceof SessionExpiredError) && setStatus('error'));
    return () => {
      active = false;
    };
  }, [projectId, startEditing]);

  const persist = useCallback(
    async (next: Project | null) => {
      if (!next || serialize(next) === savedRef.current) return true;
      try {
        await saveProject(next);
        savedRef.current = serialize(next);
        return true;
      } catch (error) {
        if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(error)}`);
        return false;
      }
    },
    [message],
  );

  // ao sair da tela (menu lateral, voltar do navegador), as alterações são salvas
  useEffect(() => () => void persist(currentRef.current), [persist]);

  function toggleEditing() {
    if (!project) return;
    if (!editing) {
      setBackup(structuredClone(project));
      setEditing(true);
      return;
    }
    setEditing(false);
    setBackup(null);
    void persist(project);
  }

  function cancelEditing() {
    if (backup) setProject(backup);
    setBackup(null);
    setEditing(false);
  }

  function toggleSub(index: number, completed: boolean) {
    if (!project || selectedId === null) return;
    const next = toggleSubActivity(project, selectedId, index, completed);
    setProject(next);
    // fora do modo de edição, marcar uma subatividade já salva
    if (!editing) void persist(next);
  }

  async function backToList() {
    await persist(project);
    navigate('/projetos');
  }

  function print() {
    flushSync(() => setPrinting(true));
    const pages = [paperRef.current, ...Array.from(printRef.current?.querySelectorAll<HTMLElement>('[data-print-page]') ?? [])].filter(
      (page): page is HTMLElement => page !== null,
    );
    const reset = fitPagesForPrint(pages, printRef.current);
    window.print();
    reset();
    setPrinting(false);
  }

  const toList = () => navigate('/projetos');

  if (status === 'loading') {
    return (
      <Page icon={<FolderOpenOutlined />} title="Portal de Projetos" description="Carregando o status report…" onBack={toList} backLabel="Voltar aos projetos">
        <LoadingState rows={8} />
      </Page>
    );
  }
  if (status === 'missing' || status === 'error' || !project) {
    return (
      <Page icon={<FolderOpenOutlined />} title="Portal de Projetos" onBack={toList} backLabel="Voltar aos projetos">
        <Result
          status={status === 'missing' ? '404' : 'error'}
          title={status === 'missing' ? 'Projeto não encontrado' : 'Não foi possível carregar o projeto'}
          extra={<Button onClick={toList}>Voltar aos projetos</Button>}
        />
      </Page>
    );
  }

  const activity = project.activities.find((a) => a.id === selectedId) ?? null;
  const editable = editing && !printing;

  return (
    <Page
      stickyHeader
      title={project.name}
      description={
        <Flex align="center" gap={8} wrap>
          <span>Portal de Projetos · Status report</span>
          {editing && (
            <StatusBadge tone="warning" dot={false}>
              Editando
            </StatusBadge>
          )}
        </Flex>
      }
      onBack={() => void backToList()}
      backLabel="Voltar aos projetos"
      actions={
        <>
          {editing ? (
            <>
              <Button type="text" onClick={cancelEditing} title="Cancelar alterações feitas nesta sessão">
                Cancelar
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={toggleEditing}>
                Salvar
              </Button>
            </>
          ) : (
            <Button icon={<EditOutlined />} onClick={toggleEditing}>
              Editar
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={print} title="Exportar PDF / Imprimir">
            Exportar PDF
          </Button>
        </>
      }
    >
      <Viewport>
        <Paper ref={paperRef}>
          <ReportHeader project={project} editing={editable} onChange={setProject} />
          <InfoCards project={project} editing={editable} onChange={setProject} />
          <MiddleRow>
            <ActivitiesTable project={project} editing={editable} selectedId={selectedId} onSelect={setSelectedId} onChange={setProject} />
            <SubActivitiesCard project={project} activity={activity} editing={editable} onChange={setProject} onToggle={toggleSub} />
          </MiddleRow>
          <AttentionCards project={project} activity={activity} editing={editable} onChange={setProject} />
          <KanbanBoard project={project} editing={editable} onChange={setProject} />
        </Paper>
      </Viewport>
      <PrintPages ref={printRef} project={project} />
    </Page>
  );
}
