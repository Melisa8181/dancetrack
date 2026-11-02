import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/errors';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import {
  adminUpdateUserSchema, adminUsersQuerySchema, createDisciplineSchema, createLinkSchema, updateDisciplineSchema,
} from '../validation/schemas';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

// El administrador gestiona cuentas, disciplinas y vínculos. NO existe ningún endpoint
// que le devuelva entrenamientos, molestias u observaciones de otros usuarios.

const userSelect = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

adminRouter.get('/users', async (req, res) => {
  const q = adminUsersQuerySchema.parse(req.query);
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: userSelect, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize });
});

adminRouter.patch('/users/:id', async (req, res) => {
  const me = currentUser(req);
  const id = String(req.params.id);
  const data = adminUpdateUserSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('Usuario no encontrado.');

  const losesAdmin = target.role === 'ADMIN' && ((data.role !== undefined && data.role !== 'ADMIN') || data.isActive === false);
  if (id === me.id && (data.role !== undefined && data.role !== 'ADMIN' || data.isActive === false)) {
    throw badRequest('No podés quitarte tu propio rol de administrador ni desactivar tu cuenta.', 'SELF_MODIFICATION_FORBIDDEN');
  }
  if (losesAdmin) {
    const others = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: id } } });
    if (others === 0) throw conflict('Debe quedar al menos un administrador activo.', 'LAST_ADMIN');
  }

  const roleChanged = data.role !== undefined && data.role !== target.role;
  const updated = await prisma.$transaction(async (tx) => {
    if (roleChanged) {
      // Al cambiar de rol, los vínculos del rol anterior dejan de ser válidos y se revocan (permisos a privado).
      const side = target.role === 'TEACHER' ? { teacherId: id } : target.role === 'DANCER' ? { dancerId: id } : null;
      if (side) await tx.teacherLink.updateMany({ where: { ...side, status: { in: ['PENDING', 'ACCEPTED'] } }, data: { status: 'REVOKED', respondedAt: new Date() } });
    }
    return tx.user.update({ where: { id }, data, select: userSelect });
  });
  res.json({ user: updated });
});

// ---- Disciplinas
adminRouter.get('/disciplines', async (_req, res) => {
  res.json({ items: await prisma.discipline.findMany({ orderBy: { name: 'asc' } }) });
});

adminRouter.post('/disciplines', async (req, res) => {
  const { name } = createDisciplineSchema.parse(req.body);
  const exists = await prisma.discipline.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (exists) throw conflict('Ya existe una disciplina con ese nombre.', 'DISCIPLINE_EXISTS');
  res.status(201).json({ discipline: await prisma.discipline.create({ data: { name } }) });
});

adminRouter.patch('/disciplines/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw notFound('Disciplina no encontrada.');
  const data = updateDisciplineSchema.parse(req.body);
  if (!(await prisma.discipline.findUnique({ where: { id } }))) throw notFound('Disciplina no encontrada.');
  if (data.name) {
    const dup = await prisma.discipline.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' }, id: { not: id } } });
    if (dup) throw conflict('Ya existe una disciplina con ese nombre.', 'DISCIPLINE_EXISTS');
  }
  res.json({ discipline: await prisma.discipline.update({ where: { id }, data }) });
});

// ---- Vínculos profesor-bailarín (el bailarín debe aceptarlos)
const linkInclude = { teacher: { select: { id: true, name: true, email: true } }, dancer: { select: { id: true, name: true, email: true } } } as const;

adminRouter.get('/links', async (_req, res) => {
  res.json({ items: await prisma.teacherLink.findMany({ include: linkInclude, orderBy: { createdAt: 'desc' } }) });
});

adminRouter.post('/links', async (req, res) => {
  const { teacherId, dancerId } = createLinkSchema.parse(req.body);
  const [teacher, dancer] = await Promise.all([prisma.user.findUnique({ where: { id: teacherId } }), prisma.user.findUnique({ where: { id: dancerId } })]);
  if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) throw badRequest('El profesor elegido no es válido.', 'INVALID_TEACHER');
  if (!dancer || dancer.role !== 'DANCER' || !dancer.isActive) throw badRequest('El bailarín elegido no es válido.', 'INVALID_DANCER');

  const reset = { shareSummary: false, shareHistory: false, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false };
  const existing = await prisma.teacherLink.findUnique({ where: { teacherId_dancerId: { teacherId, dancerId } } });
  if (existing && (existing.status === 'PENDING' || existing.status === 'ACCEPTED')) {
    throw conflict('Ya existe un vínculo activo o pendiente entre estas personas.', 'LINK_EXISTS');
  }
  // Si estaba rechazado o revocado, se reabre como pendiente y con permisos privados.
  const link = existing
    ? await prisma.teacherLink.update({
        where: { id: existing.id },
        data: { status: 'PENDING', respondedAt: null, permissions: { upsert: { create: reset, update: reset } } },
        include: linkInclude,
      })
    : await prisma.teacherLink.create({ data: { teacherId, dancerId, permissions: { create: reset } }, include: linkInclude });
  res.status(201).json({ link });
});

adminRouter.post('/links/:id/revoke', async (req, res) => {
  const link = await prisma.teacherLink.findUnique({ where: { id: String(req.params.id) } });
  if (!link) throw notFound('Vínculo no encontrado.');
  if (link.status === 'REVOKED' || link.status === 'REJECTED') throw conflict('Este vínculo ya no está activo.', 'INVALID_STATE');
  const reset = { shareSummary: false, shareHistory: false, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false };
  await prisma.teacherLink.update({
    where: { id: link.id },
    data: { status: 'REVOKED', respondedAt: new Date(), permissions: { upsert: { create: reset, update: reset } } },
  });
  res.status(204).end();
});
