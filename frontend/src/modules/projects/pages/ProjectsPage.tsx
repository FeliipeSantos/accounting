import { CheckCircleFilled, ClockCircleOutlined, FilterOutlined, FlagOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Alert, App, Badge, Button, Dropdown, Flex, Segmented, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { LoadingState, SectionCard, StatCard } from '@/core/ui';
import { deleteProject, listProjects, saveProject } from '@/modules/projects/api';
import { NewProjectModal } from '@/modules/projects/components/NewProjectModal';
import { ProjectsTable } from '@/modules/projects/components/ProjectsTable';
import { UpcomingDeadlines } from '@/modules/projects/components/UpcomingDeadlines';
import { newProject } from '@/modules/projects/model';
import { type ProjectSort, type ProjectStatus, projectDeadline, projectStatus, sortProjects, upcomingDeadlines } from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';
import { colors } from '@/theme';

type StatusFilter = 'all' | ProjectStatus;

// quatro indicadores do mesmo tamanho, como no layout de referência
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const NewButton = styled(Button)`
  &&& {
    height: 44px;
    padding-inline: 22px;
    box-shadow: 0 8px 18px -8px rgba(30, 107, 230, 0.6);
  }
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

// link do cabeçalho do card sem o recuo do botão: alinha com o título na mesma linha
const CardLink = styled(Button)`
  &&& {
    padding: 0;
    height: auto;
    font-size: 13px;
    font-weight: 600;
  }
`;

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: ${colors.navy};
`;

const SORT_LABELS: Record<ProjectSort, string> = {
  position: 'Ordem salva',
  deadline: 'Prazo final',
  progress: 'Progresso',
  name: 'Nome',
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // a busca vem do campo do cabeçalho global ("Ver todos os projetos" abre esta lista com ?q=)
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [status, setStatus] = useState<StatusFilter>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<ProjectSort>('position');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = useMemo(() => dayjs(), []);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((list) => active && setProjects(list))
      .catch((error) => {
        if (!active || error instanceof SessionExpiredError) return;
        setLoadError(true);
        setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => projects ?? [], [projects]);

  const counts = useMemo(() => {
    const result = { all: list.length, ongoing: 0, todo: 0, done: 0, overdue: 0 };
    list.forEach((project) => {
      result[projectStatus(project)] += 1;
      if (projectDeadline(project, today).kind === 'overdue') result.overdue += 1;
    });
    return result;
  }, [list, today]);

  const visible = useMemo(() => {
    const term = search.toLowerCase().trim();
    const filtered = list.filter(
      (project) =>
        project.name.toLowerCase().includes(term) &&
        (status === 'all' || projectStatus(project) === status) &&
        (!overdueOnly || projectDeadline(project, today).kind === 'overdue'),
    );
    return sortProjects(filtered, sort);
  }, [list, search, status, overdueOnly, sort, today]);

  const deadlines = useMemo(() => upcomingDeadlines(list, today), [list, today]);

  async function create(name: string) {
    const project = newProject(name);
    setSaving(true);
    try {
      await saveProject(project);
      setCreating(false);
      navigate(`/projetos/${encodeURIComponent(project.id)}`);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(project: Project) {
    const activities = project.activities.length;
    modal.confirm({
      title: 'Excluir projeto',
      content: `O projeto "${project.name}"${activities ? ` e as ${activities} atividades` : ''} serão excluídos. Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await deleteProject(project.id);
          // sai da tela só depois que o servidor confirmar a exclusão
          setProjects((current) => (current ?? []).filter((p) => p.id !== project.id));
          message.success('Projeto excluído');
        } catch (error) {
          if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível excluir: ${errorMessage(error)}`);
        }
      },
    });
  }

  function clearSearch() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('q');
      return next;
    });
  }

  const open = (project: Project, edit = false) => navigate(`/projetos/${encodeURIComponent(project.id)}`, { state: edit ? { edit: true } : undefined });
  const activeFilters = (overdueOnly ? 1 : 0) + (sort !== 'position' ? 1 : 0);
  const filtering = search.trim() !== '' || status !== 'all' || overdueOnly;

  return (
    <Page
      icon={<FolderOpenOutlined />}
      title="Portal de Projetos"
      description="Acompanhe o andamento dos seus projetos e mantenha tudo organizado."
      actions={
        <NewButton type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreating(true)} disabled={loadError}>
          Novo Projeto
        </NewButton>
      }
    >
      {loadError && <Alert type="error" showIcon message="Não foi possível carregar os projetos do servidor. Recarregue a página em instantes." />}

      <StatsRow>
        <StatCard
          icon={<FolderOutlined />}
          iconTone="blue"
          label="Total de Projetos"
          value={projects ? counts.all : '—'}
          hint={counts.overdue ? `${counts.overdue} com prazo vencido` : undefined}
          onClick={() => setStatus('all')}
          ariaLabel="Mostrar todos os projetos"
        />
        <StatCard
          icon={<CheckCircleFilled />}
          iconTone="green"
          label="Em Andamento"
          value={projects ? counts.ongoing : '—'}
          onClick={() => setStatus('ongoing')}
          ariaLabel="Mostrar projetos em andamento"
        />
        <StatCard
          icon={<ClockCircleOutlined />}
          iconTone="orange"
          label="Não iniciados"
          value={projects ? counts.todo : '—'}
          onClick={() => setStatus('todo')}
          ariaLabel="Mostrar projetos não iniciados"
        />
        <StatCard icon={<FlagOutlined />} iconTone="purple" label="Concluídos" value={projects ? counts.done : '—'} onClick={() => setStatus('done')} ariaLabel="Mostrar projetos concluídos" />
      </StatsRow>

      <Columns>
        <SectionCard
          title={
            <CardTitle>
              <UnorderedListOutlined /> Meus Projetos
            </CardTitle>
          }
          extra={
            <Flex gap={10} align="center" wrap>
              {search.trim() && (
                <Tag icon={<SearchOutlined />} closable onClose={clearSearch} aria-label={`Busca por ${search}. Remover busca`}>
                  “{search.trim()}”
                </Tag>
              )}
              <Segmented<StatusFilter>
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'ongoing', label: 'Em Andamento' },
                  { value: 'todo', label: 'Não iniciados' },
                  { value: 'done', label: 'Concluídos' },
                ]}
              />
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  selectable: true,
                  multiple: true,
                  selectedKeys: [...(overdueOnly ? ['overdue'] : []), `sort:${sort}`],
                  items: [
                    { key: 'overdue', label: `Somente prazo vencido (${counts.overdue})` },
                    { type: 'divider' },
                    {
                      type: 'group',
                      label: 'Ordenar por',
                      children: (Object.keys(SORT_LABELS) as ProjectSort[]).map((key) => ({ key: `sort:${key}`, label: SORT_LABELS[key] })),
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'overdue') setOverdueOnly((v) => !v);
                    else setSort(key.replace('sort:', '') as ProjectSort);
                  },
                }}
              >
                <Badge count={activeFilters} size="small">
                  <Button icon={<FilterOutlined />}>Filtros</Button>
                </Badge>
              </Dropdown>
            </Flex>
          }
          flush
        >
          {projects === null ? (
            <LoadingState rows={5} />
          ) : (
            <ProjectsTable
              projects={visible}
              today={today}
              onOpen={(p) => open(p)}
              onEdit={(p) => open(p, true)}
              onDelete={confirmDelete}
              emptyText={filtering ? 'Nenhum projeto corresponde à busca e aos filtros.' : 'Nenhum projeto ainda. Clique em "Novo Projeto" para criar o primeiro.'}
            />
          )}
        </SectionCard>

        <SectionCard
          title={
            <CardTitle>
              <ClockCircleOutlined /> Próximos Prazos
            </CardTitle>
          }
          extra={
            deadlines.length > 0 && (
              <CardLink type="link" onClick={() => setSort('deadline')}>
                Ordenar por prazo →
              </CardLink>
            )
          }
        >
          {projects === null ? <LoadingState rows={3} /> : <UpcomingDeadlines items={deadlines} onOpen={(p) => open(p)} />}
        </SectionCard>
      </Columns>

      <NewProjectModal open={creating} saving={saving} onCreate={create} onCancel={() => setCreating(false)} />
    </Page>
  );
}
