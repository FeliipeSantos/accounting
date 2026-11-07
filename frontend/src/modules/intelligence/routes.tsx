import { Navigate, type RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const intelligenceRoutes: RouteObject[] = [
  { path: 'inteligencia', element: <Navigate to="/inteligencia/painel" replace /> },
  lazyRoute('inteligencia/:tab', () => import('@/modules/intelligence/pages/IntelligencePage').then((m) => m.IntelligencePage)),
];
