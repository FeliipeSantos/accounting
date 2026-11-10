import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, apiRequest, onSessionExpired } from '@/core/api/client';
import { AuthContext, SESSION_EXPIRED_NOTICE, type SessionState } from '@/core/auth/authContext';
import { type Profile, profileApi } from '@/core/auth/profile';

/** Server-side session: the browser only holds the HttpOnly cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'checking' });
  const [profile, setProfileState] = useState<Profile | null>(null);
  const sessionUser = session.status === 'authenticated' ? session.user : null;

  // nome e avatar do usuário conectado (topo e Meu perfil); sem eles, a tela usa o login e as iniciais
  useEffect(() => {
    if (!sessionUser) {
      setProfileState(null);
      return undefined;
    }
    let active = true;
    profileApi
      .get()
      .then((loaded) => active && setProfileState(loaded))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionUser]);

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

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next);
    setSession((current) => (current.status === 'authenticated' && current.user !== next.user ? { status: 'authenticated', user: next.user } : current));
  }, []);

  const value = useMemo(() => ({ session, login, logout, profile, setProfile }), [session, login, logout, profile, setProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
