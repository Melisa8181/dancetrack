import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { PublicOnly, RequireAuth } from './auth/guards';
import { AppLayout } from './components/Layout';
import { ToastProvider } from './components/ui';
import Landing from './pages/Landing';
import { Login, Register } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import TrainingForm from './pages/TrainingForm';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';
import TeacherHome from './pages/TeacherHome';
import TeacherDancerPage from './pages/TeacherDancerPage';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<PublicOnly />}>
            <Route path="/ingresar" element={<Login />} />
            <Route path="/registro" element={<Register />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/perfil" element={<Profile />} />
              <Route element={<RequireAuth roles={['DANCER']} />}>
                <Route path="/panel" element={<Dashboard />} />
                <Route path="/entrenamientos" element={<History />} />
                <Route path="/entrenamientos/nuevo" element={<TrainingForm />} />
                <Route path="/entrenamientos/:id/editar" element={<TrainingForm />} />
                <Route path="/privacidad" element={<Privacy />} />
              </Route>
              <Route element={<RequireAuth roles={['TEACHER']} />}>
                <Route path="/profesor" element={<TeacherHome />} />
                <Route path="/profesor/:dancerId" element={<TeacherDancerPage />} />
              </Route>
              <Route element={<RequireAuth roles={['ADMIN']} />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
