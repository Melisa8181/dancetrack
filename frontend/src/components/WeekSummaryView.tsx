import type { WeekSummary } from '../api/types';
import { formatDecimal, formatMinutes, formatShortDate, signed } from '../lib/format';
import { Badge, cx } from './ui';
import { WeekChart } from './WeekChart';

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M12 5l-5 5 5 5' : 'M8 5l5 5-5 5'} />
    </svg>
  );
}

/** Navegador de semanas compartido por el panel del bailarín y la vista del profesor. */
export function WeekNav({ start, end, isCurrent, onPrev, onNext }: { start: string; end: string; isCurrent: boolean; onPrev: () => void; onNext: () => void }) {
  const btn = 'flex size-11 items-center justify-center text-wine-700 hover:bg-wine-50 disabled:cursor-not-allowed disabled:text-wine-200 disabled:hover:bg-transparent';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-wine-200 bg-card">
        <button type="button" className={btn} onClick={onPrev} aria-label="Ver semana anterior"><Chevron dir="left" /></button>
        <p className="flex min-w-40 items-center justify-center border-x border-wine-100 px-3 text-sm font-semibold" aria-live="polite">
          {formatShortDate(start)} al {formatShortDate(end)}
        </p>
        <button type="button" className={btn} onClick={onNext} disabled={isCurrent} aria-label="Ver semana siguiente"><Chevron dir="right" /></button>
      </div>
      {isCurrent && <Badge tone="wine">Esta semana</Badge>}
    </div>
  );
}

function Metric({ label, value, help, extra }: { label: string; value: string; help: string; extra?: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-sm font-medium text-mute">{label}</dt>
      <dd>
        <span className="block font-display text-4xl font-semibold leading-tight text-wine-800">{value}</span>
        {extra}
        <span className="mt-1 block text-xs text-mute">{help}</span>
      </dd>
    </div>
  );
}

/** Medidor de 10 tramos para la intensidad promedio. Es un refuerzo visual: el valor siempre se lee en el texto. */
function IntensityMeter({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="mt-2 flex max-w-40 gap-1" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < filled ? 'bg-clay-500' : 'bg-sand')} />)}
    </span>
  );
}

function Compare({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-sm font-medium text-mute">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/** Métricas + gráfico + comparación. Lo usan el dashboard del bailarín y el resumen que ve el profesor autorizado. */
export function WeekSummaryView({ data }: { data: WeekSummary }) {
  const { current, previous, comparison } = data;
  return (
    <div className="space-y-6">
      <dl className="surface grid divide-y divide-line overflow-hidden border-t-[3px] border-t-wine-600 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric label="Sesiones" value={String(current.sessions)} help="Registros de la semana." />
        <Metric label="Tiempo total" value={formatMinutes(current.totalMinutes)} help="Suma de la duración de las sesiones." />
        <Metric label="Intensidad promedio" value={current.averageIntensity === null ? '—' : `${formatDecimal(current.averageIntensity)} / 10`} help="Promedio simple de la intensidad percibida." extra={current.averageIntensity === null ? undefined : <IntensityMeter value={current.averageIntensity} />} />
      </dl>

      <section aria-labelledby="chart-title" className="surface p-5">
        <h2 id="chart-title" className="mb-4 text-xl">Actividad por día</h2>
        <WeekChart byDay={data.byDay} today={data.today} />
      </section>

      <section aria-labelledby="cmp-title" className="surface border-clay-200 bg-clay-50 p-5">
        <h2 id="cmp-title" className="text-xl">Comparación con la semana anterior</h2>
        {comparison ? (
          <>
            <p className="mt-1 text-sm text-mute">Semana anterior: {formatShortDate(previous.weekStart)} al {formatShortDate(previous.weekEnd)}.</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Compare label="Sesiones">{previous.sessions} → {current.sessions} <span className="font-medium text-clay-700">({signed(comparison.sessionsDiff)})</span></Compare>
              <Compare label="Tiempo">
                {formatMinutes(previous.totalMinutes)} → {formatMinutes(current.totalMinutes)}{' '}
                <span className="font-medium text-clay-700">({comparison.minutesDiff > 0 ? '+' : ''}{formatMinutes(Math.abs(comparison.minutesDiff))}{comparison.minutesDiff < 0 ? ' menos' : ''})</span>
              </Compare>
              <Compare label="Intensidad">
                {comparison.intensityDiff === null ? <span className="font-normal text-mute">sin datos para comparar</span> : <span>{signed(comparison.intensityDiff)} puntos</span>}
              </Compare>
            </dl>
          </>
        ) : (
          <p className="mt-1 text-mute">Todavía no hay sesiones en la semana anterior para comparar.</p>
        )}
      </section>
    </div>
  );
}
