import { z } from 'zod';
import { env } from '../config/env';
import { isValidIsoDate, todayInTz } from '../lib/dates';

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} es obligatorio.` })
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar los ${max} caracteres.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar los ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const isoDate = z
  .string({ required_error: 'La fecha es obligatoria.' })
  .refine(isValidIsoDate, 'La fecha debe tener formato AAAA-MM-DD y ser válida.');

export const emailSchema = z
  .string({ required_error: 'El correo es obligatorio.' })
  .trim()
  .toLowerCase()
  .email('Ingresá un correo válido.')
  .max(254, 'El correo es demasiado largo.');

// bcrypt solo considera los primeros 72 bytes: limitamos para no truncar en silencio.
export const passwordSchema = z
  .string({ required_error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

// .strict(): si alguien envía campos extra (por ejemplo "role") la petición se rechaza.
export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'El nombre'),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ required_error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.').max(200),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: trimmed(2, 80, 'El nombre').optional(),
    email: emailSchema.optional(),
    bio: optionalText(500, 'La descripción').optional(),
    mainDisciplineId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Ingresá tu contraseña actual.'), newPassword: passwordSchema })
  .strict();

export const ACTIVITY_TYPES = ['CLASS', 'REHEARSAL', 'TECHNIQUE', 'CROSS_TRAINING', 'OTHER'] as const;

export const trainingSchema = z
  .object({
    date: isoDate
      .refine((d) => d >= '2000-01-01', 'La fecha es demasiado antigua.')
      .refine((d) => d <= todayInTz(env.APP_TIMEZONE), 'La fecha no puede ser futura.'),
    disciplineId: z.number({ required_error: 'Elegí una disciplina.', invalid_type_error: 'Elegí una disciplina.' }).int().positive(),
    activityType: z.enum(ACTIVITY_TYPES, { errorMap: () => ({ message: 'Elegí un tipo de actividad válido.' }) }),
    durationMinutes: z
      .number({ required_error: 'La duración es obligatoria.', invalid_type_error: 'La duración debe ser un número.' })
      .int('La duración debe ser un número entero de minutos.')
      .min(1, 'La duración debe ser mayor que cero.')
      .max(600, 'La duración no puede superar los 600 minutos.'),
    intensity: z
      .number({ required_error: 'La intensidad es obligatoria.', invalid_type_error: 'La intensidad debe ser un número.' })
      .int()
      .min(1, 'La intensidad mínima es 1.')
      .max(10, 'La intensidad máxima es 10.'),
    energyLevel: z
      .number({ required_error: 'El nivel de energía es obligatorio.', invalid_type_error: 'El nivel de energía debe ser un número.' })
      .int()
      .min(1, 'El nivel de energía mínimo es 1.')
      .max(5, 'El nivel de energía máximo es 5.'),
    restHours: z
      .number({ invalid_type_error: 'Las horas de descanso deben ser un número.' })
      .min(0, 'Las horas de descanso no pueden ser negativas.')
      .max(24, 'Las horas de descanso no pueden superar 24.')
      .nullish()
      .transform((v) => v ?? null),
    hasDiscomfort: z.boolean({ required_error: 'Indicá si hubo molestias.' }),
    discomfortDescription: optionalText(500, 'La descripción de molestias'),
    notes: optionalText(2000, 'Las observaciones'),
  })
  .strict()
  .transform((t) => ({ ...t, discomfortDescription: t.hasDiscomfort ? t.discomfortDescription : null }));

export const trainingListQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  disciplineId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const weekQuerySchema = z.object({
  weekOffset: z.coerce.number().int().min(-104).max(0).default(0),
});

export const permissionsSchema = z
  .object({
    shareSummary: z.boolean(),
    shareHistory: z.boolean(),
    shareEnergyRest: z.boolean(),
    shareDiscomfort: z.boolean(),
    shareNotes: z.boolean(),
  })
  .strict();

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['DANCER', 'TEACHER', 'ADMIN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateUserSchema = z
  .object({ role: z.enum(['DANCER', 'TEACHER', 'ADMIN']).optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((v) => v.role !== undefined || v.isActive !== undefined, 'Indicá qué querés modificar.');

export const createDisciplineSchema = z.object({ name: trimmed(2, 60, 'El nombre') }).strict();
export const updateDisciplineSchema = z
  .object({ name: trimmed(2, 60, 'El nombre').optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.isActive !== undefined, 'Indicá qué querés modificar.');

export const createLinkSchema = z
  .object({ teacherId: z.string().min(1, 'Elegí un profesor.'), dancerId: z.string().min(1, 'Elegí un bailarín.') })
  .strict();
