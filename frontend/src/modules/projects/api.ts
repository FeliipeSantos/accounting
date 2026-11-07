import { apiRequest } from '@/core/api/client';
import { normalizeProject } from '@/modules/projects/model';
import type { Project } from '@/modules/projects/types';

const BASE = '/api/projects';

/** Raised when saving is blocked because the project list could not be loaded. */
export class ProjectsNotLoadedError extends Error {
  constructor() {
    super('Os projetos não foram carregados do servidor, então nada foi salvo. Recarregue a página e tente novamente.');
  }
}

// Enquanto a lista não puder ser carregada, salvar fica bloqueado: uma lista incompleta
// na memória nunca pode sobrescrever os dados reais do servidor.
let loadFailed = false;
// Último salvamento em andamento: a lista espera por ele antes de recarregar
let pendingSave: Promise<unknown> = Promise.resolve();

export async function listProjects(): Promise<Project[]> {
  await pendingSave.catch(() => undefined);
  try {
    const projects = await apiRequest<Project[]>(BASE);
    if (!Array.isArray(projects)) throw new Error('Resposta inesperada do servidor');
    loadFailed = false;
    return projects.map(normalizeProject);
  } catch (error) {
    loadFailed = true;
    throw error;
  }
}

/** Saves ONE project (creates or updates). */
export function saveProject(project: Project): Promise<void> {
  if (loadFailed) return Promise.reject(new ProjectsNotLoadedError());
  const request = apiRequest<{ result: 'created' | 'updated' }>(`${BASE}/${encodeURIComponent(project.id)}`, { method: 'PUT', body: project });
  pendingSave = request;
  return request.then(() => undefined);
}

export async function deleteProject(projectId: string): Promise<void> {
  if (loadFailed) throw new ProjectsNotLoadedError();
  await apiRequest(`${BASE}/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

/** Loads one project from the list (the server returns all of them in display order). */
export async function getProject(projectId: string): Promise<Project | null> {
  const projects = await listProjects();
  return projects.find((p) => p.id === projectId) ?? null;
}
