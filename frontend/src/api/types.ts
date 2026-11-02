export type Role = 'DANCER' | 'TEACHER' | 'ADMIN';
export type ActivityType = 'CLASS' | 'REHEARSAL' | 'TECHNIQUE' | 'CROSS_TRAINING' | 'OTHER';
export type LinkStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';

export interface Discipline { id: number; name: string }
export interface AdminDiscipline extends Discipline { isActive: boolean }

export interface User {
  id: string; name: string; email: string; role: Role; isActive: boolean;
  bio: string | null; mainDisciplineId: number | null; mainDiscipline: Discipline | null;
}

export interface Training {
  id: string; date: string; disciplineId: number; discipline: Discipline;
  activityType: ActivityType; durationMinutes: number; intensity: number; energyLevel: number;
  restHours: number | null; hasDiscomfort: boolean; discomfortDescription: string | null; notes: string | null;
}

export interface TrainingInput {
  date: string; disciplineId: number; activityType: ActivityType; durationMinutes: number;
  intensity: number; energyLevel: number; restHours: number | null;
  hasDiscomfort: boolean; discomfortDescription: string | null; notes: string | null;
}

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface PeriodStats { weekStart: string; weekEnd: string; sessions: number; totalMinutes: number; averageIntensity: number | null }
export interface WeekSummary {
  today: string; weekOffset: number; current: PeriodStats; previous: PeriodStats;
  comparison: { sessionsDiff: number; minutesDiff: number; intensityDiff: number | null } | null;
  byDay: { date: string; sessions: number; minutes: number }[];
}
export interface DashboardData extends WeekSummary { totalRecords: number }

export interface Permissions {
  shareSummary: boolean; shareHistory: boolean; shareEnergyRest: boolean; shareDiscomfort: boolean; shareNotes: boolean;
}
export interface DancerLink { id: string; status: LinkStatus; teacher: { id: string; name: string }; permissions: Permissions }

export interface TeacherDancer { id: string; name: string; mainDiscipline: string | null; sharesSummary: boolean; sharesHistory: boolean }
export interface TeacherDancerSummary {
  dancer: { id: string; name: string; mainDiscipline: string | null }; permissions: Permissions; summary: WeekSummary | null;
}
export interface SharedTraining {
  id: string; date: string; activityType: ActivityType; durationMinutes: number; intensity: number;
  discipline: Discipline; energyLevel?: number; restHours?: number | null;
  hasDiscomfort?: boolean; discomfortDescription?: string | null; notes?: string | null;
}

export interface AdminUser { id: string; name: string; email: string; role: Role; isActive: boolean; createdAt: string }
export interface AdminLink {
  id: string; status: LinkStatus; createdAt: string;
  teacher: { id: string; name: string; email: string }; dancer: { id: string; name: string; email: string };
}
