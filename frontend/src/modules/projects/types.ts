/** Project document stored by the server (free-form JSON, these are the fields the screen uses). */

export const ACTIVITY_STATUSES = ['Concluído', 'Em andamento', 'Atrasado', 'Não iniciado'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface SubActivity {
  id: number;
  name: string;
  completed: boolean;
}

/** Lists kept per activity, shown in the three attention cards. */
export type ActivityListKey = 'attentionPoints' | 'projectImpacts' | 'actionPlans';

export interface Activity {
  id: number;
  name: string;
  progress: number;
  status: ActivityStatus | string;
  subActivities: SubActivity[];
  attentionPoints: string[];
  projectImpacts: string[];
  actionPlans: string[];
  [key: string]: unknown;
}

export type KanbanColumn = 'done' | 'doing' | 'todo';

export type Kanban = Record<KanbanColumn, string[]>;

export interface Project {
  id: string;
  name: string;
  reportDate?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  team?: string;
  activities: Activity[];
  kanban?: Kanban;
  percentActual?: number;
  [key: string]: unknown;
}

/** Header fields edited directly on the report. */
export type ProjectTextField = 'name' | 'reportDate' | 'startDate' | 'endDate' | 'description' | 'team';
