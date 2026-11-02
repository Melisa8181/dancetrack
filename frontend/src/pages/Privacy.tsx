import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { DancerLink, Permissions } from '../api/types';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Loading, PageHeader, useToast } from '../components/ui';

const OPTIONS: { key: keyof Permissions; label: string; help: string; needsHistory?: boolean }[] = [
  { key: 'shareSummary', label: 'Resumen de actividad', help: 'Sesiones, tiempo total, intensidad promedio y actividad por día.' },
  { key: 'shareHistory', label: 'Listado de entrenamientos', help: 'Fecha, disciplina, tipo de actividad, duración e intensidad de cada sesión.' },
  { key: 'shareEnergyRest', label: 'Energía y descanso', help: 'Nivel de energía y horas de descanso en cada sesión.', needsHistory: true },
  { key: 'shareDiscomfort', label: 'Molestias', help: 'Si hubo molestias y su descripción. Es información sensible.', needsHistory: true },
  { key: 'shareNotes', label: 'Observaciones personales', help: 'Tus notas privadas de cada sesión.', needsHistory: true },
];

function LinkCard({ link, onChanged }: { link: DancerLink; onChanged: () => void }) {
  const toast = useToast();
  const [perms, setPerms] = useState<Permissions>(link.permissions);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const dirty = JSON.stringify(perms) !== JSON.stringify(link.permissions);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast('success', ok); onChanged(); }
    catch (e) { toast('error', e instanceof ApiError ? e.message : 'No se pudo completar la acción.'); }
    finally { setBusy(false); setConfirmRevoke(false); }
  }

  if (link.status === 'PENDING') {
    return (
      <li className="rounded-xl border border-clay-300 bg-clay-50 p-5">
        <p><strong>{link.teacher.name}</strong> quiere vincularse con vos como profesor. <Badge tone="warn">Pendiente</Badge></p>
        <p className="mt-1 text-sm text-mute">Si aceptás, no verá nada hasta que le autorices información específica.</p>
        <div className="mt-4 flex gap-3">
          <Button loading={busy} onClick={() => run(() => api.post(`/links/${link.id}/accept`), 'Vínculo aceptado. Todo sigue privado.')}>Aceptar</Button>
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.post(`/links/${link.id}/reject`), 'Solicitud rechazada.')}>Rechazar</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold">{link.teacher.name} <Badge tone="ok">Vinculado</Badge></p>
        <Button variant="danger" disabled={busy} onClick={() => setConfirmRevoke(true)}>Revocar acceso</Button>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Qué puede ver {link.teacher.name}</legend>
        <ul className="mt-2 space-y-3">
          {OPTIONS.map((o) => {
            const disabled = Boolean(o.needsHistory && !perms.shareHistory);
            return (
              <li key={o.key}>
                <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : ''}`}>
                  <input type="checkbox" className="mt-1 size-5 accent-wine-600" disabled={disabled} checked={perms[o.key] && !disabled}
                    onChange={(e) => setPerms((p) => ({ ...p, [o.key]: e.target.checked }))} />
                  <span><span className="block font-semibold">{o.label}</span><span className="block text-sm text-mute">{o.help}{disabled && ' Requiere compartir el listado.'}</span></span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="mt-4"><Button loading={busy} disabled={!dirty} onClick={() => run(() => api.put(`/links/${link.id}/permissions`, perms), 'Permisos guardados.')}>Guardar permisos</Button></div>

      <ConfirmDialog open={confirmRevoke} title="¿Revocar el acceso?" confirmLabel="Revocar" danger loading={busy}
        onConfirm={() => run(() => api.post(`/links/${link.id}/revoke`), 'Acceso revocado.')} onCancel={() => setConfirmRevoke(false)}>
        {link.teacher.name} dejará de ver tu información y se restablecerán todos los permisos a privado. Un administrador deberá volver a vincularlos si querés retomar.
      </ConfirmDialog>
    </li>
  );
}

export default function Privacy() {
  const [links, setLinks] = useState<DancerLink[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setLinks((await api.get<{ items: DancerLink[] }>('/links')).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudieron cargar tus vínculos.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader title="Privacidad">Vos decidís qué ve cada profesor. Por defecto, no ve nada: ni tus molestias ni tus observaciones.</PageHeader>
      {error && <div className="space-y-3"><Alert>{error}</Alert><Button onClick={load}>Reintentar</Button></div>}
      {!links && !error && <Loading />}
      {links && links.length === 0 && (
        <EmptyState title="No tenés profesores vinculados">Cuando un administrador te asocie con un profesor, vas a ver la solicitud acá y podrás aceptarla o rechazarla.</EmptyState>
      )}
      {links && links.length > 0 && <ul className="max-w-3xl space-y-4">{links.map((l) => <LinkCard key={`${l.id}-${l.status}`} link={l} onChanged={load} />)}</ul>}
    </>
  );
}
