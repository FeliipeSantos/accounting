import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';
import { LegacyRedirect } from '@/modules/reforma/components/LegacyRedirect';
import { CALENDAR_PATH } from '@/modules/reforma/search';

export const reformaRoutes: RouteObject[] = [
  lazyRoute(CALENDAR_PATH.slice(1), () => import('@/modules/reforma/pages/ReformaPage').then((m) => m.ReformaPage)),
  // endereço antigo
  { path: 'reforma', element: <LegacyRedirect /> },
];
