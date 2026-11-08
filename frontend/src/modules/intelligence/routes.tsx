import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';
import { LastLocationRedirect, LegacyTabRedirect } from '@/modules/intelligence/components/LastLocationRedirect';

export const intelligenceRoutes: RouteObject[] = [
  { path: 'inteligencia-contabil', element: <LastLocationRedirect /> },
  { path: 'inteligencia-contabil/publicacoes', element: <LastLocationRedirect /> },
  lazyRoute('inteligencia-contabil/publicacoes/:tab', () => import('@/modules/intelligence/pages/IntelligencePage').then((m) => m.IntelligencePage)),
  // endereços antigos
  { path: 'inteligencia', element: <LegacyTabRedirect /> },
  { path: 'inteligencia/:tab', element: <LegacyTabRedirect /> },
];
