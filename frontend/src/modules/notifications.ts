import type { NotificationGroup } from '@/core/layout/notifications';
import { useCriticalNotifications } from '@/modules/intelligence/hooks/useCriticalNotifications';

/**
 * Notifications of every module for the global header. A module that raises alerts
 * adds its hook here; the header shows the groups in this order.
 */
export function useModuleNotifications(): NotificationGroup[] {
  const critical = useCriticalNotifications();
  return [critical].filter((group): group is NotificationGroup => group !== null);
}
