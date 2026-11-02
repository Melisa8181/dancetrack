/**
 * Crea el administrador inicial. Uso (ver README):
 *   PowerShell:  $env:ADMIN_EMAIL="admin@tudominio.com"; $env:ADMIN_NAME="Tu Nombre"; $env:ADMIN_PASSWORD="UnaClaveLarga123"; npm run create-admin
 * Las credenciales se leen del entorno (no quedan en el historial de comandos como argumentos).
 * Si el correo ya existe, el script NO modifica la cuenta.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { emailSchema, passwordSchema } from '../src/validation/schemas';

async function main() {
  const email = emailSchema.safeParse(process.env.ADMIN_EMAIL);
  const password = passwordSchema.safeParse(process.env.ADMIN_PASSWORD);
  const name = (process.env.ADMIN_NAME ?? 'Administrador').trim();
  if (!email.success || !password.success || (process.env.ADMIN_PASSWORD ?? '').length < 10) {
    console.error('Definí ADMIN_EMAIL (válido) y ADMIN_PASSWORD (mínimo 10 caracteres, con letras y números) y, opcionalmente, ADMIN_NAME.');
    process.exit(1);
  }
  if (await prisma.user.findUnique({ where: { email: email.data } })) {
    console.error('Ya existe un usuario con ese correo. No se modificó nada.');
    process.exit(1);
  }
  await prisma.user.create({ data: { email: email.data, name, role: 'ADMIN', passwordHash: await bcrypt.hash(password.data, 12) } });
  console.log(`Administrador creado: ${email.data}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
