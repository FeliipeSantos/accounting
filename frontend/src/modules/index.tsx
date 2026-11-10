import { AppstoreOutlined, AuditOutlined, CalendarOutlined, FileDoneOutlined, FileTextOutlined, ReadOutlined, SolutionOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';

import type { ModuleSearch } from '@/core/layout/search';

import { CLIENTS_PATH } from '@/modules/clients/format';
import { clientsRoutes } from '@/modules/clients/routes';
import { clientsSearch } from '@/modules/clients/search';
import { DAS_PATH } from '@/modules/das/format';
import { dasRoutes } from '@/modules/das/routes';
import { dasSearch } from '@/modules/das/search';
import { intelligenceRoutes } from '@/modules/intelligence/routes';
import { PUBLICATIONS_BASE } from '@/modules/intelligence/paths';
import { intelligenceSearch } from '@/modules/intelligence/search';
import { OVERVIEW_PATH, overviewRoutes } from '@/modules/overview/routes';
import { projectsRoutes } from '@/modules/projects/routes';
import { projectsSearch } from '@/modules/projects/search';
import { RECEIPTS_PATH } from '@/modules/receipts/format';
import { receiptsRoutes } from '@/modules/receipts/routes';
import { receiptsSearch } from '@/modules/receipts/search';
import { reformaApi } from '@/modules/reforma/api';
import { reformaRoutes } from '@/modules/reforma/routes';
import { CALENDAR_PATH, reformaSearch } from '@/modules/reforma/search';

/**
 * Registry of the system modules: each one adds an item to the top navigation and its
 * screens under its own path. A new module is one folder in src/modules and one entry here.
 */
export interface ModuleDefinition {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  routes: RouteObject[];
  /** Search of the module (not shown for now: the header search was removed; each module will place its own). */
  search?: ModuleSearch;
  /** Restricted module: shown in the menu only when this resolves to true for the session user. */
  checkAccess?: () => Promise<boolean>;
  /** Key of the navigation group that holds this module (MODULE_GROUPS). */
  group?: string;
}

/** Groups of the navigation: a group opens a menu with its modules. */
export interface ModuleGroup {
  key: string;
  label: string;
  icon: ReactNode;
}

export const MODULE_GROUPS: ModuleGroup[] = [
  { key: 'inteligencia-contabil', label: 'Inteligência Contábil', icon: <AuditOutlined /> },
  { key: 'gestao-contabil', label: 'Gestão Contábil', icon: <SolutionOutlined /> },
];

export const MODULES: ModuleDefinition[] = [
  // primeiro módulo: é a página inicial ("/" abre aqui); a ordem daqui é a ordem da navegação
  { key: 'overview', label: 'Visão Geral', icon: <AppstoreOutlined />, path: OVERVIEW_PATH, routes: overviewRoutes },
  { key: 'clients', label: 'Clientes', icon: <TeamOutlined />, path: CLIENTS_PATH, routes: clientsRoutes, search: clientsSearch, group: 'gestao-contabil' },
  {
    key: 'receipts',
    label: 'Recebimentos',
    icon: <WalletOutlined />,
    path: RECEIPTS_PATH,
    routes: receiptsRoutes,
    search: receiptsSearch,
    group: 'gestao-contabil',
  },
  { key: 'das', label: 'Geração de DAS', icon: <FileDoneOutlined />, path: DAS_PATH, routes: dasRoutes, search: dasSearch, group: 'gestao-contabil' },
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
  { key: 'projects', label: 'Portal de Projetos', icon: <FileTextOutlined />, path: '/projetos', routes: projectsRoutes, search: projectsSearch },
];
