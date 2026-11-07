import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';
import { LastLocationRedirect } from '@/modules/intelligence/components/LastLocationRedirect';

export const intelligenceRoutes: RouteObject[] = [
  { path: 'inteligencia', element: <LastLocationRedirect /> },
  lazyRoute('inteligencia/:tab', () => import('@/modules/intelligence/pages/IntelligencePage').then((m) => m.IntelligencePage)),
];
