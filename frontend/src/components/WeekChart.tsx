import type { WeekSummary } from '../api/types';
import { formatMinutes, formatShortDate, weekdayShort } from '../lib/format';

/** Etiqueta corta para pantallas angostas: 45m, 1h15, 2h. */
const compact = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`);

/** Gráfico semanal accesible: barras proporcionales a los minutos de cada día + tabla equivalente para lectores de pantalla. */
export function WeekChart({ byDay, today }: { byDay: WeekSummary['byDay']; today: string }) {
  const max = Math.max(...byDay.map((d) => d.minutes), 1);
  const empty = byDay.every((d) => d.minutes === 0);
  return (
    <figure>
      <div className={`flex items-end gap-2 pt-6 sm:gap-4 ${empty ? 'h-32' : 'h-56'}`} role="img" aria-label="Minutos entrenados por día de la semana. Los datos están en la tabla siguiente.">
        {byDay.map((d) => {
          const pct = d.minutes ? Math.max((d.minutes / max) * 100, 6) : 0;
          return (
            <div key={d.date} className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-lg px-0.5 pb-1 ${d.date === today ? 'bg-clay-50 ring-1 ring-clay-200' : ''}`}>
              <div className="flex w-full flex-1 items-end justify-center">
                {d.minutes ? (
                  <div className="relative w-full max-w-12 rounded-t-full bg-wine-600" style={{ height: `${pct}%` }} title={formatMinutes(d.minutes)}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] font-semibold leading-none text-wine-800 sm:text-xs">
                      <span className="sm:hidden">{compact(d.minutes)}</span>
                      <span className="hidden sm:inline">{formatMinutes(d.minutes)}</span>
                    </span>
                  </div>
                ) : (
                  <div className="h-1 w-full max-w-12 rounded-full bg-line-strong" />
                )}
              </div>
              <span className={`text-xs ${d.date === today ? 'font-bold text-clay-700 underline decoration-clay-500 decoration-2 underline-offset-4' : 'text-mute'}`} aria-current={d.date === today ? 'date' : undefined}>{weekdayShort(d.date)}</span>
            </div>
          );
        })}
      </div>
      {empty && <figcaption className="mt-3 text-sm text-mute">Sin actividad registrada en esta semana.</figcaption>}
      <table className="sr-only">
        <caption>Actividad por día</caption>
        <thead><tr><th>Día</th><th>Sesiones</th><th>Minutos</th></tr></thead>
        <tbody>
          {byDay.map((d) => (
            <tr key={d.date}><td>{weekdayShort(d.date)} {formatShortDate(d.date)}</td><td>{d.sessions}</td><td>{d.minutes}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
