import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { TeacherDancer } from '../api/types';
import { Alert, Badge, EmptyState, Loading, PageHeader } from '../components/ui';

export default function TeacherHome() {
  const [items, setItems] = useState<TeacherDancer[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<{ items: TeacherDancer[] }>('/teacher/dancers').then((r) => setItems(r.items)).catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la lista.'));
  }, []);

  return (
    <>
      <PageHeader title="Mis bailarines">Bailarines que aceptaron vincularse con vos. Solo ves lo que cada uno autorizó compartir.</PageHeader>
      {error && <Alert>{error}</Alert>}
      {!items && !error && <Loading />}
      {items && items.length === 0 && <EmptyState title="Todavía no tenés bailarines vinculados">Un administrador crea la vinculación y cada bailarín debe aceptarla antes de que aparezca acá.</EmptyState>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden surface">
          {items.map((d) => (
            <li key={d.id}>
              <Link to={`/profesor/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-wine-50">
                <span><span className="block font-display text-lg font-semibold">{d.name}</span><span className="text-sm text-mute">{d.mainDiscipline ?? 'Disciplina sin especificar'}</span></span>
                <span className="flex gap-2">
                  <Badge tone={d.sharesSummary ? 'ok' : 'neutral'}>{d.sharesSummary ? 'Resumen compartido' : 'Resumen no compartido'}</Badge>
                  <Badge tone={d.sharesHistory ? 'ok' : 'neutral'}>{d.sharesHistory ? 'Historial compartido' : 'Historial no compartido'}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
