/**
 * Rules of the Portal de Projetos, as pure functions (same behavior as the previous screen).
 * Every function returns a new project; the given one is never changed.
 */
import dayjs, { type Dayjs } from 'dayjs';

import type { Activity, ActivityListKey, ActivityStatus, KanbanColumn, Project, ProjectTextField } from '@/modules/projects/types';

export const DATE_FORMAT = 'DD/MM/YYYY';

/** Parses a report date, accepting spaces around the separators (e.g. "04 / 05 / 2026"). */
export function parseReportDate(value?: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value.replace(/\s+/g, ''), DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

const NEW_PROJECT_DAYS = 60;

function update<T>(value: T, change: (draft: T) => void): T {
  const draft = structuredClone(value);
  change(draft);
  return draft;
}

function findActivity(project: Project, activityId: number): Activity | undefined {
  return project.activities.find((a) => a.id === activityId);
}

/** Fills missing lists and numeric ids of projects saved by older versions. */
export function normalizeProject(project: Project): Project {
  return update(project, (p) => {
    if (!p.id) p.id = `proj-${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    if (!Array.isArray(p.activities)) p.activities = [];
    p.activities.forEach((activity, index) => {
      activity.id = parseInt(String(activity.id), 10) || index + 1;
      activity.subActivities ??= [];
      activity.attentionPoints ??= [];
      activity.projectImpacts ??= [];
      activity.actionPlans ??= [];
    });
  });
}

/** Overall progress: average of the activities, with two decimals. */
export function projectProgress(project: Pick<Project, 'activities'>): number {
  const activities = project.activities ?? [];
  if (!activities.length) return 0;
  const sum = activities.reduce((total, activity) => total + (Number(activity.progress) || 0), 0);
  return parseFloat((sum / activities.length).toFixed(2));
}

export function withProjectProgress(project: Project): Project {
  return update(project, (p) => {
    p.percentActual = projectProgress(p);
  });
}

/** Activity progress from its checklist; without sub-activities the progress stays manual. */
function recalculateActivity(activity: Activity): void {
  if (!activity.subActivities.length) return;
  const done = activity.subActivities.filter((s) => s.completed).length;
  activity.progress = Math.round((done / activity.subActivities.length) * 100);
  if (activity.progress === 100) activity.status = 'Concluído';
  else if (activity.progress === 0) activity.status = 'Não iniciado';
  else if (activity.status !== 'Atrasado') activity.status = 'Em andamento';
}

function afterActivityChange(project: Project, activityId: number): void {
  const activity = findActivity(project, activityId);
  if (activity) recalculateActivity(activity);
  project.percentActual = projectProgress(project);
}

export function newProject(name: string, now = dayjs()): Project {
  return {
    id: `proj-${now.valueOf()}`,
    name: name.trim(),
    reportDate: now.format(DATE_FORMAT),
    startDate: now.format(DATE_FORMAT),
    endDate: now.add(NEW_PROJECT_DAYS, 'day').format(DATE_FORMAT),
    description: 'Implantação e parametrização inicial do projeto.',
    team: 'GP: Usuário',
    activities: [
      {
        id: 1,
        name: 'Fase de Planejamento',
        progress: 0,
        status: 'Não iniciado',
        subActivities: [{ id: 1, name: 'Definição do escopo inicial', completed: false }],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: [],
      },
    ],
    kanban: { done: [], doing: [], todo: ['Definição do escopo inicial da fase de planejamento'] },
  };
}

export function setProjectField(project: Project, field: ProjectTextField, value: string): Project {
  return update(project, (p) => {
    p[field] = value;
  });
}

// ---------- activities ----------

export function addActivity(project: Project): { project: Project; activityId: number } {
  const activityId = project.activities.length + 1;
  const next = update(project, (p) => {
    p.activities.push({
      id: activityId,
      name: 'Nova Atividade',
      progress: 0,
      status: 'Não iniciado',
      subActivities: [],
      attentionPoints: [],
      projectImpacts: [],
      actionPlans: [],
    });
    p.percentActual = projectProgress(p);
  });
  return { project: next, activityId };
}

export function renameActivity(project: Project, activityId: number, name: string): Project {
  return update(project, (p) => {
    const activity = findActivity(p, activityId);
    if (activity) activity.name = name;
  });
}

/** Status chosen by hand: "Concluído" sets 100%, "Não iniciado" sets 0%. */
export function setActivityStatus(project: Project, activityId: number, status: ActivityStatus): Project {
  return update(project, (p) => {
    const activity = findActivity(p, activityId);
    if (!activity) return;
    activity.status = status;
    if (status === 'Concluído') activity.progress = 100;
    else if (status === 'Não iniciado') activity.progress = 0;
    p.percentActual = projectProgress(p);
  });
}

/** Ids follow the display order, so they are renumbered after removing or moving. */
function renumber(project: Project): void {
  project.activities.forEach((activity, index) => {
    activity.id = index + 1;
  });
}

export function removeActivity(project: Project, activityId: number): Project {
  return update(project, (p) => {
    p.activities = p.activities.filter((a) => a.id !== activityId);
    renumber(p);
    p.percentActual = projectProgress(p);
  });
}

/**
 * Moves an activity onto the position of another (drag and drop).
 * Returns the new id of the activity that was selected, which follows it.
 */
export function moveActivity(project: Project, sourceId: number, targetId: number, selectedId: number | null): { project: Project; selectedId: number | null } {
  let nextSelected = selectedId;
  const next = update(project, (p) => {
    const from = p.activities.findIndex((a) => a.id === sourceId);
    let to = p.activities.findIndex((a) => a.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const selected = p.activities.find((a) => a.id === selectedId) ?? null;
    const [moved] = p.activities.splice(from, 1);
    if (from < to) to -= 1;
    p.activities.splice(to, 0, moved);
    renumber(p);
    if (selected) nextSelected = selected.id;
  });
  return { project: next, selectedId: nextSelected };
}

// ---------- sub-activities ----------

export function toggleSubActivity(project: Project, activityId: number, index: number, completed: boolean): Project {
  return update(project, (p) => {
    const sub = findActivity(p, activityId)?.subActivities[index];
    if (sub) sub.completed = completed;
    afterActivityChange(p, activityId);
  });
}

export function addSubActivity(project: Project, activityId: number, name: string): Project {
  return update(project, (p) => {
    const activity = findActivity(p, activityId);
    if (!activity) return;
    activity.subActivities.push({ id: activity.subActivities.length + 1, name: name.trim(), completed: false });
    afterActivityChange(p, activityId);
  });
}

/** Renames a sub-activity; an empty name removes it. */
export function renameSubActivity(project: Project, activityId: number, index: number, name: string): Project {
  return update(project, (p) => {
    const activity = findActivity(p, activityId);
    if (!activity?.subActivities[index]) return;
    if (name.trim()) activity.subActivities[index].name = name.trim();
    else activity.subActivities.splice(index, 1);
    afterActivityChange(p, activityId);
  });
}

export function removeSubActivity(project: Project, activityId: number, index: number): Project {
  return update(project, (p) => {
    findActivity(p, activityId)?.subActivities.splice(index, 1);
    afterActivityChange(p, activityId);
  });
}

// ---------- attention lists and kanban ----------

export const NEW_LIST_ITEM = 'Novo item...';
export const NEW_KANBAN_CARD = 'Novo cartão...';

export function addListItem(project: Project, activityId: number, key: ActivityListKey): Project {
  return update(project, (p) => {
    findActivity(p, activityId)?.[key].push(NEW_LIST_ITEM);
  });
}

/** Changes a list item; an empty text removes it. */
export function setListItem(project: Project, activityId: number, key: ActivityListKey, index: number, text: string): Project {
  return update(project, (p) => {
    const list = findActivity(p, activityId)?.[key];
    if (!list || index >= list.length) return;
    if (text.trim()) list[index] = text.trim();
    else list.splice(index, 1);
  });
}

export function removeListItem(project: Project, activityId: number, key: ActivityListKey, index: number): Project {
  return update(project, (p) => {
    findActivity(p, activityId)?.[key].splice(index, 1);
  });
}

function ensureKanban(project: Project) {
  project.kanban ??= { done: [], doing: [], todo: [] };
  return project.kanban;
}

export function addKanbanCard(project: Project, column: KanbanColumn): Project {
  return update(project, (p) => {
    const kanban = ensureKanban(p);
    kanban[column] ??= [];
    kanban[column].push(NEW_KANBAN_CARD);
  });
}

/** Changes a kanban card; an empty text removes it. */
export function setKanbanCard(project: Project, column: KanbanColumn, index: number, text: string): Project {
  return update(project, (p) => {
    const cards = ensureKanban(p)[column];
    if (!cards || index >= cards.length) return;
    if (text.trim()) cards[index] = text.trim();
    else cards.splice(index, 1);
  });
}

export function removeKanbanCard(project: Project, column: KanbanColumn, index: number): Project {
  return update(project, (p) => {
    ensureKanban(p)[column]?.splice(index, 1);
  });
}

/** Status color group used by the badges. */
export function statusTone(status: string): 'done' | 'delayed' | 'ongoing' | 'todo' {
  switch (status) {
    case 'Concluído':
      return 'done';
    case 'Atrasado':
      return 'delayed';
    case 'Em andamento':
      return 'ongoing';
    default:
      return 'todo';
  }
}
