import { PUBLICATIONS_BASE, tabPath } from '@/modules/intelligence/paths';

/** Last visited address inside the module, so the navigation returns to the same tab and filters. */
const STORAGE_KEY = 'intelligence:lastLocation';
const BASE = `${PUBLICATIONS_BASE}/`;
export const DEFAULT_LOCATION = tabPath('painel');

export function rememberLocation(pathname: string, search: string): void {
  if (!pathname.startsWith(BASE)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, `${pathname}${search}`);
  } catch {
    // armazenamento indisponível (modo privado/bloqueado): apenas não lembra
  }
}

export function lastLocation(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored && stored.startsWith(BASE) ? stored : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}
