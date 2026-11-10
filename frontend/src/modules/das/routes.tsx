import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const dasRoutes: RouteObject[] = [lazyRoute('das', () => import('@/modules/das/pages/DasPage').then((m) => m.DasPage))];
