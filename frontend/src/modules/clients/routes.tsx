import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const clientsRoutes: RouteObject[] = [lazyRoute('clientes', () => import('@/modules/clients/pages/ClientsPage').then((m) => m.ClientsPage))];
