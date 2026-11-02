import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('America/Argentina/Buenos_Aires'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración de entorno inválida:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Revisá tu archivo backend/.env (ver .env.example).');
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
