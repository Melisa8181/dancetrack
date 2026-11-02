import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { weekSummary } from '../services/dashboard';
import { weekQuerySchema } from '../validation/schemas';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requireRole('DANCER'));

dashboardRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const { weekOffset } = weekQuerySchema.parse(req.query);
  const [summary, totalRecords] = await Promise.all([
    weekSummary(me.id, weekOffset),
    prisma.training.count({ where: { userId: me.id } }),
  ]);
  res.json({ ...summary, totalRecords });
});
