/**
 * Portfolio view of the projects: deadline situation, activity breakdown and sorting.
 * Everything is derived from the fields the projects already have.
 */
import type { Dayjs } from 'dayjs';

import type { Tone } from '@/theme';
import { parseReportDate, projectProgress } from '@/modules/projects/model';
import type { Project } from '@/modules/projects/types';

export type DeadlineKind = 'done' | 'overdue' | 'ontrack' | 'nodate';

export interface Deadline {
  kind: DeadlineKind;
  /** Days past the end date (overdue) or left until it (on track). */
  days: number;
  label: string;
  tone: Tone;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Deadline situation of a project, comparing its end date with today. */
export function projectDeadline(project: Project, today: Dayjs): Deadline {
  if (project.activities.length > 0 && projectProgress(project) >= 100) {
    return { kind: 'done', days: 0, label: 'Concluído', tone: 'success' };
  }
  const end = parseReportDate(project.endDate);
  if (!end) return { kind: 'nodate', days: 0, label: 'Sem data de término', tone: 'neutral' };
  const days = end.startOf('day').diff(today.startOf('day'), 'day');
  if (days < 0) {
    return { kind: 'overdue', days: -days, label: `Prazo vencido há ${plural(-days, 'dia', 'dias')}`, tone: 'danger' };
  }
  if (days === 0) return { kind: 'ontrack', days: 0, label: 'Termina hoje', tone: 'warning' };
  return { kind: 'ontrack', days, label: `${plural(days, 'dia restante', 'dias restantes')}`, tone: days <= 7 ? 'warning' : 'info' };
}

/** Share of the planned period already elapsed (0 to 100), or null without both dates. */
export function elapsedPercent(project: Project, today: Dayjs): number | null {
  const start = parseReportDate(project.startDate);
  const end = parseReportDate(project.endDate);
  if (!start || !end) return null;
  const total = end.diff(start, 'day');
  if (total <= 0) return today.isBefore(end) ? 0 : 100;
  return Math.max(0, Math.min(100, Math.round((today.diff(start, 'day') / total) * 100)));
}

export interface ActivityBreakdown {
  done: number;
  ongoing: number;
  delayed: number;
  todo: number;
  total: number;
  subDone: number;
  subTotal: number;
}

/** Activities by status and sub-activities completed. */
export function activityBreakdown(project: Project): ActivityBreakdown {
  const result: ActivityBreakdown = { done: 0, ongoing: 0, delayed: 0, todo: 0, total: project.activities.length, subDone: 0, subTotal: 0 };
  project.activities.forEach((activity) => {
    if (activity.status === 'Concluído') result.done += 1;
    else if (activity.status === 'Em andamento') result.ongoing += 1;
    else if (activity.status === 'Atrasado') result.delayed += 1;
    else result.todo += 1;
    result.subTotal += activity.subActivities.length;
    result.subDone += activity.subActivities.filter((s) => s.completed).length;
  });
  return result;
}

export type ProjectStatus = 'ongoing' | 'todo' | 'done';

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; plural: string; tone: Tone }> = {
  ongoing: { label: 'Em andamento', plural: 'Em andamento', tone: 'info' },
  todo: { label: 'Não iniciado', plural: 'Não iniciados', tone: 'warning' },
  done: { label: 'Concluído', plural: 'Concluídos', tone: 'success' },
};

/** Status of the project from its overall progress: 0% not started, 100% done. */
export function projectStatus(project: Project): ProjectStatus {
  const progress = projectProgress(project);
  if (project.activities.length > 0 && progress >= 100) return 'done';
  if (progress <= 0) return 'todo';
  return 'ongoing';
}

export interface UpcomingDeadline {
  project: Project;
  date: Dayjs;
  deadline: Deadline;
}

/** Projects not yet done that have an end date, nearest first (overdue ones on top). */
export function upcomingDeadlines(projects: Project[], today: Dayjs, limit = 5): UpcomingDeadline[] {
  return projects
    .map((project) => ({ project, date: parseReportDate(project.endDate), deadline: projectDeadline(project, today) }))
    .filter((item): item is UpcomingDeadline => item.date !== null && item.deadline.kind !== 'done')
    .sort((a, b) => a.date.valueOf() - b.date.valueOf())
    .slice(0, limit);
}

/** Short deadline label for the side list: "Hoje", "3 dias", "Vencido há 38 dias". */
export function deadlineChip(deadline: Deadline): string {
  if (deadline.kind === 'overdue') return `Vencido há ${deadline.days} ${deadline.days === 1 ? 'dia' : 'dias'}`;
  if (deadline.days === 0) return 'Hoje';
  return `${deadline.days} ${deadline.days === 1 ? 'dia' : 'dias'}`;
}

export type DeadlineFilter = 'all' | 'ontrack' | 'overdue' | 'done';
export type ProjectSort = 'position' | 'deadline' | 'progress' | 'name';

export function matchesDeadline(deadline: Deadline, filter: DeadlineFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ontrack') return deadline.kind === 'ontrack' || deadline.kind === 'nodate';
  return deadline.kind === filter;
}

/** Sorted copy of the list; "position" keeps the order saved on the server. */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  const list = [...projects];
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (sort === 'progress') return list.sort((a, b) => projectProgress(b) - projectProgress(a));
  if (sort === 'deadline') {
    const end = (p: Project) => parseReportDate(p.endDate)?.valueOf() ?? Number.POSITIVE_INFINITY;
    return list.sort((a, b) => end(a) - end(b));
  }
  return list;
}

/** Number formatted the Brazilian way (38,92). */
export function formatPercent(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
