import { NotificationOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import type { NotificationGroup } from '@/core/layout/notifications';
import { intelligenceApi } from '@/modules/intelligence/api';
import { formatDate, groupSameAct } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication } from '@/modules/intelligence/types';

const REFRESH_MS = 5 * 60 * 1000;
// só as publicações críticas recentes: as antigas já não são aviso
const RECENT_DAYS = 30;

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toGroup(critical: Publication[], from: string): NotificationGroup {
  // o mesmo ato vindo de várias fontes conta uma vez
  const groups = groupSameAct(critical);
  const path = publicationsPath({ relevance: 'critica', from });
  return {
    key: 'intelligence-critical',
    label: 'Publicações',
    seeAllPath: path,
    items: groups.map(({ primary, others }) => ({
      id: primary.id,
      title: primary.title,
      description: others.length ? `Publicação crítica · ${others.length + 1} fontes` : `Publicação crítica · ${primary.actType || 'ato oficial'}`,
      when: primary.publishedAt ? formatDate(primary.publishedAt) : undefined,
      // nova quando chegou depois da última visita à central
      at: [primary, ...others].map((p) => p.collectedAt).sort()[0],
      icon: <NotificationOutlined />,
      tone: 'red',
      path,
    })),
  };
}

/** Critical publications of the last 30 days for the notification center (null while loading). */
export function useCriticalNotifications(): NotificationGroup | null {
  const [group, setGroup] = useState<NotificationGroup | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      const from = daysAgo(RECENT_DAYS);
      return (
        intelligenceApi
          .publications({ relevance: 'critica', from })
          .then((page) => active && setGroup(toGroup(page.items, from)))
          // a central de notificações é só um aviso: falha de rede não interrompe a tela
          .catch(() => undefined)
      );
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return group;
}
