/**
 * Seed reproducible.
 *  - Siempre: crea/actualiza las disciplinas base.
 *  - Solo fuera de producción: crea cuentas y datos de DEMOSTRACIÓN (admin, profesor, 2 bailarinas).
 * Los entrenamientos de demo usan un generador pseudoaleatorio con semilla fija (mismos valores cada vez),
 * ubicados en las últimas 6 semanas respecto de la fecha en que se ejecuta el seed.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { ActivityType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { addDays, mondayOf, toDbDate, todayInTz } from '../src/lib/dates';
import { env } from '../src/config/env';

const DISCIPLINES = ['Ballet clásico', 'Danza contemporánea', 'Jazz', 'Hip hop', 'Folklore argentino', 'Tango', 'Salsa y bachata', 'Otra'];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function main() {
  for (const name of DISCIPLINES) {
    await prisma.discipline.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Disciplinas base: ${DISCIPLINES.length}`);

  if (env.NODE_ENV === 'production') {
    console.log('Producción: no se crean cuentas de demostración. Usá "npm run create-admin".');
    return;
  }

  const password = process.env.DEMO_PASSWORD ?? 'Demo12345';
  const hash = await bcrypt.hash(password, 12);
  const disc = Object.fromEntries((await prisma.discipline.findMany()).map((d) => [d.name, d.id]));

  const upsertUser = (email: string, name: string, role: 'ADMIN' | 'TEACHER' | 'DANCER', mainDisciplineId?: number, bio?: string) =>
    prisma.user.upsert({
      where: { email },
      update: { name, role, isActive: true, passwordHash: hash, mainDisciplineId: mainDisciplineId ?? null, bio: bio ?? null },
      create: { email, name, role, passwordHash: hash, mainDisciplineId, bio },
    });

  await upsertUser('admin@dancetrack.test', 'Admin Demo', 'ADMIN');
  const teacher = await upsertUser('profe@dancetrack.test', 'Marta Quiroga', 'TEACHER', disc['Danza contemporánea']);
  const ana = await upsertUser('ana@dancetrack.test', 'Ana Ferreyra', 'DANCER', disc['Ballet clásico'], 'Estudiante de ballet, tres veces por semana.');
  const lucia = await upsertUser('lucia@dancetrack.test', 'Lucía Benítez', 'DANCER', disc['Jazz']);

  // Entrenamientos de demo (se regeneran en cada seed para que sean siempre los mismos)
  const today = todayInTz(env.APP_TIMEZONE);
  const start = addDays(mondayOf(today), -35);
  const types: ActivityType[] = ['CLASS', 'REHEARSAL', 'TECHNIQUE', 'CROSS_TRAINING', 'CLASS'];
  const notes = ['Buena clase, trabajamos giros.', 'Cansancio al final.', null, 'Ensayo general de la coreografía.', null];

  for (const [dancer, seed, mainName] of [[ana, 7, 'Ballet clásico'], [lucia, 21, 'Jazz']] as const) {
    await prisma.training.deleteMany({ where: { userId: dancer.id } });
    const r = rng(seed);
    const rows = [];
    for (let i = 0; i <= 35; i++) {
      const date = addDays(start, i);
      if (date > today || r() < 0.5) continue;
      const hasDiscomfort = r() < 0.2;
      const k = Math.floor(r() * types.length);
      rows.push({
        userId: dancer.id,
        disciplineId: disc[r() < 0.8 ? mainName : 'Danza contemporánea']!,
        date: toDbDate(date),
        activityType: types[k]!,
        durationMinutes: 45 + Math.floor(r() * 10) * 10,
        intensity: 3 + Math.floor(r() * 7),
        energyLevel: 1 + Math.floor(r() * 5),
        restHours: Math.round((5 + r() * 4) * 2) / 2,
        hasDiscomfort,
        discomfortDescription: hasDiscomfort ? 'Molestia leve en el tobillo derecho.' : null,
        notes: notes[k] ?? null,
      });
    }
    await prisma.training.createMany({ data: rows });
    console.log(`Entrenamientos de demo para ${dancer.name}: ${rows.length}`);
  }

  // Vínculos de demo: Ana ya aceptó (comparte resumen e historial, NO molestias ni observaciones); Lucía tiene una solicitud pendiente.
  const allOff = { shareSummary: false, shareHistory: false, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false };
  const anaPerms = { ...allOff, shareSummary: true, shareHistory: true };
  await prisma.teacherLink.upsert({
    where: { teacherId_dancerId: { teacherId: teacher.id, dancerId: ana.id } },
    update: { status: 'ACCEPTED', respondedAt: new Date(), permissions: { upsert: { create: anaPerms, update: anaPerms } } },
    create: { teacherId: teacher.id, dancerId: ana.id, status: 'ACCEPTED', respondedAt: new Date(), permissions: { create: anaPerms } },
  });
  await prisma.teacherLink.upsert({
    where: { teacherId_dancerId: { teacherId: teacher.id, dancerId: lucia.id } },
    update: { status: 'PENDING', respondedAt: null, permissions: { upsert: { create: allOff, update: allOff } } },
    create: { teacherId: teacher.id, dancerId: lucia.id, status: 'PENDING', permissions: { create: allOff } },
  });

  console.log(`\nCuentas de demostración (contraseña: ${password}):`);
  console.log('  admin@dancetrack.test  (Administrador)');
  console.log('  profe@dancetrack.test  (Profesor)');
  console.log('  ana@dancetrack.test    (Bailarina, vinculada y con permisos parciales)');
  console.log('  lucia@dancetrack.test  (Bailarina, solicitud de vínculo pendiente)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
