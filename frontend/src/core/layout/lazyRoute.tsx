import { type ComponentType, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

import { PageLoading } from '@/core/layout/PageLoading';

/**
 * Route whose screen is downloaded only when opened (smaller first load).
 * Usage: lazyRoute('projetos', () => import('./pages/ProjectsPage').then((m) => m.ProjectsPage))
 */
export function lazyRoute(path: string, load: () => Promise<ComponentType>): RouteObject {
  const Screen = lazy(() => load().then((component) => ({ default: component })));
  return {
    path,
    element: (
      <Suspense fallback={<PageLoading />}>
        <Screen />
      </Suspense>
    ),
  };
}
