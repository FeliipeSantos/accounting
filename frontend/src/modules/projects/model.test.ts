import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  addActivity,
  addSubActivity,
  moveActivity,
  newProject,
  normalizeProject,
  projectProgress,
  removeActivity,
  renameSubActivity,
  setActivityStatus,
  setKanbanCard,
  setListItem,
  toggleSubActivity,
} from '@/modules/projects/model';
import type { Project } from '@/modules/projects/types';

function sample(): Project {
  const project = newProject('Teste', dayjs('2026-11-06'));
  return addSubActivity(project, 1, 'Segunda');
}

describe('progress', () => {
  it('follows the checklist and updates the status', () => {
    let project = sample();
    project = toggleSubActivity(project, 1, 0, true);
    expect(project.activities[0].progress).toBe(50);
    expect(project.activities[0].status).toBe('Em andamento');
    project = toggleSubActivity(project, 1, 1, true);
    expect(project.activities[0].status).toBe('Concluído');
    expect(project.percentActual).toBe(100);
    project = toggleSubActivity(toggleSubActivity(project, 1, 0, false), 1, 1, false);
    expect(project.activities[0].status).toBe('Não iniciado');
  });

  it('keeps "Atrasado" while partially done', () => {
    let project = setActivityStatus(sample(), 1, 'Atrasado');
    project = toggleSubActivity(project, 1, 0, true);
    expect(project.activities[0].status).toBe('Atrasado');
  });

  it('averages activities with two decimals', () => {
    const { project } = addActivity(setActivityStatus(sample(), 1, 'Concluído'));
    const third = addActivity(project).project;
    expect(projectProgress(third)).toBe(33.33);
  });

  it('never changes the given project', () => {
    const original = sample();
    const copy = structuredClone(original);
    toggleSubActivity(original, 1, 0, true);
    expect(original).toEqual(copy);
  });
});

describe('activities', () => {
  it('renumbers after removing and moving, and the selection follows the moved activity', () => {
    let project = addActivity(addActivity(sample()).project).project;
    project = removeActivity(project, 1);
    expect(project.activities.map((a) => a.id)).toEqual([1, 2]);
    const moved = moveActivity(project, 2, 1, 2);
    expect(moved.project.activities.map((a) => a.name)).toEqual(['Nova Atividade', 'Nova Atividade']);
    expect(moved.selectedId).toBe(1);
  });

  it('empty text removes sub-activities, list items and kanban cards', () => {
    let project = renameSubActivity(sample(), 1, 0, '   ');
    expect(project.activities[0].subActivities.map((s) => s.name)).toEqual(['Segunda']);
    project = setListItem({ ...project, activities: [{ ...project.activities[0], attentionPoints: ['a', 'b'] }] }, 1, 'attentionPoints', 0, '');
    expect(project.activities[0].attentionPoints).toEqual(['b']);
    project = setKanbanCard(project, 'todo', 0, '');
    expect(project.kanban?.todo).toEqual([]);
  });
});

describe('normalizeProject', () => {
  it('fills missing lists and numeric ids of older projects', () => {
    const old = { id: 'p', name: 'x', activities: [{ id: '3', name: 'a', progress: 0, status: 'Não iniciado' }] } as unknown as Project;
    const project = normalizeProject(old);
    expect(project.activities[0].id).toBe(3);
    expect(project.activities[0].subActivities).toEqual([]);
    expect(project.activities[0].actionPlans).toEqual([]);
  });
});
