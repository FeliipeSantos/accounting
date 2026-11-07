/** Last visited address inside the module, so the side menu returns to the same tab and filters. */
const STORAGE_KEY = 'intelligence:lastLocation';
const BASE = '/inteligencia/';
export const DEFAULT_LOCATION = '/inteligencia/painel';

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
