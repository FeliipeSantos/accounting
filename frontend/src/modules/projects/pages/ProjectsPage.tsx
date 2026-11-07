import { FileTextOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, App, Button, Col, Empty, Input, Row, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { Page } from '@/core/layout/Page';
import { deleteProject, listProjects, saveProject } from '@/modules/projects/api';
import { NewProjectModal } from '@/modules/projects/components/NewProjectModal';
import { ProjectCard } from '@/modules/projects/components/ProjectCard';
import { newProject } from '@/modules/projects/model';
import type { Project } from '@/modules/projects/types';
import { shadows } from '@/theme';

const SearchInput = styled(Input)`
  margin-bottom: 24px;
  box-shadow: ${shadows.sm};
`;

export function ProjectsPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchLimit = useCharLimit('projectSearch');

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

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (projects ?? []).filter((p) => p.name.toLowerCase().includes(term));
  }, [projects, search]);

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
    modal.confirm({
      title: 'Excluir projeto',
      content: `Deseja realmente excluir permanentemente o projeto "${project.name}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await deleteProject(project.id);
          // sai da tela só depois que o servidor confirmar a exclusão
          setProjects((list) => (list ?? []).filter((p) => p.id !== project.id));
        } catch (error) {
          if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível excluir: ${errorMessage(error)}`);
        }
      },
    });
  }

  return (
    <Page
      icon={<FileTextOutlined />}
      title="Portal de Projetos"
      subtitle="Selecione um projeto para detalhar ou crie um novo relatório"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)} disabled={loadError}>
          Novo Projeto
        </Button>
      }
    >
      <SearchInput
        size="large"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Pesquisar projeto pelo nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        {...searchLimit}
      />

      {projects === null && <Skeleton active />}
      {loadError && <Alert type="error" showIcon message="Não foi possível carregar os projetos do servidor. Recarregue a página em instantes." />}
      {projects !== null && !loadError && filtered.length === 0 && (
        <Empty description='Nenhum projeto encontrado. Clique em "Novo Projeto" para criar um!' />
      )}
      <Row gutter={[24, 24]}>
        {filtered.map((project) => (
          <Col key={project.id} xs={24} md={12} xl={8}>
            <ProjectCard
              project={project}
              onOpen={() => navigate(`/projetos/${encodeURIComponent(project.id)}`)}
              onDelete={() => confirmDelete(project)}
            />
          </Col>
        ))}
      </Row>

      <NewProjectModal open={creating} saving={saving} onCreate={create} onCancel={() => setCreating(false)} />
    </Page>
  );
}
