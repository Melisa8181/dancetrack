import type { ActivityType, Role } from '../api/types';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CLASS: 'Clase', REHEARSAL: 'Ensayo', TECHNIQUE: 'Técnica', CROSS_TRAINING: 'Entrenamiento complementario', OTHER: 'Otro',
};
export const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS) as [ActivityType, string][];

export const ENERGY_LABELS: Record<number, string> = { 1: 'Muy baja', 2: 'Baja', 3: 'Media', 4: 'Alta', 5: 'Muy alta' };
export const ROLE_LABELS: Record<Role, string> = { DANCER: 'Bailarín', TEACHER: 'Profesor', ADMIN: 'Administrador' };

const utc = { timeZone: 'UTC' } as const;
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { ...utc, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(asDate(iso));
export const formatShortDate = (iso: string) => new Intl.DateTimeFormat('es-AR', { ...utc, day: 'numeric', month: 'short' }).format(asDate(iso));
export const weekdayShort = (iso: string) => new Intl.DateTimeFormat('es-AR', { ...utc, weekday: 'short' }).format(asDate(iso)).replace('.', '');
export const weekdayLong = (iso: string) => new Intl.DateTimeFormat('es-AR', { ...utc, weekday: 'long' }).format(asDate(iso));

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const formatDecimal = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n);

export const signed = (n: number) => (n > 0 ? `+${formatDecimal(n)}` : formatDecimal(n));

/** Fecha local del navegador en formato AAAA-MM-DD (solo para valores por defecto y límites del formulario). */
export function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
