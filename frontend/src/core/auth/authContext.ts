import { createContext, useContext } from 'react';

import type { Profile } from '@/core/auth/profile';

export type SessionState = { status: 'checking' } | { status: 'anonymous'; notice: string | null } | { status: 'authenticated'; user: string };

export interface AuthContextValue {
  session: SessionState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Name and avatar of the session user (null while loading or when it could not load). */
  profile: Profile | null;
  /** Profile saved in Meu perfil; a new login name also updates the session (it stays open). */
  setProfile: (profile: Profile) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
