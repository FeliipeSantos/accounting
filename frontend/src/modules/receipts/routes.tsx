import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const receiptsRoutes: RouteObject[] = [lazyRoute('recebimentos', () => import('@/modules/receipts/pages/ReceiptsPage').then((m) => m.ReceiptsPage))];
