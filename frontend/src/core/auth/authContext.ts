import { createContext, useContext } from 'react';

export type SessionState = { status: 'checking' } | { status: 'anonymous'; notice: string | null } | { status: 'authenticated'; user: string };

export interface AuthContextValue {
  session: SessionState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
