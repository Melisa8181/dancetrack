import type { Discipline, Training, User } from '@prisma/client';
import { fromDbDate } from './dates';

type UserWithDiscipline = User & { mainDiscipline?: Discipline | null };

/** Nunca incluye passwordHash. */
export function serializeUser(u: UserWithDiscipline) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    bio: u.bio,
    mainDisciplineId: u.mainDisciplineId,
    mainDiscipline: u.mainDiscipline ? { id: u.mainDiscipline.id, name: u.mainDiscipline.name } : null,
    createdAt: u.createdAt,
  };
}

type TrainingWithDiscipline = Training & { discipline: Discipline };

/** Representación completa: solo se usa para el DUEÑO del registro. */
export function serializeTraining(t: TrainingWithDiscipline) {
  return {
    id: t.id,
    date: fromDbDate(t.date),
    disciplineId: t.disciplineId,
    discipline: { id: t.discipline.id, name: t.discipline.name },
    activityType: t.activityType,
    durationMinutes: t.durationMinutes,
    intensity: t.intensity,
    energyLevel: t.energyLevel,
    restHours: t.restHours,
    hasDiscomfort: t.hasDiscomfort,
    discomfortDescription: t.discomfortDescription,
    notes: t.notes,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
