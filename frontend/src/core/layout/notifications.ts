import type { ReactNode } from 'react';

import { apiRequest } from '@/core/api/client';
import type { IconTone } from '@/theme';

/** One entry of the notification center in the global header. */
export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  /** Date or time shown on the right (already formatted). */
  when?: string;
  /** When the entry appeared (ISO date or date-time): after the last visit it counts as new. */
  at?: string;
  icon: ReactNode;
  tone: IconTone;
  /** Route opened when the entry is clicked. */
  path: string;
}

/** Notifications of one module: all its entries (the header lists the first ones) and a link to see all. */
export interface NotificationGroup {
  key: string;
  label: string;
  items: NotificationItem[];
  seeAllPath?: string;
}

/** Entries shown per group in the panel. */
export const ITEMS_PER_GROUP = 5;

/** Whether the entry appeared after the user last opened the notification center. */
export function isNew(item: NotificationItem, seenAt: string | null): boolean {
  if (!item.at) return false;
  if (!seenAt) return true;
  return Date.parse(item.at.length === 10 ? `${item.at}T00:00:00` : item.at) > Date.parse(seenAt);
}

export function countNew(groups: NotificationGroup[], seenAt: string | null): number {
  return groups.reduce((sum, group) => sum + group.items.filter((item) => isNew(item, seenAt)).length, 0);
}

/** When the user last opened the notification center (kept on the server, per user). */
export const notificationsApi = {
  seen: () => apiRequest<{ seenAt: string | null }>('/api/notifications/seen').then((r) => r.seenAt),
  markSeen: () => apiRequest<{ seenAt: string }>('/api/notifications/seen', { method: 'PUT', body: {} }).then((r) => r.seenAt),
};
