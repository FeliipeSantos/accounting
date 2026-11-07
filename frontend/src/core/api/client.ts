/**
 * Client for the backend API. The session travels in an HttpOnly cookie sent by
 * the browser; a 401 answer means the session expired, and every listener of
 * onSessionExpired is notified (the app returns to the login screen).
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, 'Sessão expirada');
  }
}

type Listener = () => void;
const sessionListeners = new Set<Listener>();

/** Subscribes to session expiry; returns the unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls the API and returns the JSON answer. Writes always go as JSON (the server
 * refuses other content types as CSRF protection).
 */
export async function apiRequest<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Servidor indisponível. Tente novamente.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    sessionListeners.forEach((listener) => listener());
    throw new SessionExpiredError();
  }
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Erro ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

/** Message to show for an error raised by apiRequest (session expiry is handled elsewhere). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado';
}
