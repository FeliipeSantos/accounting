import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

/** Route of the settings screen (opened by the gear in the global header, not by the module navigation). */
export const SETTINGS_PATH = '/ajustes';

export const settingsRoutes: RouteObject[] = [lazyRoute('ajustes', () => import('@/core/settings/SettingsPage').then((m) => m.SettingsPage))];
