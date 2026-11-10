import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { describe, expect, it } from 'vitest';

import { defaultPeriod, formatBarcodeLine, formatDay, isOverdue, periodLabel, shiftPeriod } from '@/modules/das/format';

dayjs.locale('pt-br');

describe('competência', () => {
  it('defaults to the previous month, whose DAS is due now', () => {
    expect(defaultPeriod(dayjs('2026-11-09'))).toBe('2026-10');
    expect(defaultPeriod(dayjs('2027-01-05'))).toBe('2026-12');
  });

  it('moves across years and has a readable label', () => {
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(periodLabel('2026-10')).toBe('outubro/2026');
  });
});

describe('situação', () => {
  it('is overdue only when not paid after the due date', () => {
    expect(isOverdue({ status: 'pendente' }, '2026-11-23', dayjs('2026-11-23'))).toBe(false);
    expect(isOverdue({ status: 'gerada' }, '2026-11-23', dayjs('2026-11-24'))).toBe(true);
    expect(isOverdue({ status: 'paga' }, '2026-11-23', dayjs('2026-12-01'))).toBe(false);
  });

  it('formats the payment line in its 4 blocks', () => {
    expect(formatBarcodeLine('858000000000781050328202603282026103100000000006')).toBe('85800000000-0 78105032820-2 60328202610-3 10000000000-6');
  });

  it('formats dates', () => {
    expect(formatDay('2026-11-23')).toBe('23/11/2026');
    expect(formatDay(null)).toBe('—');
  });
});
