import { CheckCircleOutlined, ClockCircleOutlined, FolderOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { listProjects } from '@/modules/projects/api';
import { deadlineChip, PROJECT_STATUS, type ProjectStatus, projectDeadline, projectStatus } from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';
import type { IconTone } from '@/theme';

const STATUS_ICON: Record<ProjectStatus, { icon: ReactNode; tone: IconTone }> = {
  ongoing: { icon: <ClockCircleOutlined />, tone: 'blue' },
  todo: { icon: <FolderOutlined />, tone: 'orange' },
  done: { icon: <CheckCircleOutlined />, tone: 'green' },
};

// mesmo critério da busca da lista de projetos: "ver todos" mostra exatamente estes resultados
function matches(project: Project, term: string): boolean {
  return project.name.toLowerCase().includes(term);
}

function describe(project: Project, status: ProjectStatus): string {
  const deadline = projectDeadline(project, dayjs());
  const parts = [PROJECT_STATUS[status].label];
  if (deadline.kind === 'overdue' || deadline.kind === 'ontrack') parts.push(`Prazo: ${deadlineChip(deadline)}`);
  return parts.join(' · ');
}

/** Global search inside the Projects module: projects by name (same rule as the project list). */
export const projectsSearch: ModuleSearch = {
  placeholder: 'Buscar projetos...',
  noun: 'projetos',
  everything: 'todos os projetos',
  allResultsPath: (term) => `/projetos?q=${encodeURIComponent(term)}`,
  search: async (term) => {
    const needle = term.toLowerCase();
    const projects = await listProjects();
    return projects
      .filter((project) => matches(project, needle))
      .slice(0, SEARCH_MAX_RESULTS)
      .map((project) => {
        const status = projectStatus(project);
        return {
          id: project.id,
          title: project.name,
          description: describe(project, status),
          ...STATUS_ICON[status],
          path: `/projetos/${encodeURIComponent(project.id)}`,
        };
      });
  },
};
