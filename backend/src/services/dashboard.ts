import { prisma } from '../lib/prisma';
import { addDays, fromDbDate, mondayOf, toDbDate, todayInTz } from '../lib/dates';
import { env } from '../config/env';

interface PeriodStats {
  weekStart: string;
  weekEnd: string;
  sessions: number;
  totalMinutes: number;
  /** Promedio simple de la intensidad percibida de las sesiones (1 decimal). null si no hay sesiones. */
  averageIntensity: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Definiciones:
 *  - Semana: lunes a domingo.
 *  - sessions: cantidad de registros de entrenamiento de la semana.
 *  - totalMinutes: suma de durationMinutes.
 *  - averageIntensity: promedio simple de la intensidad de cada sesión.
 *  - byDay: sesiones y minutos para cada uno de los 7 días (incluye días con 0).
 *  - comparison: diferencia con la semana anterior; solo existe si esa semana tuvo sesiones.
 */
export async function weekSummary(userId: string, weekOffset: number) {
  const today = todayInTz(env.APP_TIMEZONE);
  const currentStart = addDays(mondayOf(today), weekOffset * 7);
  const previousStart = addDays(currentStart, -7);
  const currentEnd = addDays(currentStart, 6);

  const rows = await prisma.training.findMany({
    where: { userId, date: { gte: toDbDate(previousStart), lte: toDbDate(currentEnd) } },
    select: { date: true, durationMinutes: true, intensity: true },
  });

  const mapped = rows.map((r) => ({ date: fromDbDate(r.date), minutes: r.durationMinutes, intensity: r.intensity }));

  const stats = (start: string): PeriodStats => {
    const end = addDays(start, 6);
    const inRange = mapped.filter((r) => r.date >= start && r.date <= end);
    const sessions = inRange.length;
    const totalMinutes = inRange.reduce((acc, r) => acc + r.minutes, 0);
    const averageIntensity = sessions ? round1(inRange.reduce((acc, r) => acc + r.intensity, 0) / sessions) : null;
    return { weekStart: start, weekEnd: end, sessions, totalMinutes, averageIntensity };
  };

  const current = stats(currentStart);
  const previous = stats(previousStart);

  const byDay = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentStart, i);
    const day = mapped.filter((r) => r.date === date);
    return { date, sessions: day.length, minutes: day.reduce((acc, r) => acc + r.minutes, 0) };
  });

  const comparison =
    previous.sessions > 0
      ? {
          sessionsDiff: current.sessions - previous.sessions,
          minutesDiff: current.totalMinutes - previous.totalMinutes,
          intensityDiff:
            current.averageIntensity !== null && previous.averageIntensity !== null
              ? round1(current.averageIntensity - previous.averageIntensity)
              : null,
        }
      : null;

  return { today, weekOffset, current, previous, comparison, byDay };
}
