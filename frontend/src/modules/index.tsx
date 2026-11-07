import { FileTextOutlined, ReadOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';

import { intelligenceRoutes } from '@/modules/intelligence/routes';
import { projectsRoutes } from '@/modules/projects/routes';

/**
 * Registry of the system modules: each one adds an item to the side menu and its
 * screens under its own path. A new module is one folder in src/modules and one entry here.
 */
export interface ModuleDefinition {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  routes: RouteObject[];
}

export const MODULES: ModuleDefinition[] = [
  { key: 'projects', label: 'Portal de Projetos', icon: <FileTextOutlined />, path: '/projetos', routes: projectsRoutes },
  { key: 'intelligence', label: 'Inteligência Contábil', icon: <ReadOutlined />, path: '/inteligencia', routes: intelligenceRoutes },
];
