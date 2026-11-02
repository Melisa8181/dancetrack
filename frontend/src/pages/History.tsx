import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, qs } from '../api/client';
import type { Discipline, Paged, Training } from '../api/types';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Loading, PageHeader, SelectField, TextField, useToast, buttonClass } from '../components/ui';
import { ACTIVITY_LABELS, ENERGY_LABELS, formatDate, formatMinutes } from '../lib/format';

const PAGE_SIZE = 10;

export default function History() {
  const toast = useToast();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filters, setFilters] = useState({ from: '', to: '', disciplineId: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Training> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Training | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { api.get<{ items: Discipline[] }>('/disciplines').then((r) => setDisciplines(r.items)).catch(() => undefined); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get<Paged<Training>>(`/trainings${qs({ ...filters, page, pageSize: PAGE_SIZE })}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const hasFilters = Boolean(filters.from || filters.to || filters.disciplineId);
  const setFilter = (k: keyof typeof filters, v: string) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/trainings/${toDelete.id}`);
      toast('success', 'Entrenamiento eliminado.');
      setToDelete(null);
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Historial" actions={<Link to="/entrenamientos/nuevo" className={buttonClass('primary')}>Registrar entrenamiento</Link>}>
        Tus entrenamientos, del más reciente al más antiguo.
      </PageHeader>

      <form className="surface mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:items-end" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <TextField label="Desde" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <TextField label="Hasta" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} error={invalidRange ? '"Desde" no puede ser posterior a "Hasta".' : undefined} />
        <div className="col-span-2 sm:col-span-1">
          <SelectField label="Disciplina" value={filters.disciplineId} onChange={(e) => setFilter('disciplineId', e.target.value)}>
            <option value="">Todas</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        </div>
        <Button variant="secondary" className="col-span-2 sm:col-span-1" disabled={!hasFilters} onClick={() => { setPage(1); setFilters({ from: '', to: '', disciplineId: '' }); }}>Quitar filtros</Button>
      </form>

      {error && <div className="mb-4 space-y-3"><Alert>{error}</Alert><Button onClick={load}>Reintentar</Button></div>}
      {loading && !data && <Loading />}

      {data && data.items.length === 0 && !error && (
        hasFilters
          ? <EmptyState title="No hay entrenamientos con esos filtros">Probá con otro período o disciplina.</EmptyState>
          : <EmptyState title="Tu historial está vacío" action={<Link to="/entrenamientos/nuevo" className={buttonClass('primary')}>Registrar el primero</Link>}>Cada entrenamiento que registres aparecerá acá.</EmptyState>
      )}

      {data && data.items.length > 0 && (
        <div className={loading ? 'opacity-60' : ''}>
          <ul className="divide-y divide-line overflow-hidden surface">
            {data.items.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-wine-800 first-letter:uppercase">{formatDate(t.date)}</p>
                  <p className="text-sm">{t.discipline.name} · {ACTIVITY_LABELS[t.activityType]} · {formatMinutes(t.durationMinutes)}</p>
                  <p className="mt-1 text-sm text-mute">Intensidad {t.intensity}/10 · Energía {ENERGY_LABELS[t.energyLevel]?.toLowerCase()}{t.restHours !== null && ` · Descanso ${t.restHours} h`}</p>
                  {t.hasDiscomfort && <p className="mt-2 text-sm"><Badge tone="warn">Molestias</Badge> {t.discomfortDescription}</p>}
                  {t.notes && <p className="mt-2 max-w-prose text-sm text-mute">{t.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/entrenamientos/${t.id}/editar`} aria-label={`Editar el entrenamiento del ${formatDate(t.date)}`} className={buttonClass('secondary')}>Editar</Link>
                  <Button variant="danger" aria-label={`Eliminar el entrenamiento del ${formatDate(t.date)}`} onClick={() => setToDelete(t)}>Eliminar</Button>
                </div>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <p className="text-sm text-mute">Página {page} de {totalPages} · {data.total} {data.total === 1 ? 'registro' : 'registros'}</p>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </nav>
        </div>
      )}

      <ConfirmDialog open={toDelete !== null} title="¿Eliminar este entrenamiento?" confirmLabel="Eliminar" danger loading={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
        {toDelete && <>Se eliminará de forma permanente la sesión del {formatDate(toDelete.date)} ({toDelete.discipline.name}). Esta acción no se puede deshacer.</>}
      </ConfirmDialog>
    </>
  );
}
