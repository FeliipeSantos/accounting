import { NotificationOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import type { NotificationGroup } from '@/core/layout/notifications';
import { intelligenceApi } from '@/modules/intelligence/api';
import { formatDate, groupSameAct } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication } from '@/modules/intelligence/types';

const REFRESH_MS = 5 * 60 * 1000;
const MAX_ITEMS = 5;

function toGroup(critical: Publication[], total: number): NotificationGroup {
  const groups = groupSameAct(critical);
  return {
    key: 'intelligence-critical',
    label: 'Inteligência Contábil',
    total,
    seeAllPath: publicationsPath({ relevance: 'critica' }),
    items: groups.slice(0, MAX_ITEMS).map(({ primary, others }) => ({
      id: primary.id,
      title: primary.title,
      description: others.length ? `Publicação crítica · ${others.length + 1} fontes` : `Publicação crítica · ${primary.actType || 'ato oficial'}`,
      when: primary.publishedAt ? formatDate(primary.publishedAt) : undefined,
      icon: <NotificationOutlined />,
      tone: 'red',
      path: publicationsPath({ relevance: 'critica' }),
    })),
  };
}

/** Critical publications for the notification center (null while loading). */
export function useCriticalNotifications(): NotificationGroup | null {
  const [group, setGroup] = useState<NotificationGroup | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      intelligenceApi
        .publications({ relevance: 'critica' })
        .then((page) => active && setGroup(toGroup(page.items, page.total)))
        // a central de notificações é só um aviso: falha de rede não interrompe a tela
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return group;
}
