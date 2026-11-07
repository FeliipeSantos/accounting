import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { describe, expect, it } from 'vitest';

import { newProject } from '@/modules/projects/model';
import {
  activityBreakdown,
  deadlineChip,
  elapsedPercent,
  formatPercent,
  matchesDeadline,
  projectDeadline,
  projectStatus,
  sortProjects,
  upcomingDeadlines,
} from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';

dayjs.extend(customParseFormat);

const TODAY = dayjs('2026-11-07');

function project(fields: Partial<Project>): Project {
  return { ...newProject('Teste', dayjs('2026-06-08')), ...fields };
}

describe('projectDeadline', () => {
  it('flags a project past its end date', () => {
    const deadline = projectDeadline(project({ startDate: '08/06/2026', endDate: '30/09/2026' }), TODAY);
    expect(deadline).toMatchObject({ kind: 'overdue', days: 38, tone: 'danger', label: 'Prazo vencido há 38 dias' });
  });

  it('counts the days left and warns in the last week', () => {
    expect(projectDeadline(project({ endDate: '30/11/2026' }), TODAY)).toMatchObject({ kind: 'ontrack', days: 23, tone: 'info' });
    expect(projectDeadline(project({ endDate: '10/11/2026' }), TODAY)).toMatchObject({ kind: 'ontrack', days: 3, tone: 'warning' });
    expect(projectDeadline(project({ endDate: '08/11/2026' }), TODAY).label).toBe('1 dia restante');
  });

  it('handles projects without an end date', () => {
    expect(projectDeadline(project({ endDate: '' }), TODAY).kind).toBe('nodate');
  });

  it('treats a fully completed project as done, even after the end date', () => {
    const base = project({ endDate: '30/09/2026' });
    const done = { ...base, activities: base.activities.map((a) => ({ ...a, progress: 100, status: 'Concluído' })) };
    expect(projectDeadline(done, TODAY).kind).toBe('done');
  });
});

describe('elapsedPercent', () => {
  it('is capped at 100 after the end date and null without dates', () => {
    expect(elapsedPercent(project({ startDate: '08/06/2026', endDate: '30/09/2026' }), TODAY)).toBe(100);
    expect(elapsedPercent(project({ startDate: '01/11/2026', endDate: '11/11/2026' }), TODAY)).toBe(60);
    expect(elapsedPercent(project({ startDate: '', endDate: '30/09/2026' }), TODAY)).toBeNull();
  });
});

describe('activityBreakdown', () => {
  it('counts activities by status and completed sub-activities', () => {
    const base = project({});
    const [first] = base.activities;
    const p: Project = {
      ...base,
      activities: [
        { ...first, id: 1, status: 'Concluído', subActivities: [{ id: 1, name: 'a', completed: true }] },
        { ...first, id: 2, status: 'Em andamento', subActivities: [{ id: 1, name: 'b', completed: false }] },
        { ...first, id: 3, status: 'Não iniciado', subActivities: [] },
      ],
    };
    expect(activityBreakdown(p)).toEqual({ done: 1, ongoing: 1, delayed: 0, todo: 1, total: 3, subDone: 1, subTotal: 2 });
  });
});

describe('filters and sorting', () => {
  it('groups projects without an end date under "no prazo"', () => {
    expect(matchesDeadline({ kind: 'nodate', days: 0, label: '', tone: 'neutral' }, 'ontrack')).toBe(true);
    expect(matchesDeadline({ kind: 'overdue', days: 1, label: '', tone: 'danger' }, 'ontrack')).toBe(false);
  });

  it('sorts by end date, keeping projects without a date last', () => {
    const a = project({ id: 'a', name: 'B', endDate: '30/12/2026' });
    const b = project({ id: 'b', name: 'A', endDate: '' });
    const c = project({ id: 'c', name: 'C', endDate: '01/12/2026' });
    expect(sortProjects([a, b, c], 'deadline').map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(sortProjects([a, b, c], 'name').map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(sortProjects([a, b, c], 'position').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('formats percentages with a comma', () => {
    expect(formatPercent(38.92)).toBe('38,92');
  });
});

describe('projectStatus', () => {
  it('derives the status from the overall progress', () => {
    const base = project({});
    const withProgress = (values: number[]) => ({ ...base, activities: values.map((progress, i) => ({ ...base.activities[0], id: i + 1, progress })) });
    expect(projectStatus(withProgress([0, 0]))).toBe('todo');
    expect(projectStatus(withProgress([100, 20]))).toBe('ongoing');
    expect(projectStatus(withProgress([100, 100]))).toBe('done');
  });
});

describe('upcomingDeadlines', () => {
  it('lists open projects by end date, overdue first, and skips those without a date', () => {
    const late = project({ id: 'late', endDate: '30/09/2026' });
    const next = project({ id: 'next', endDate: '10/11/2026' });
    const none = project({ id: 'none', endDate: '' });
    const items = upcomingDeadlines([next, none, late], TODAY);
    expect(items.map((i) => i.project.id)).toEqual(['late', 'next']);
    expect(items.map((i) => deadlineChip(i.deadline))).toEqual(['Vencido há 38 dias', '3 dias']);
  });
});
