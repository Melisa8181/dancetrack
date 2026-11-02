import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { conflict, forbidden, unauthorized } from '../lib/errors';
import { serializeUser } from '../lib/serializers';
import { isTest } from '../config/env';
import { authenticate, clearSessionCookie, currentUser, setSessionCookie } from '../middleware/auth';
import { loginSchema, registerSchema } from '../validation/schemas';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Probá de nuevo en unos minutos.' } },
});

// Hash falso para igualar el tiempo de respuesta cuando el correo no existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

authRouter.post('/register', limiter, async (req, res) => {
  // El esquema es estricto: cualquier campo "role" se rechaza. El rol SIEMPRE es DANCER.
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw conflict('Ya existe una cuenta con ese correo.', 'EMAIL_TAKEN');
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12), role: 'DANCER' },
    include: { mainDiscipline: true },
  });
  setSessionCookie(res, user.id);
  res.status(201).json({ user: serializeUser(user) });
});

authRouter.post('/login', limiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email }, include: { mainDiscipline: true } });
  const ok = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Correo o contraseña incorrectos.');
  if (!user.isActive) throw forbidden('Tu cuenta está desactivada. Contactá a un administrador.', 'ACCOUNT_DISABLED');
  setSessionCookie(res, user.id);
  res.json({ user: serializeUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const me = currentUser(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, include: { mainDiscipline: true } });
  res.json({ user: serializeUser(user) });
});
