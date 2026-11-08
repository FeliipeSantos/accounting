import { describe, expect, it } from 'vitest';

import { countNew, isNew, type NotificationGroup } from '@/core/layout/notifications';

const item = (at?: string) => ({ id: at ?? 'x', title: 't', icon: null, tone: 'blue' as const, path: '/', at });

describe('notificações novas', () => {
  it('conta como nova o que apareceu depois da última visita', () => {
    expect(isNew(item('2026-11-08T15:00:00.000Z'), '2026-11-08T14:00:00.000Z')).toBe(true);
    expect(isNew(item('2026-11-08T13:00:00.000Z'), '2026-11-08T14:00:00.000Z')).toBe(false);
    // data sem hora: vale o começo do dia
    expect(isNew(item('2026-11-09'), '2026-11-08T14:00:00.000Z')).toBe(true);
    // sem visita anterior, tudo é novo; sem data, nunca
    expect(isNew(item('2020-01-01'), null)).toBe(true);
    expect(isNew(item(), null)).toBe(false);
  });

  it('soma as novas de todos os grupos', () => {
    const groups: NotificationGroup[] = [
      { key: 'a', label: 'A', items: [item('2026-11-08T15:00:00.000Z'), item('2026-11-01')] },
      { key: 'b', label: 'B', items: [item('2026-11-10')] },
    ];
    expect(countNew(groups, '2026-11-08T14:00:00.000Z')).toBe(2);
  });
});
