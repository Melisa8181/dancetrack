import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

// La sesión vive en una cookie httpOnly: el frontend nunca ve ni guarda el token.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me', { silent401: true })
      .then((r) => setUserState(r.user))
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
    setUnauthorizedHandler(() => setUserState(null)); // sesión vencida: volver a login
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: User }>('/auth/login', { email, password }, { silent401: true });
    setUserState(r.user);
    return r.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const r = await api.post<{ user: User }>('/auth/register', { name, email, password });
    setUserState(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUserState(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser: setUserState }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return v;
}

export const homePathFor = (role: User['role']) => (role === 'ADMIN' ? '/admin' : role === 'TEACHER' ? '/profesor' : '/panel');
