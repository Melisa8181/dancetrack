import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { DashboardData } from '../api/types';
import { WeekNav, WeekSummaryView } from '../components/WeekSummaryView';
import { Alert, Button, EmptyState, Loading, PageHeader, buttonClass } from '../components/ui';

export default function Dashboard() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get<DashboardData>(`/dashboard?weekOffset=${offset}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <Loading label="Calculando tu semana…" />;
  if (error && !data) return <div className="space-y-4"><Alert>{error}</Alert><Button onClick={load}>Reintentar</Button></div>;
  if (!data) return null;

  if (data.totalRecords === 0) {
    return (
      <>
        <PageHeader title="Tu panel" />
        <EmptyState title="Todavía no registraste entrenamientos"
          action={<Link to="/entrenamientos/nuevo" className={buttonClass('primary')}>Registrar mi primer entrenamiento</Link>}>
          Cuando cargues tu primera sesión vas a ver acá las sesiones de la semana, el tiempo total, la intensidad promedio y la actividad por día.
        </EmptyState>
      </>
    );
  }

  const { current } = data;
  return (
    <>
      <PageHeader title="Tu panel" actions={<Link to="/entrenamientos/nuevo" className={buttonClass('primary')}>Registrar entrenamiento</Link>}>
        Resumen de tus registros por semana, de lunes a domingo.
      </PageHeader>

      <div className="mb-6">
        <WeekNav start={current.weekStart} end={current.weekEnd} isCurrent={offset === 0} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => Math.min(o + 1, 0))} />
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {current.sessions === 0 && (
        <div className="mb-4"><Alert kind="info">No registraste sesiones en esta semana.{offset === 0 && <> Podés <Link className="font-semibold underline" to="/entrenamientos/nuevo">registrar una</Link>.</>}</Alert></div>
      )}
      <div className={loading ? 'opacity-60' : ''}><WeekSummaryView data={data} /></div>

      <details className="mt-6 surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">¿Cómo se calculan estos indicadores?</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-mute">
          <li><strong>Sesiones:</strong> cantidad de entrenamientos registrados en la semana (lunes a domingo).</li>
          <li><strong>Tiempo total:</strong> suma de los minutos de cada sesión.</li>
          <li><strong>Intensidad promedio:</strong> promedio simple de la intensidad percibida (1 a 10) de cada sesión.</li>
          <li><strong>Comparación:</strong> diferencia con la semana anterior; solo aparece si esa semana tuvo sesiones.</li>
        </ul>
      </details>
    </>
  );
}
