import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { conflict, notFound } from '../lib/errors';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { permissionsSchema } from '../validation/schemas';

export const linksRouter = Router();
// El bailarín controla sus vínculos y qué comparte con cada profesor.
linksRouter.use(authenticate, requireRole('DANCER'));

const NO_PERMISSIONS = { shareSummary: false, shareHistory: false, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false };

async function ownLink(id: string, dancerId: string) {
  const link = await prisma.teacherLink.findFirst({ where: { id, dancerId } });
  if (!link) throw notFound('Vínculo no encontrado.');
  return link;
}

const shape = (l: {
  id: string; status: string; createdAt: Date; respondedAt: Date | null;
  teacher: { id: string; name: string };
  permissions: { shareSummary: boolean; shareHistory: boolean; shareEnergyRest: boolean; shareDiscomfort: boolean; shareNotes: boolean } | null;
}) => ({
  id: l.id,
  status: l.status,
  createdAt: l.createdAt,
  respondedAt: l.respondedAt,
  teacher: { id: l.teacher.id, name: l.teacher.name },
  permissions: l.permissions
    ? {
        shareSummary: l.permissions.shareSummary,
        shareHistory: l.permissions.shareHistory,
        shareEnergyRest: l.permissions.shareEnergyRest,
        shareDiscomfort: l.permissions.shareDiscomfort,
        shareNotes: l.permissions.shareNotes,
      }
    : NO_PERMISSIONS,
});

const include = { teacher: { select: { id: true, name: true } }, permissions: true } as const;

linksRouter.get('/', async (req, res) => {
  const links = await prisma.teacherLink.findMany({
    where: { dancerId: currentUser(req).id, status: { in: ['PENDING', 'ACCEPTED'] } },
    include,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items: links.map(shape) });
});

linksRouter.post('/:id/accept', async (req, res) => {
  const link = await ownLink(String(req.params.id), currentUser(req).id);
  if (link.status !== 'PENDING') throw conflict('Esta solicitud ya no está pendiente.', 'INVALID_STATE');
  // Al aceptar, todo sigue siendo privado hasta que el bailarín active permisos explícitamente.
  const updated = await prisma.teacherLink.update({
    where: { id: link.id },
    data: { status: 'ACCEPTED', respondedAt: new Date(), permissions: { upsert: { create: NO_PERMISSIONS, update: NO_PERMISSIONS } } },
    include,
  });
  res.json({ link: shape(updated) });
});

linksRouter.post('/:id/reject', async (req, res) => {
  const link = await ownLink(String(req.params.id), currentUser(req).id);
  if (link.status !== 'PENDING') throw conflict('Esta solicitud ya no está pendiente.', 'INVALID_STATE');
  await prisma.teacherLink.update({ where: { id: link.id }, data: { status: 'REJECTED', respondedAt: new Date() } });
  res.status(204).end();
});

// Revocar corta el acceso del profesor y restablece los permisos a "privado".
linksRouter.post('/:id/revoke', async (req, res) => {
  const link = await ownLink(String(req.params.id), currentUser(req).id);
  if (link.status !== 'ACCEPTED' && link.status !== 'PENDING') throw conflict('Este vínculo ya no está activo.', 'INVALID_STATE');
  await prisma.teacherLink.update({
    where: { id: link.id },
    data: { status: 'REVOKED', respondedAt: new Date(), permissions: { upsert: { create: NO_PERMISSIONS, update: NO_PERMISSIONS } } },
  });
  res.status(204).end();
});

linksRouter.put('/:id/permissions', async (req, res) => {
  const link = await ownLink(String(req.params.id), currentUser(req).id);
  if (link.status !== 'ACCEPTED') throw conflict('Solo podés configurar permisos de vínculos aceptados.', 'INVALID_STATE');
  const data = permissionsSchema.parse(req.body);
  // Coherencia: sin historial no tiene sentido compartir sus detalles.
  const normalized = data.shareHistory ? data : { ...data, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false };
  const updated = await prisma.teacherLink.update({
    where: { id: link.id },
    data: { permissions: { upsert: { create: normalized, update: normalized } } },
    include,
  });
  res.json({ link: shape(updated) });
});
