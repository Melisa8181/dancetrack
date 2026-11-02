import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, qs } from '../api/client';
import type { AdminDiscipline, AdminLink, AdminUser, Paged, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Loading, PageHeader, SelectField, TextField, useToast, cx } from '../components/ui';
import { ROLE_LABELS } from '../lib/format';

type Tab = 'users' | 'disciplines' | 'links';
const TABS: { id: Tab; label: string }[] = [{ id: 'users', label: 'Usuarios' }, { id: 'disciplines', label: 'Disciplinas' }, { id: 'links', label: 'Vínculos' }];
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <>
      <PageHeader title="Administración">Gestioná cuentas, disciplinas y vínculos. Por diseño, no tenés acceso a los entrenamientos, molestias ni observaciones de las personas.</PageHeader>
      <div role="tablist" aria-label="Secciones" className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}
            className={cx('-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-semibold', tab === t.id ? 'border-wine-600 text-wine-800' : 'border-transparent text-mute hover:text-ink')}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'users' && <UsersTab />}
        {tab === 'disciplines' && <DisciplinesTab />}
        {tab === 'links' && <LinksTab />}
      </div>
    </>
  );
}

// ---------------- Usuarios
type Pending = { user: AdminUser; change: { role: Role } | { isActive: boolean } };
const isDeactivation = (p: Pending) => 'isActive' in p.change && !p.change.isActive;
const dialogTitle = (p: Pending) => ('role' in p.change ? '¿Cambiar el rol?' : p.change.isActive ? '¿Activar la cuenta?' : '¿Desactivar la cuenta?');

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>({});

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.get<Paged<AdminUser>>(`/admin/users${qs({ search: debounced, role, page, pageSize: 10 })}`)); }
    catch (e) { setError(errMsg(e, 'No se pudieron cargar los usuarios.')); }
    finally { setLoading(false); }
  }, [debounced, role, page]);
  useEffect(() => { void load(); }, [load]);

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await api.patch(`/admin/users/${pending.user.id}`, pending.change);
      toast('success', 'Cambios guardados.');
      setPending(null);
      setDraftRoles((d) => { const { [pending.user.id]: _drop, ...rest } = d; return rest; });
      await load();
    } catch (e) { toast('error', errMsg(e, 'No se pudo guardar el cambio.')); setPending(null); }
    finally { setSaving(false); }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const describe = (p: Pending) => 'role' in p.change
    ? `Vas a cambiar el rol de ${p.user.name} de ${ROLE_LABELS[p.user.role]} a ${ROLE_LABELS[p.change.role]}. Sus vínculos con profesores o bailarines se revocarán.`
    : p.change.isActive ? `${p.user.name} podrá volver a iniciar sesión.` : `${p.user.name} no podrá iniciar sesión y su sesión actual se cerrará.`;

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="mb-4 grid gap-4 sm:grid-cols-2" aria-label="Filtros de usuarios">
        <TextField label="Buscar por nombre o correo" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Rol" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Todos</option>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </SelectField>
      </form>
      {error && <div className="mb-4 space-y-3"><Alert>{error}</Alert><Button onClick={load}>Reintentar</Button></div>}
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && <EmptyState title="No se encontraron usuarios">Probá con otra búsqueda o rol.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className={loading ? 'opacity-60' : ''}>
          <div className="surface overflow-hidden">
            <table role="table" className="w-full text-left text-sm max-md:block">
              <caption className="sr-only">Usuarios registrados</caption>
              <thead role="rowgroup" className="bg-sand/70 text-wine-800 max-md:sr-only"><tr role="row"><th role="columnheader" scope="col" className="p-3">Usuario</th><th role="columnheader" scope="col" className="p-3">Rol</th><th role="columnheader" scope="col" className="p-3">Estado</th><th role="columnheader" scope="col" className="p-3">Acciones</th></tr></thead>
              <tbody role="rowgroup" className="divide-y divide-line max-md:block">
                {data.items.map((u) => {
                  const isMe = u.id === me?.id;
                  const draft = draftRoles[u.id] ?? u.role;
                  return (
                    <tr key={u.id} role="row" className="max-md:grid max-md:grid-cols-2 max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:p-4">
                      <td role="cell" className="p-3 max-md:col-span-2 max-md:p-0"><span className="block font-semibold">{u.name}{isMe && ' (vos)'}</span><span className="text-mute">{u.email}</span></td>
                      <td role="cell" className="p-3 max-md:col-span-2 max-md:p-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <select aria-label={`Rol de ${u.name}`} disabled={isMe} value={draft} onChange={(e) => setDraftRoles((d) => ({ ...d, [u.id]: e.target.value as Role }))} className="min-h-11 rounded-lg border border-field bg-card px-2">
                            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                          {draft !== u.role && <Button variant="secondary" onClick={() => setPending({ user: u, change: { role: draft } })}>Cambiar rol</Button>}
                        </div>
                      </td>
                      <td role="cell" className="p-3 max-md:p-0"><Badge tone={u.isActive ? 'ok' : 'warn'}>{u.isActive ? 'Activa' : 'Desactivada'}</Badge></td>
                      <td role="cell" className="p-3 max-md:p-0 max-md:justify-self-end"><Button variant={u.isActive ? 'danger' : 'secondary'} disabled={isMe} onClick={() => setPending({ user: u, change: { isActive: !u.isActive } })}>{u.isActive ? 'Desactivar' : 'Activar'}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginación de usuarios" className="mt-4 flex items-center justify-between">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <p className="text-sm text-mute">Página {page} de {totalPages} · {data.total} usuarios</p>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </nav>
        </div>
      )}
      <ConfirmDialog open={pending !== null} title={pending ? dialogTitle(pending) : ''}
        confirmLabel="Confirmar" danger={pending ? isDeactivation(pending) : false} loading={saving} onConfirm={confirm} onCancel={() => setPending(null)}>
        {pending && describe(pending)}
      </ConfirmDialog>
    </>
  );
}

