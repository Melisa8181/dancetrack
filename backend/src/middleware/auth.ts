import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env, isProd } from '../config/env';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';

export const COOKIE_NAME = 'dt_session';
const SESSION_DAYS = 7;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
};

export function setSessionCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

/**
 * Valida la cookie y vuelve a leer al usuario en la base en CADA petición:
 * así un cambio de rol o una desactivación tienen efecto inmediato.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
  if (!token) throw unauthorized();
  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('payload');
    userId = payload.sub;
  } catch {
    throw unauthorized('Tu sesión expiró. Iniciá sesión nuevamente.');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw unauthorized('Tu sesión ya no es válida.');
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden('Tu rol no tiene acceso a este recurso.');
    next();
  };

/** Defensa CSRF adicional: las peticiones que modifican datos solo se aceptan desde el origen del frontend. */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.CLIENT_ORIGIN) throw forbidden('Origen no autorizado.', 'BAD_ORIGIN');
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
