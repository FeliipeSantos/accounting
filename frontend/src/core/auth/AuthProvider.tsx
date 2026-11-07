import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, apiRequest, onSessionExpired } from '@/core/api/client';
import { AuthContext, SESSION_EXPIRED_NOTICE, type SessionState } from '@/core/auth/authContext';

/** Server-side session: the browser only holds the HttpOnly cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'checking' });

  useEffect(() => {
    let active = true;
    apiRequest<{ user: string }>('/api/auth/session')
      .then(({ user }) => active && setSession({ status: 'authenticated', user }))
      .catch(() => active && setSession({ status: 'anonymous', notice: null }));
    const unsubscribe = onSessionExpired(() => setSession({ status: 'anonymous', notice: SESSION_EXPIRED_NOTICE }));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const { user } = await apiRequest<{ user: string }>('/api/auth/login', { method: 'POST', body: { username, password } });
      setSession({ status: 'authenticated', user });
    } catch (error) {
      // mensagem do servidor (senha incorreta, muitas tentativas) ou falha de conexão
      throw error instanceof ApiError ? error : new ApiError(0, 'Não foi possível entrar. Tente novamente.');
    }
  }, []);

  const logout = useCallback(async () => {
    // encerra a sessão no servidor; a tela volta ao login mesmo se a chamada falhar
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession({ status: 'anonymous', notice: null });
  }, []);

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
