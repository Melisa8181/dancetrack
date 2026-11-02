import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { fromDbDate, toDbDate } from '../lib/dates';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { weekSummary } from '../services/dashboard';
import { trainingListQuerySchema, weekQuerySchema } from '../validation/schemas';

export const teacherRouter = Router();
// Solo lectura: el profesor no tiene ningún endpoint para crear, editar o borrar entrenamientos.
teacherRouter.use(authenticate, requireRole('TEACHER'));

/** Devuelve el vínculo ACEPTADO entre este profesor y el bailarín; si no existe, 404. */
async function acceptedLink(teacherId: string, dancerId: string) {
  const link = await prisma.teacherLink.findFirst({
    where: { teacherId, dancerId, status: 'ACCEPTED', dancer: { isActive: true, role: 'DANCER' } },
    include: { dancer: { select: { id: true, name: true, mainDiscipline: { select: { name: true } } } }, permissions: true },
  });
  if (!link) throw notFound('Bailarín no encontrado entre tus vínculos.');
  const p = link.permissions;
  return {
    dancer: { id: link.dancer.id, name: link.dancer.name, mainDiscipline: link.dancer.mainDiscipline?.name ?? null },
    permissions: {
      shareSummary: p?.shareSummary ?? false,
      shareHistory: p?.shareHistory ?? false,
      shareEnergyRest: p?.shareEnergyRest ?? false,
      shareDiscomfort: p?.shareDiscomfort ?? false,
      shareNotes: p?.shareNotes ?? false,
    },
  };
}

teacherRouter.get('/dancers', async (req, res) => {
  const links = await prisma.teacherLink.findMany({
    where: { teacherId: currentUser(req).id, status: 'ACCEPTED', dancer: { isActive: true } },
    include: { dancer: { select: { id: true, name: true, mainDiscipline: { select: { name: true } } } }, permissions: true },
    orderBy: { dancer: { name: 'asc' } },
  });
  res.json({
    items: links.map((l) => ({
      id: l.dancer.id,
      name: l.dancer.name,
      mainDiscipline: l.dancer.mainDiscipline?.name ?? null,
      sharesSummary: l.permissions?.shareSummary ?? false,
      sharesHistory: l.permissions?.shareHistory ?? false,
    })),
  });
});

teacherRouter.get('/dancers/:dancerId/summary', async (req, res) => {
  const { dancer, permissions } = await acceptedLink(currentUser(req).id, String(req.params.dancerId));
  const { weekOffset } = weekQuerySchema.parse(req.query);
  // Si el bailarín no compartió el resumen, NO se calcula ni se envía nada.
  const summary = permissions.shareSummary ? await weekSummary(dancer.id, weekOffset) : null;
  res.json({ dancer, permissions, summary });
});

teacherRouter.get('/dancers/:dancerId/trainings', async (req, res) => {
  const { dancer, permissions } = await acceptedLink(currentUser(req).id, String(req.params.dancerId));
  if (!permissions.shareHistory) throw forbidden('Este bailarín no compartió su historial con vos.', 'NOT_SHARED');
  const q = trainingListQuerySchema.parse(req.query);
  if (q.from && q.to && q.from > q.to) throw badRequest('La fecha "desde" no puede ser posterior a "hasta".');
  const where: Prisma.TrainingWhereInput = {
    userId: dancer.id,
    ...(q.disciplineId ? { disciplineId: q.disciplineId } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: toDbDate(q.from) } : {}), ...(q.to ? { lte: toDbDate(q.to) } : {}) } } : {}),
  };
  // Lista blanca: los campos privados ni siquiera se leen de la base si no hay permiso.
  const select = {
    id: true, date: true, activityType: true, durationMinutes: true, intensity: true,
    discipline: { select: { id: true, name: true } },
    ...(permissions.shareEnergyRest ? { energyLevel: true, restHours: true } : {}),
    ...(permissions.shareDiscomfort ? { hasDiscomfort: true, discomfortDescription: true } : {}),
    ...(permissions.shareNotes ? { notes: true } : {}),
  } satisfies Prisma.TrainingSelect;

  const [total, rows] = await Promise.all([
    prisma.training.count({ where }),
    prisma.training.findMany({ where, select, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({
    permissions,
    items: rows.map((r) => ({ ...r, date: fromDbDate(r.date) })),
    total, page: q.page, pageSize: q.pageSize,
  });
});
