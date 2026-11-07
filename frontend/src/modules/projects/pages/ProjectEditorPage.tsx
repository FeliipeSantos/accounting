import { CloseOutlined, EditOutlined, FolderOpenOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Flex, Result, Skeleton, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
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
import { colors, shadows } from '@/theme';

const Toolbar = styled(Flex)`
  background-color: ${colors.navy};
  padding: 12px 24px;
  box-shadow: ${shadows.sm};
  position: sticky;
  top: 0;
  z-index: 100;
`;

const ToolbarTitle = styled(Typography.Text)`
  &&& {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
  }
`;

const serialize = (project: Project | null) => JSON.stringify(project);

export function ProjectEditorPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [backup, setBackup] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
        setStatus('ready');
      })
      .catch((error) => active && !(error instanceof SessionExpiredError) && setStatus('error'));
    return () => {
      active = false;
    };
  }, [projectId]);

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
    const pages = [paperRef.current, ...Array.from(printRef.current?.querySelectorAll<HTMLElement>('[data-print-page]') ?? [])].filter(
      (page): page is HTMLElement => page !== null,
    );
    const reset = fitPagesForPrint(pages, printRef.current);
    window.print();
    reset();
  }

  if (status === 'loading') return <Skeleton active />;
  if (status === 'missing' || status === 'error' || !project) {
    return (
      <Result
        status={status === 'missing' ? '404' : 'error'}
        title={status === 'missing' ? 'Projeto não encontrado' : 'Não foi possível carregar o projeto'}
        extra={<Button onClick={() => navigate('/projetos')}>Voltar aos projetos</Button>}
      />
    );
  }

  const activity = project.activities.find((a) => a.id === selectedId) ?? null;

  return (
    <>
      <Toolbar justify="space-between" align="center" wrap gap={12} data-print-hide>
        <ToolbarTitle>Gerenciador de Projetos</ToolbarTitle>
        <Flex gap={10} wrap>
          <Button ghost icon={<FolderOpenOutlined />} onClick={() => void backToList()}>
            Projetos
          </Button>
          <Button type={editing ? 'primary' : 'default'} ghost={!editing} icon={editing ? <SaveOutlined /> : <EditOutlined />} onClick={toggleEditing}>
            {editing ? 'Salvar' : 'Editar'}
          </Button>
          {editing && (
            <Button ghost danger icon={<CloseOutlined />} onClick={cancelEditing} title="Cancelar alterações feitas nesta sessão">
              Cancelar
            </Button>
          )}
          <Button ghost icon={<PrinterOutlined />} onClick={print} aria-label="Exportar PDF / Imprimir" title="Exportar PDF / Imprimir" />
        </Flex>
      </Toolbar>

      <Viewport>
        <Paper ref={paperRef}>
          <ReportHeader project={project} editing={editing} onChange={setProject} />
          <InfoCards project={project} editing={editing} onChange={setProject} />
          <MiddleRow>
            <ActivitiesTable project={project} editing={editing} selectedId={selectedId} onSelect={setSelectedId} onChange={setProject} />
            <SubActivitiesCard project={project} activity={activity} editing={editing} onChange={setProject} onToggle={toggleSub} />
          </MiddleRow>
          <AttentionCards project={project} activity={activity} editing={editing} onChange={setProject} />
          <KanbanBoard project={project} editing={editing} onChange={setProject} />
        </Paper>
      </Viewport>
      <PrintPages ref={printRef} project={project} />
    </>
  );
}
