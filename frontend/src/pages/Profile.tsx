import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { Discipline, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Loading, PageHeader, SelectField, TextArea, TextField, useToast } from '../components/ui';
import { ROLE_LABELS } from '../lib/format';
import { isEmail, validatePassword } from '../lib/validation';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [disciplines, setDisciplines] = useState<Discipline[] | null>(null);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', bio: user?.bio ?? '', mainDisciplineId: user?.mainDisciplineId ? String(user.mainDisciplineId) : '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => { api.get<{ items: Discipline[] }>('/disciplines').then((r) => setDisciplines(r.items)).catch(() => setDisciplines([])); }, []);
  if (!user || !disciplines) return <Loading />;

  async function save(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'El nombre debe tener al menos 2 caracteres.';
    if (!isEmail(form.email)) errs.email = 'Ingresá un correo válido.';
    if (form.bio.length > 500) errs.bio = 'Máximo 500 caracteres.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const r = await api.patch<{ user: User }>('/profile', {
        name: form.name.trim(), email: form.email.trim(), bio: form.bio.trim() || null,
        mainDisciplineId: form.mainDisciplineId ? Number(form.mainDisciplineId) : null,
      });
      setUser(r.user);
      toast('success', 'Perfil actualizado.');
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fields ?? {}); setFormError(err.message); } else setFormError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pw.currentPassword) errs.currentPassword = 'Ingresá tu contraseña actual.';
    const v = validatePassword(pw.newPassword);
    if (v) errs.newPassword = v;
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwSaving(true);
    try {
      await api.post('/profile/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('success', 'Contraseña actualizada.');
    } catch (err) {
      setPwErrors(err instanceof ApiError ? { ...(err.fields ?? {}), ...(err.fields ? {} : { currentPassword: err.message }) } : { currentPassword: 'No se pudo cambiar la contraseña.' });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Tu perfil">Tu rol es <strong>{ROLE_LABELS[user.role]}</strong>. Solo un administrador puede cambiarlo.</PageHeader>
      <div className="grid max-w-4xl gap-8 lg:grid-cols-2">
        <form onSubmit={save} noValidate className="space-y-4 surface p-5" aria-labelledby="datos">
          <h2 id="datos" className="text-xl">Datos básicos</h2>
          {formError && <Alert>{formError}</Alert>}
          <TextField label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <TextField label="Correo electrónico" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <SelectField label="Disciplina principal" optional value={form.mainDisciplineId} onChange={(e) => setForm({ ...form, mainDisciplineId: e.target.value })}>
            <option value="">Sin especificar</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <TextArea label="Descripción" optional maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} error={errors.bio} />
          <Button type="submit" loading={saving}>Guardar cambios</Button>
        </form>

        <form onSubmit={changePassword} noValidate className="space-y-4 self-start surface p-5" aria-labelledby="clave">
          <h2 id="clave" className="text-xl">Cambiar contraseña</h2>
          <TextField label="Contraseña actual" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={pwErrors.currentPassword} />
          <TextField label="Contraseña nueva" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={pwErrors.newPassword} hint="Mínimo 8 caracteres, con letras y números." />
          <Button type="submit" variant="secondary" loading={pwSaving}>Actualizar contraseña</Button>
        </form>
      </div>
    </>
  );
}
