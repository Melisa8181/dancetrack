import type { TrainingInput } from '../api/types';
import { localToday } from './format';

export type FieldErrors = Partial<Record<string, string>>;

// Espejo de las reglas del servidor para dar feedback inmediato. El servidor sigue siendo la autoridad.
export function validateTraining(t: Omit<TrainingInput, 'disciplineId'> & { disciplineId: number | null }): FieldErrors {
  const e: FieldErrors = {};
  if (!t.date) e.date = 'La fecha es obligatoria.';
  else if (t.date > localToday()) e.date = 'La fecha no puede ser futura.';
  else if (t.date < '2000-01-01') e.date = 'La fecha es demasiado antigua.';
  if (!t.disciplineId) e.disciplineId = 'Elegí una disciplina.';
  if (!Number.isInteger(t.durationMinutes) || t.durationMinutes < 1) e.durationMinutes = 'La duración debe ser un número entero mayor que cero.';
  else if (t.durationMinutes > 600) e.durationMinutes = 'La duración no puede superar los 600 minutos.';
  if (!Number.isInteger(t.intensity) || t.intensity < 1 || t.intensity > 10) e.intensity = 'La intensidad debe estar entre 1 y 10.';
  if (!Number.isInteger(t.energyLevel) || t.energyLevel < 1 || t.energyLevel > 5) e.energyLevel = 'Elegí un nivel de energía.';
  if (t.restHours !== null && (Number.isNaN(t.restHours) || t.restHours < 0 || t.restHours > 24)) e.restHours = 'Las horas de descanso deben estar entre 0 y 24.';
  if (t.hasDiscomfort && (t.discomfortDescription?.length ?? 0) > 500) e.discomfortDescription = 'Máximo 500 caracteres.';
  if ((t.notes?.length ?? 0) > 2000) e.notes = 'Máximo 2000 caracteres.';
  return e;
}

export function validatePassword(p: string): string | undefined {
  if (p.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (p.length > 72) return 'No puede superar los 72 caracteres.';
  if (!/[A-Za-z]/.test(p)) return 'Debe incluir al menos una letra.';
  if (!/\d/.test(p)) return 'Debe incluir al menos un número.';
  return undefined;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