// ---------------- Disciplinas
function DisciplinesTab() {
  const toast = useToast();
  const [items, setItems] = useState<AdminDiscipline[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [toDisable, setToDisable] = useState<AdminDiscipline | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await api.get<{ items: AdminDiscipline[] }>('/admin/disciplines')).items); setError(''); }
    catch (e) { setError(errMsg(e, 'No se pudieron cargar las disciplinas.')); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast('success', ok); await load(); return true; }
    catch (e) { toast('error', errMsg(e, 'No se pudo completar la acción.')); return false; }
    finally { setBusy(false); }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setNameError('El nombre debe tener al menos 2 caracteres.'); return; }
    setNameError('');
    if (await run(() => api.post('/admin/disciplines', { name: name.trim() }), 'Disciplina creada.')) setName('');
  }

  return (
    <>
      <form onSubmit={add} noValidate className="mb-6 flex max-w-xl flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><TextField label="Nueva disciplina" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={60} /></div>
        <Button type="submit" loading={busy}>Agregar</Button>
      </form>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!items && !error && <Loading />}
      {items && (
        <ul className="divide-y divide-line overflow-hidden surface">
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              {editing?.id === d.id ? (
                <form className="flex flex-1 flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (editing.name.trim().length >= 2 && await run(() => api.patch(`/admin/disciplines/${d.id}`, { name: editing.name.trim() }), 'Disciplina actualizada.')) setEditing(null); }}>
                  <div className="min-w-48 flex-1"><TextField label="Nombre" value={editing.name} onChange={(e) => setEditing({ id: d.id, name: e.target.value })} maxLength={60} /></div>
                  <Button type="submit" loading={busy}>Guardar</Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
                </form>
              ) : (
                <>
                  <span className="font-semibold">{d.name} <Badge tone={d.isActive ? 'ok' : 'warn'}>{d.isActive ? 'Activa' : 'Inactiva'}</Badge></span>
                  <span className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditing({ id: d.id, name: d.name })} aria-label={`Editar ${d.name}`}>Editar</Button>
                    {d.isActive
                      ? <Button variant="danger" onClick={() => setToDisable(d)} aria-label={`Desactivar ${d.name}`}>Desactivar</Button>
                      : <Button variant="secondary" disabled={busy} onClick={() => run(() => api.patch(`/admin/disciplines/${d.id}`, { isActive: true }), 'Disciplina activada.')} aria-label={`Activar ${d.name}`}>Activar</Button>}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={toDisable !== null} title="¿Desactivar la disciplina?" confirmLabel="Desactivar" danger loading={busy}
        onConfirm={async () => { if (toDisable) await run(() => api.patch(`/admin/disciplines/${toDisable.id}`, { isActive: false }), 'Disciplina desactivada.'); setToDisable(null); }} onCancel={() => setToDisable(null)}>
        {toDisable && <>"{toDisable.name}" dejará de ofrecerse en los formularios. Los entrenamientos ya registrados se conservan.</>}
      </ConfirmDialog>
    </>
  );
}

// ---------------- Vínculos
const STATUS: Record<AdminLink['status'], { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  PENDING: { label: 'Pendiente de aceptación', tone: 'warn' }, ACCEPTED: { label: 'Aceptado', tone: 'ok' }, REJECTED: { label: 'Rechazado', tone: 'neutral' }, REVOKED: { label: 'Revocado', tone: 'neutral' },
};

function LinksTab() {
  const toast = useToast();
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [dancers, setDancers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ teacherId: '', dancerId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toRevoke, setToRevoke] = useState<AdminLink | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, t, d] = await Promise.all([
        api.get<{ items: AdminLink[] }>('/admin/links'),
        api.get<Paged<AdminUser>>('/admin/users?role=TEACHER&pageSize=100'),
        api.get<Paged<AdminUser>>('/admin/users?role=DANCER&pageSize=100'),
      ]);
      setLinks(l.items); setTeachers(t.items.filter((u) => u.isActive)); setDancers(d.items.filter((u) => u.isActive)); setError('');
    } catch (e) { setError(errMsg(e, 'No se pudieron cargar los vínculos.')); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.teacherId) errs.teacherId = 'Elegí un profesor.';
    if (!form.dancerId) errs.dancerId = 'Elegí un bailarín.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await api.post('/admin/links', form); toast('success', 'Solicitud enviada. El bailarín debe aceptarla.'); setForm({ teacherId: '', dancerId: '' }); await load(); }
    catch (err) { toast('error', errMsg(err, 'No se pudo crear el vínculo.')); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!toRevoke) return;
    setBusy(true);
    try { await api.post(`/admin/links/${toRevoke.id}/revoke`); toast('success', 'Vínculo revocado.'); await load(); }
    catch (err) { toast('error', errMsg(err, 'No se pudo revocar.')); }
    finally { setBusy(false); setToRevoke(null); }
  }

  return (
    <>
      <form onSubmit={create} noValidate className="mb-6 grid max-w-3xl gap-4 sm:grid-cols-3 sm:items-end">
        <SelectField label="Profesor" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} error={errors.teacherId}>
          <option value="">Elegí un profesor</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
        </SelectField>
        <SelectField label="Bailarín" value={form.dancerId} onChange={(e) => setForm({ ...form, dancerId: e.target.value })} error={errors.dancerId}>
          <option value="">Elegí un bailarín</option>{dancers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
        </SelectField>
        <Button type="submit" loading={busy}>Crear vínculo</Button>
      </form>
      <p className="mb-4 max-w-prose text-sm text-mute">El vínculo queda pendiente hasta que el bailarín lo acepte. Aun aceptado, el profesor no ve nada hasta que el bailarín le autorice información.</p>
      {error && <Alert>{error}</Alert>}
      {!links && !error && <Loading />}
      {links && links.length === 0 && <EmptyState title="No hay vínculos">Creá el primero eligiendo un profesor y un bailarín.</EmptyState>}
      {links && links.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden surface">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span><span className="font-semibold">{l.teacher.name}</span> con <span className="font-semibold">{l.dancer.name}</span> <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge></span>
              {(l.status === 'PENDING' || l.status === 'ACCEPTED') && <Button variant="danger" onClick={() => setToRevoke(l)} aria-label={`Revocar vínculo de ${l.teacher.name} con ${l.dancer.name}`}>Revocar</Button>}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={toRevoke !== null} title="¿Revocar el vínculo?" confirmLabel="Revocar" danger loading={busy} onConfirm={revoke} onCancel={() => setToRevoke(null)}>
        {toRevoke && <>{toRevoke.teacher.name} dejará de tener acceso a la información de {toRevoke.dancer.name}.</>}
      </ConfirmDialog>
    </>
  );
}
