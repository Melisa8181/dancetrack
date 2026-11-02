import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { badRequest, conflict } from '../lib/errors';
import { serializeUser } from '../lib/serializers';
import { authenticate, currentUser } from '../middleware/auth';
import { changePasswordSchema, updateProfileSchema } from '../validation/schemas';

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get('/', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id }, include: { mainDiscipline: true } });
  res.json({ user: serializeUser(user) });
});

// El esquema es estricto y NO incluye "role" ni "isActive": no se pueden modificar desde el perfil.
profileRouter.patch('/', async (req, res) => {
  const me = currentUser(req);
  const data = updateProfileSchema.parse(req.body);
  if (data.email && data.email !== me.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (taken) throw conflict('Ya existe una cuenta con ese correo.', 'EMAIL_TAKEN');
  }
  if (data.mainDisciplineId) {
    const d = await prisma.discipline.findFirst({ where: { id: data.mainDisciplineId, isActive: true } });
    if (!d) throw badRequest('La disciplina elegida no existe o no está disponible.', 'INVALID_DISCIPLINE');
  }
  const user = await prisma.user.update({ where: { id: me.id }, data, include: { mainDiscipline: true } });
  res.json({ user: serializeUser(user) });
});

profileRouter.post('/password', async (req, res) => {
  const me = currentUser(req);
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('La contraseña actual es incorrecta.', 'WRONG_PASSWORD');
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  res.status(204).end();
});
