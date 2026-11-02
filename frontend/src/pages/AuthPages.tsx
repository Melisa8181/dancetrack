import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Layout';
import { Alert, Button, TextField } from '../components/ui';
import { isEmail, validatePassword } from '../lib/validation';

function Shell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Link to="/" aria-label="Volver a la presentación"><Logo /></Link>
      <main className="mt-8 w-full max-w-md surface p-6 sm:p-8">
        <h1 className="mb-6 text-3xl text-wine-800">{title}</h1>
        {children}
        <p className="mt-6 text-center text-sm text-mute">{footer}</p>
      </main>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isEmail(email)) errs.email = 'Ingresá un correo válido.';
    if (!password) errs.password = 'Ingresá tu contraseña.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(from ?? homePathFor(user.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Iniciar sesión" footer={<>¿No tenés cuenta? <Link className="font-semibold text-wine-700 underline" to="/registro">Crear cuenta</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <TextField label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" loading={loading} className="w-full">Iniciar sesión</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'El nombre debe tener al menos 2 caracteres.';
    if (!isEmail(form.email)) errs.email = 'Ingresá un correo válido.';
    const pw = validatePassword(form.password);
    if (pw) errs.password = pw;
    if (form.confirm !== form.password) errs.confirm = 'Las contraseñas no coinciden.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const user = await register(form.name.trim(), form.email.trim(), form.password);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setFormError(err.message);
      } else setFormError('No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Crear cuenta" footer={<>¿Ya tenés cuenta? <Link className="font-semibold text-wine-700 underline" to="/ingresar">Iniciar sesión</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <TextField label="Nombre" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Correo electrónico" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextField label="Contraseña" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Mínimo 8 caracteres, con letras y números." />
        <TextField label="Repetir contraseña" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" loading={loading} className="w-full">Crear cuenta</Button>
      </form>
    </Shell>
  );
}
