import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { toDbDate } from '../lib/dates';
import { serializeTraining } from '../lib/serializers';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { trainingListQuerySchema, trainingSchema } from '../validation/schemas';

export const trainingsRouter = Router();
// Solo bailarines registran entrenamientos, y siempre sobre SUS propios datos.
trainingsRouter.use(authenticate, requireRole('DANCER'));

/** Busca un entrenamiento verificando la propiedad: si es ajeno, se responde 404 (no se revela su existencia). */
async function findOwned(id: string, userId: string) {
  const t = await prisma.training.findFirst({ where: { id, userId }, include: { discipline: true } });
  if (!t) throw notFound('Entrenamiento no encontrado.');
  return t;
}

async function assertDisciplineUsable(disciplineId: number, currentDisciplineId?: number) {
  if (disciplineId === currentDisciplineId) return; // permitir editar registros viejos con disciplina luego desactivada
  const d = await prisma.discipline.findFirst({ where: { id: disciplineId, isActive: true } });
  if (!d) throw badRequest('La disciplina elegida no existe o no está disponible.', 'INVALID_DISCIPLINE');
}

trainingsRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const q = trainingListQuerySchema.parse(req.query);
  if (q.from && q.to && q.from > q.to) throw badRequest('La fecha "desde" no puede ser posterior a "hasta".');
  const where: Prisma.TrainingWhereInput = {
    userId: me.id,
    ...(q.disciplineId ? { disciplineId: q.disciplineId } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: toDbDate(q.from) } : {}), ...(q.to ? { lte: toDbDate(q.to) } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.training.count({ where }),
    prisma.training.findMany({
      where,
      include: { discipline: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({ items: rows.map(serializeTraining), total, page: q.page, pageSize: q.pageSize });
});

trainingsRouter.post('/', async (req, res) => {
  const me = currentUser(req);
  const data = trainingSchema.parse(req.body);
  await assertDisciplineUsable(data.disciplineId);
  const created = await prisma.training.create({
    data: { ...data, date: toDbDate(data.date), userId: me.id },
    include: { discipline: true },
  });
  res.status(201).json({ training: serializeTraining(created) });
});

trainingsRouter.get('/:id', async (req, res) => {
  res.json({ training: serializeTraining(await findOwned(String(req.params.id), currentUser(req).id)) });
});

// Actualización completa del registro (el formulario siempre envía todos los campos).
trainingsRouter.put('/:id', async (req, res) => {
  const me = currentUser(req);
  const existing = await findOwned(String(req.params.id), me.id);
  const data = trainingSchema.parse(req.body);
  await assertDisciplineUsable(data.disciplineId, existing.disciplineId);
  const updated = await prisma.training.update({
    where: { id: existing.id },
    data: { ...data, date: toDbDate(data.date) },
    include: { discipline: true },
  });
  res.json({ training: serializeTraining(updated) });
});

trainingsRouter.delete('/:id', async (req, res) => {
  const existing = await findOwned(String(req.params.id), currentUser(req).id);
  await prisma.training.delete({ where: { id: existing.id } });
  res.status(204).end();
});
