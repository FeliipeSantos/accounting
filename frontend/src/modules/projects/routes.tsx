import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const projectsRoutes: RouteObject[] = [
  lazyRoute('projetos', () => import('@/modules/projects/pages/ProjectsPage').then((m) => m.ProjectsPage)),
  lazyRoute('projetos/:projectId', () => import('@/modules/projects/pages/ProjectEditorPage').then((m) => m.ProjectEditorPage)),
];
