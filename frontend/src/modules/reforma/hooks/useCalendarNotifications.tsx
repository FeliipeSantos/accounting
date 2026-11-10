import { AlertOutlined, ClockCircleOutlined, FileAddOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import type { NotificationGroup, NotificationItem } from '@/core/layout/notifications';
import { reformaApi } from '@/modules/reforma/api';
import { eventSubject, formatDate, isoDay, relativeDay } from '@/modules/reforma/format';
import { CALENDAR_PATH } from '@/modules/reforma/search';
import type { CalendarEvent, RecurringReview } from '@/modules/reforma/types';

const REFRESH_MS = 5 * 60 * 1000;
// prazos que vencem nos próximos 7 dias e obrigatoriedades publicadas nos últimos 7
const WINDOW_DAYS = 7;
const PANEL_PATH = `${CALENDAR_PATH}?aba=painel`;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + days));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function reviewItems(reviews: RecurringReview[]): NotificationItem[] {
  return reviews.map((review) => ({
    id: `review-${review.ruleId}`,
    title: `Pode ter mudado: ${review.title}`,
    description: `Ato novo: ${review.acts[0].title}`,
    when: formatDate(review.acts[0].date),
    at: review.acts[0].date,
    icon: <AlertOutlined />,
    tone: 'red',
    path: `${CALENDAR_PATH}?aba=fontes`,
  }));
}

function newObligationItems(events: CalendarEvent[], today: string): NotificationItem[] {
  return events
    .filter((event) => event.kind === 'obrigatoriedade')
    .map((event) => ({
      id: `new-${event.id}`,
      title: `Nova obrigatoriedade: ${eventSubject(event.title)}`,
      description: `A partir de ${formatDate(event.date)} · publicada ${relativeDay(event.publishedAt ?? today, today)}`,
      when: event.publishedAt ? formatDate(event.publishedAt) : undefined,
      at: event.publishedAt,
      icon: <FileAddOutlined />,
      tone: 'orange',
      path: PANEL_PATH,
    }));
}

function upcomingItems(events: CalendarEvent[], today: string): NotificationItem[] {
  return events.map((event) => ({
    id: `due-${event.id}`,
    title: eventSubject(event.title),
    description: `${capitalize(relativeDay(event.date, today))} · ${event.kind === 'obrigatoriedade' ? 'Obrigatoriedade' : 'Prazo'}`,
    when: formatDate(event.date),
    // entra como nova quando o prazo chega a 7 dias
    at: addDays(event.date, -WINDOW_DAYS),
    icon: <ClockCircleOutlined />,
    tone: event.kind === 'obrigatoriedade' ? 'orange' : 'green',
    path: PANEL_PATH,
  }));
}

/** Calendário alerts for the notification center: rules that may have changed, obligations
 * published this week and deadlines of the next 7 days (null while loading). */
export function useCalendarNotifications(): NotificationGroup | null {
  const [group, setGroup] = useState<NotificationGroup | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const today = isoDay(new Date());
        const [status, due, published] = await Promise.all([
          reformaApi.status(),
          reformaApi.events(today, addDays(today, WINDOW_DAYS - 1)),
          reformaApi.events(addDays(today, -(WINDOW_DAYS - 1)), today, { kind: 'obrigatoriedade' }, true),
        ]);
        if (!active) return;
        setGroup({
          key: 'calendar',
          label: 'Calendário',
          seeAllPath: PANEL_PATH,
          items: [
            ...reviewItems(status.recurringReviews),
            ...newObligationItems(published, today),
            ...upcomingItems(
              due.filter((e) => e.kind === 'prazo' || e.kind === 'obrigatoriedade'),
              today,
            ),
          ],
        });
      } catch {
        // a central de notificações é só um aviso: falha de rede não interrompe a tela
      }
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
