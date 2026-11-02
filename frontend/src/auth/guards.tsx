import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { Loading } from '../components/ui';
import { homePathFor, useAuth } from './AuthContext';

// Estas guardas mejoran la experiencia; la seguridad real está en el backend.
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Cargando tu sesión…" />;
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}

export function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Cargando…" />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
