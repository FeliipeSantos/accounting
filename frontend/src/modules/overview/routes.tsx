import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

/** Home page of the application: "/" opens here (the first module of the registry). */
export const OVERVIEW_PATH = '/visao-geral';

export const overviewRoutes: RouteObject[] = [lazyRoute('visao-geral', () => import('@/modules/overview/pages/OverviewPage').then((m) => m.OverviewPage))];
