import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, qs } from '../api/client';
import type { Paged, SharedTraining, TeacherDancerSummary } from '../api/types';
import { WeekNav, WeekSummaryView } from '../components/WeekSummaryView';
import { Alert, Badge, Button, EmptyState, Loading, PageHeader } from '../components/ui';
import { ACTIVITY_LABELS, ENERGY_LABELS, formatDate, formatMinutes } from '../lib/format';

function NotShared({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line-strong bg-sand/60 p-5 text-mute"><Badge>Sin permiso</Badge> <span className="ml-1">{children}</span></div>;
}

export default function TeacherDancerPage() {
  const { dancerId } = useParams();
  const [offset, setOffset] = useState(0);
  const [info, setInfo] = useState<TeacherDancerSummary | null>(null);
  const [list, setList] = useState<Paged<SharedTraining> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    try { setInfo(await api.get<TeacherDancerSummary>(`/teacher/dancers/${dancerId}/summary?weekOffset=${offset}`)); setError(''); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar el resumen.'); }
  }, [dancerId, offset]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const canSeeHistory = info?.permissions.shareHistory ?? false;
  useEffect(() => {
    if (!canSeeHistory) { setList(null); return; }
    api.get<Paged<SharedTraining>>(`/teacher/dancers/${dancerId}/trainings${qs({ page, pageSize: 10 })}`).then(setList).catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el historial.'));
  }, [canSeeHistory, dancerId, page]);

  if (error && !info) return <div className="space-y-4"><Alert>{error}</Alert><Link className="font-semibold text-wine-700 underline" to="/profesor">Volver a mis bailarines</Link></div>;
  if (!info) return <Loading />;
  const p = info.permissions;
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <>
      <p className="mb-2"><Link className="text-sm font-semibold text-wine-700 underline" to="/profesor">Volver a mis bailarines</Link></p>
      <PageHeader title={info.dancer.name}>{info.dancer.mainDiscipline ?? 'Disciplina sin especificar'}</PageHeader>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <section aria-labelledby="share" className="mb-8 surface p-5">
        <h2 id="share" className="text-lg">Lo que este bailarín comparte con vos</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {([['shareSummary', 'Resumen'], ['shareHistory', 'Listado'], ['shareEnergyRest', 'Energía y descanso'], ['shareDiscomfort', 'Molestias'], ['shareNotes', 'Observaciones']] as const).map(([k, l]) => (
            <li key={k}><Badge tone={p[k] ? 'ok' : 'neutral'}>{l}: {p[k] ? 'compartido' : 'no compartido'}</Badge></li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 text-2xl">Resumen de actividad</h2>
      {info.summary ? (
        <>
          <div className="mb-4">
            <WeekNav start={info.summary.current.weekStart} end={info.summary.current.weekEnd} isCurrent={offset === 0} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => Math.min(o + 1, 0))} />
          </div>
          <WeekSummaryView data={info.summary} />
        </>
      ) : <NotShared>{info.dancer.name} no compartió su resumen de actividad.</NotShared>}

      <h2 className="mb-3 mt-10 text-2xl">Entrenamientos</h2>
      {!canSeeHistory && <NotShared>{info.dancer.name} no compartió el listado de entrenamientos.</NotShared>}
      {canSeeHistory && !list && <Loading />}
      {list && list.items.length === 0 && <EmptyState title="Sin entrenamientos registrados" />}
      {list && list.items.length > 0 && (
        <>
          <ul className="divide-y divide-line overflow-hidden surface">
            {list.items.map((t) => (
              <li key={t.id} className="p-4">
                <p className="font-display text-lg font-semibold text-wine-800 first-letter:uppercase">{formatDate(t.date)}</p>
                <p className="text-sm">{t.discipline.name} · {ACTIVITY_LABELS[t.activityType]} · {formatMinutes(t.durationMinutes)} · Intensidad {t.intensity}/10</p>
                <ul className="mt-2 space-y-1 text-sm text-mute">
                  <li>{p.shareEnergyRest ? <>Energía {t.energyLevel ? ENERGY_LABELS[t.energyLevel]?.toLowerCase() : '—'}{t.restHours != null && ` · Descanso ${t.restHours} h`}</> : <Badge>Energía y descanso: sin permiso</Badge>}</li>
                  <li>{p.shareDiscomfort ? (t.hasDiscomfort ? <><Badge tone="warn">Molestias</Badge> {t.discomfortDescription}</> : 'Sin molestias') : <Badge>Molestias: sin permiso</Badge>}</li>
                  <li>{p.shareNotes ? (t.notes || 'Sin observaciones') : <Badge>Observaciones: sin permiso</Badge>}</li>
                </ul>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <p className="text-sm text-mute">Página {page} de {totalPages}</p>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </nav>
        </>
      )}
    </>
  );
}
