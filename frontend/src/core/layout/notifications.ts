import type { ReactNode } from 'react';

import type { IconTone } from '@/theme';

/** One entry of the notification center in the global header. */
export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  /** Date or time shown on the right (already formatted). */
  when?: string;
  icon: ReactNode;
  tone: IconTone;
  /** Route opened when the entry is clicked. */
  path: string;
}

/** Notifications of one module: its entries and a link to see all of them. */
export interface NotificationGroup {
  key: string;
  label: string;
  items: NotificationItem[];
  /** Total of pending items (may be larger than the entries listed). */
  total: number;
  seeAllPath?: string;
}
