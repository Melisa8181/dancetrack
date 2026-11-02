import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export const disciplinesRouter = Router();

// Lista de disciplinas activas (para formularios). La gestión está en /api/admin/disciplines.
disciplinesRouter.get('/', authenticate, async (_req, res) => {
  const items = await prisma.discipline.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  res.json({ items });
});
