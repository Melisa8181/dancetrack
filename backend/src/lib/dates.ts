// Todas las fechas "de calendario" se manejan como texto YYYY-MM-DD para evitar errores de zona horaria.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Lunes de la semana a la que pertenece la fecha (semana lunes-domingo). */
export function mondayOf(iso: string): string {
  const d = toDbDate(iso);
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  return addDays(iso, -dow);
}
