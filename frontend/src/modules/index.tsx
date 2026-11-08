import { AuditOutlined, CalendarOutlined, FileTextOutlined, ReadOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';

import type { ModuleSearch } from '@/core/layout/search';

import { intelligenceRoutes } from '@/modules/intelligence/routes';
import { PUBLICATIONS_BASE } from '@/modules/intelligence/paths';
import { intelligenceSearch } from '@/modules/intelligence/search';
import { projectsRoutes } from '@/modules/projects/routes';
import { projectsSearch } from '@/modules/projects/search';
import { reformaApi } from '@/modules/reforma/api';
import { reformaRoutes } from '@/modules/reforma/routes';
import { CALENDAR_PATH, reformaSearch } from '@/modules/reforma/search';

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
  /** Global header search, scoped to this module while it is open. */
  search?: ModuleSearch;
  /** Restricted module: shown in the menu only when this resolves to true for the session user. */
  checkAccess?: () => Promise<boolean>;
  /** Key of the side menu group that holds this module (MODULE_GROUPS). */
  group?: string;
}

/** Groups of the side menu: a group opens to show its modules. */
export interface ModuleGroup {
  key: string;
  label: string;
  icon: ReactNode;
}

export const MODULE_GROUPS: ModuleGroup[] = [{ key: 'inteligencia-contabil', label: 'Inteligência Contábil', icon: <AuditOutlined /> }];

export const MODULES: ModuleDefinition[] = [
  { key: 'projects', label: 'Portal de Projetos', icon: <FileTextOutlined />, path: '/projetos', routes: projectsRoutes, search: projectsSearch },
  {
    key: 'intelligence',
    label: 'Publicações',
    icon: <ReadOutlined />,
    path: PUBLICATIONS_BASE,
    routes: intelligenceRoutes,
    search: intelligenceSearch,
    group: 'inteligencia-contabil',
  },
  {
    key: 'reforma',
    label: 'Calendário',
    icon: <CalendarOutlined />,
    path: CALENDAR_PATH,
    routes: reformaRoutes,
    search: reformaSearch,
    checkAccess: reformaApi.access,
    group: 'inteligencia-contabil',
  },
];
