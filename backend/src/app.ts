import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { originGuard } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { disciplinesRouter } from './routes/disciplines';
import { trainingsRouter } from './routes/trainings';
import { dashboardRouter } from './routes/dashboard';
import { linksRouter } from './routes/links';
import { teacherRouter } from './routes/teacher';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true })); // un único origen autorizado
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(originGuard);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/disciplines', disciplinesRouter);
  app.use('/api/trainings', trainingsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/links', linksRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
