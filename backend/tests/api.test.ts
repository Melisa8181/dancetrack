import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { addDays, todayInTz } from '../src/lib/dates';

const app = createApp();
const TZ = 'America/Argentina/Buenos_Aires';
const today = () => todayInTz(TZ);
const PASS = 'Clave12345';

let disciplineId: number;

async function reset() {
  await prisma.$executeRawUnsafe('TRUNCATE "SharingPermission","TeacherLink","Training","User","Discipline" RESTART IDENTITY CASCADE');
  disciplineId = (await prisma.discipline.create({ data: { name: 'Ballet clásico' } })).id;
}

async function makeUser(email: string, role: 'DANCER' | 'TEACHER' | 'ADMIN', name = email.split('@')[0]!) {
  return prisma.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(PASS, 4) } });
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBe(200);
  return agent;
}

const trainingBody = (over: Record<string, unknown> = {}) => ({
  date: today(), disciplineId, activityType: 'CLASS', durationMinutes: 60, intensity: 7, energyLevel: 4,
  restHours: 8, hasDiscomfort: true, discomfortDescription: 'TOBILLO-PRIVADO', notes: 'NOTA-PRIVADA', ...over,
});

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe('Autenticación', () => {
  it('registra siempre como bailarín y rechaza el campo role', async () => {
    const bad = await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve@x.com', password: PASS, role: 'ADMIN' });
    expect(bad.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);

    const ok = await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'ANA@x.com', password: PASS });
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('DANCER');
    expect(ok.body.user.email).toBe('ana@x.com');
    expect(JSON.stringify(ok.body)).not.toContain('passwordHash');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@x.com' } });
    expect(stored.passwordHash).not.toBe(PASS);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('valida contraseña débil y correo duplicado', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'a@x.com', password: 'corta' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    await makeUser('dup@x.com', 'DANCER');
    const dup = await request(app).post('/api/auth/register').send({ name: 'Otra', email: 'dup@x.com', password: PASS });
    expect(dup.status).toBe(409);
  });

  it('login, sesión por cookie httpOnly y logout', async () => {
    await makeUser('ana@x.com', 'DANCER');
    const bad = await request(app).post('/api/auth/login').send({ email: 'ana@x.com', password: 'incorrecta1' });
    expect(bad.status).toBe(401);

    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: 'ana@x.com', password: PASS });
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('exige sesión en endpoints protegidos y rechaza orígenes no autorizados', async () => {
    expect((await request(app).get('/api/trainings')).status).toBe(401);
    const res = await request(app).post('/api/auth/login').set('Origin', 'http://evil.example').send({ email: 'a@x.com', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('una cuenta desactivada no puede iniciar sesión y su sesión previa deja de valer', async () => {
    const u = await makeUser('ana@x.com', 'DANCER');
    const agent = await login('ana@x.com');
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@x.com', password: PASS });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('no permite cambiar el rol desde el perfil', async () => {
    await makeUser('ana@x.com', 'DANCER');
    const agent = await login('ana@x.com');
    expect((await agent.patch('/api/profile').send({ role: 'ADMIN' })).status).toBe(400);
    expect((await agent.patch('/api/profile').send({ name: 'Ana María' })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'ana@x.com' } })).role).toBe('DANCER');
  });
});

describe('Entrenamientos (CRUD y validación)', () => {
  it('crea, lista (más recientes primero), edita y elimina', async () => {
    await makeUser('ana@x.com', 'DANCER');
    const agent = await login('ana@x.com');
    const old = await agent.post('/api/trainings').send(trainingBody({ date: addDays(today(), -3) }));
    const recent = await agent.post('/api/trainings').send(trainingBody());
    expect(old.status).toBe(201);
    expect(recent.status).toBe(201);

    const list = await agent.get('/api/trainings');
    expect(list.body.total).toBe(2);
    expect(list.body.items[0].id).toBe(recent.body.training.id);

    const upd = await agent.put(`/api/trainings/${recent.body.training.id}`).send(trainingBody({ durationMinutes: 90, hasDiscomfort: false }));
    expect(upd.status).toBe(200);
    expect(upd.body.training.durationMinutes).toBe(90);
    expect(upd.body.training.discomfortDescription).toBeNull(); // sin molestias no se guarda descripción

    expect((await agent.delete(`/api/trainings/${recent.body.training.id}`)).status).toBe(204);
    expect((await agent.get(`/api/trainings/${recent.body.training.id}`)).status).toBe(404);
    expect((await prisma.training.count())).toBe(1);
  });

  it('filtra por período y disciplina', async () => {
    await makeUser('ana@x.com', 'DANCER');
    const jazz = await prisma.discipline.create({ data: { name: 'Jazz' } });
    const agent = await login('ana@x.com');
    await agent.post('/api/trainings').send(trainingBody({ date: addDays(today(), -10) }));
    await agent.post('/api/trainings').send(trainingBody({ disciplineId: jazz.id }));
    expect((await agent.get(`/api/trainings?disciplineId=${jazz.id}`)).body.total).toBe(1);
    expect((await agent.get(`/api/trainings?from=${addDays(today(), -5)}`)).body.total).toBe(1);
    expect((await agent.get(`/api/trainings?from=${today()}&to=${addDays(today(), -1)}`)).status).toBe(400);
  });

  it.each([
    ['fecha futura', { date: addDays(today(), 1) }],
    ['duración cero', { durationMinutes: 0 }],
    ['duración excesiva', { durationMinutes: 601 }],
    ['intensidad 11', { intensity: 11 }],
    ['intensidad 0', { intensity: 0 }],
    ['energía 6', { energyLevel: 6 }],
    ['descanso negativo', { restHours: -1 }],
    ['tipo inválido', { activityType: 'YOGA' }],
    ['disciplina inexistente', { disciplineId: 9999 }],
    ['campo extra', { userId: 'otro' }],
  ])('rechaza %s', async (_n, over) => {
    await makeUser('ana@x.com', 'DANCER');
    const agent = await login('ana@x.com');
    expect((await agent.post('/api/trainings').send(trainingBody(over))).status).toBe(400);
    expect(await prisma.training.count()).toBe(0);
  });
});

describe('Aislamiento entre usuarios', () => {
  it('un bailarín no puede ver, editar ni borrar registros de otro cambiando el ID', async () => {
    await makeUser('ana@x.com', 'DANCER');
    await makeUser('luz@x.com', 'DANCER');
    const ana = await login('ana@x.com');
    const luz = await login('luz@x.com');
    const t = (await ana.post('/api/trainings').send(trainingBody())).body.training;

    expect((await luz.get(`/api/trainings/${t.id}`)).status).toBe(404);
    expect((await luz.put(`/api/trainings/${t.id}`).send(trainingBody())).status).toBe(404);
    expect((await luz.delete(`/api/trainings/${t.id}`)).status).toBe(404);
    expect((await luz.get('/api/trainings')).body.total).toBe(0);
    expect(await prisma.training.count()).toBe(1);
  });

  it('el dashboard usa solo datos propios y persistidos', async () => {
    await makeUser('ana@x.com', 'DANCER');
    await makeUser('luz@x.com', 'DANCER');
    const ana = await login('ana@x.com');
    const luz = await login('luz@x.com');
    await ana.post('/api/trainings').send(trainingBody({ durationMinutes: 60, intensity: 6 }));
    await ana.post('/api/trainings').send(trainingBody({ durationMinutes: 30, intensity: 9 }));
    await luz.post('/api/trainings').send(trainingBody({ durationMinutes: 120, intensity: 2 }));

    const d = (await ana.get('/api/dashboard')).body;
    expect(d.current.sessions).toBe(2);
    expect(d.current.totalMinutes).toBe(90);
    expect(d.current.averageIntensity).toBe(7.5);
    expect(d.byDay).toHaveLength(7);
    expect(d.byDay.reduce((a: number, x: { sessions: number }) => a + x.sessions, 0)).toBe(2);
    expect(d.comparison).toBeNull(); // sin semana previa no hay comparación
    expect(d.totalRecords).toBe(2);
  });

  it('el dashboard sin registros devuelve ceros y promedio nulo', async () => {
    await makeUser('ana@x.com', 'DANCER');
    const d = (await (await login('ana@x.com')).get('/api/dashboard')).body;
    expect(d.current).toMatchObject({ sessions: 0, totalMinutes: 0, averageIntensity: null });
    expect(d.totalRecords).toBe(0);
  });
});

describe('Profesor: vínculos y privacidad', () => {
  async function setup() {
    const ana = await makeUser('ana@x.com', 'DANCER');
    const teacher = await makeUser('profe@x.com', 'TEACHER');
    await makeUser('admin@x.com', 'ADMIN');
    const anaA = await login('ana@x.com');
    await anaA.post('/api/trainings').send(trainingBody());
    return { ana, teacher, anaA, teacherA: await login('profe@x.com'), adminA: await login('admin@x.com') };
  }

  it('sin vínculo aceptado el profesor no ve nada (404), ni siquiera con vínculo pendiente', async () => {
    const { ana, teacherA, adminA } = await setup();
    expect((await teacherA.get(`/api/teacher/dancers/${ana.id}/summary`)).status).toBe(404);
    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'profe@x.com' } });
    const created = await adminA.post('/api/admin/links').send({ teacherId: teacher.id, dancerId: ana.id });
    expect(created.status).toBe(201);
    expect(created.body.link.status).toBe('PENDING');
    expect((await teacherA.get(`/api/teacher/dancers/${ana.id}/summary`)).status).toBe(404);
    expect((await teacherA.get('/api/teacher/dancers')).body.items).toHaveLength(0);
  });

  it('al aceptar, todo sigue privado por defecto; solo lo autorizado se expone', async () => {
    const { ana, teacher, anaA, teacherA, adminA } = await setup();
    const link = (await adminA.post('/api/admin/links').send({ teacherId: teacher.id, dancerId: ana.id })).body.link;
    const accepted = await anaA.post(`/api/links/${link.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(Object.values(accepted.body.link.permissions).every((v) => v === false)).toBe(true);

    // Sin permisos: resumen nulo y listado prohibido
    const s0 = await teacherA.get(`/api/teacher/dancers/${ana.id}/summary`);
    expect(s0.status).toBe(200);
    expect(s0.body.summary).toBeNull();
    const l0 = await teacherA.get(`/api/teacher/dancers/${ana.id}/trainings`);
    expect(l0.status).toBe(403);
    expect(l0.body.error.code).toBe('NOT_SHARED');

    // Resumen + historial, sin molestias ni notas
    await anaA.put(`/api/links/${link.id}/permissions`).send({ shareSummary: true, shareHistory: true, shareEnergyRest: false, shareDiscomfort: false, shareNotes: false });
    const s1 = await teacherA.get(`/api/teacher/dancers/${ana.id}/summary`);
    expect(s1.body.summary.current.sessions).toBe(1);
    const l1 = await teacherA.get(`/api/teacher/dancers/${ana.id}/trainings`);
    expect(l1.status).toBe(200);
    const raw = JSON.stringify(l1.body);
    expect(raw).not.toContain('TOBILLO-PRIVADO');
    expect(raw).not.toContain('NOTA-PRIVADA');
    expect(l1.body.items[0]).not.toHaveProperty('notes');
    expect(l1.body.items[0]).not.toHaveProperty('hasDiscomfort');
    expect(l1.body.items[0]).not.toHaveProperty('energyLevel');

    // Con molestias y notas autorizadas
    await anaA.put(`/api/links/${link.id}/permissions`).send({ shareSummary: true, shareHistory: true, shareEnergyRest: true, shareDiscomfort: true, shareNotes: true });
    const l2 = await teacherA.get(`/api/teacher/dancers/${ana.id}/trainings`);
    expect(l2.body.items[0].discomfortDescription).toBe('TOBILLO-PRIVADO');
    expect(l2.body.items[0].notes).toBe('NOTA-PRIVADA');

    // Al revocar el vínculo, el acceso se corta y los permisos vuelven a privado
    expect((await anaA.post(`/api/links/${link.id}/revoke`)).status).toBe(204);
    expect((await teacherA.get(`/api/teacher/dancers/${ana.id}/trainings`)).status).toBe(404);
    const perms = await prisma.sharingPermission.findUniqueOrThrow({ where: { linkId: link.id } });
    expect(perms.shareNotes || perms.shareSummary).toBe(false);
  });

  it('el profesor no puede modificar ni eliminar entrenamientos ajenos', async () => {
    const { teacherA } = await setup();
    const t = await prisma.training.findFirstOrThrow();
    expect((await teacherA.put(`/api/trainings/${t.id}`).send(trainingBody())).status).toBe(403);
    expect((await teacherA.delete(`/api/trainings/${t.id}`)).status).toBe(403);
    expect((await teacherA.get('/api/trainings')).status).toBe(403);
    expect(await prisma.training.count()).toBe(1);
  });

  it('un bailarín no puede usar rutas de profesor ni aceptar vínculos ajenos', async () => {
    const { ana, teacher, anaA, adminA } = await setup();
    expect((await anaA.get('/api/teacher/dancers')).status).toBe(403);
    await makeUser('luz@x.com', 'DANCER');
    const luz = await login('luz@x.com');
    const link = (await adminA.post('/api/admin/links').send({ teacherId: teacher.id, dancerId: ana.id })).body.link;
    expect((await luz.post(`/api/links/${link.id}/accept`)).status).toBe(404);
    expect((await luz.put(`/api/links/${link.id}/permissions`).send({ shareSummary: true, shareHistory: true, shareEnergyRest: true, shareDiscomfort: true, shareNotes: true })).status).toBe(404);
  });

  it('un profesor no ve a un bailarín vinculado con OTRO profesor', async () => {
    const { ana, teacher, anaA, adminA } = await setup();
    await makeUser('otro@x.com', 'TEACHER');
    const link = (await adminA.post('/api/admin/links').send({ teacherId: teacher.id, dancerId: ana.id })).body.link;
    await anaA.post(`/api/links/${link.id}/accept`);
    const otro = await login('otro@x.com');
    expect((await otro.get(`/api/teacher/dancers/${ana.id}/summary`)).status).toBe(404);
  });
});

describe('Administrador', () => {
  it('lista usuarios sin exponer hashes, y los no admin reciben 403', async () => {
    await makeUser('admin@x.com', 'ADMIN');
    await makeUser('ana@x.com', 'DANCER');
    const admin = await login('admin@x.com');
    const res = await admin.get('/api/admin/users?search=ana');
    expect(res.body.items).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const ana = await login('ana@x.com');
    expect((await ana.get('/api/admin/users')).status).toBe(403);
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
  });

  it('el administrador no accede a entrenamientos ni observaciones de otros', async () => {
    await makeUser('admin@x.com', 'ADMIN');
    await makeUser('ana@x.com', 'DANCER');
    await (await login('ana@x.com')).post('/api/trainings').send(trainingBody());
    const admin = await login('admin@x.com');
    const t = await prisma.training.findFirstOrThrow();
    expect((await admin.get('/api/trainings')).status).toBe(403);
    expect((await admin.get(`/api/trainings/${t.id}`)).status).toBe(403);
    const users = await admin.get('/api/admin/users');
    expect(JSON.stringify(users.body)).not.toContain('NOTA-PRIVADA');
  });

  it('cambia roles y desactiva cuentas; impide que un admin se degrade o desactive a sí mismo', async () => {
    const adminU = await makeUser('admin@x.com', 'ADMIN');
    const ana = await makeUser('ana@x.com', 'DANCER');
    const admin = await login('admin@x.com');

    expect((await admin.patch(`/api/admin/users/${ana.id}`).send({ role: 'TEACHER' })).body.user.role).toBe('TEACHER');
    expect((await admin.patch(`/api/admin/users/${ana.id}`).send({ isActive: false })).body.user.isActive).toBe(false);
    expect((await admin.patch(`/api/admin/users/${ana.id}`).send({ role: 'SUPERADMIN' })).status).toBe(400);

    const self = await admin.patch(`/api/admin/users/${adminU.id}`).send({ role: 'DANCER' });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('SELF_MODIFICATION_FORBIDDEN');

    // Otro admin puede intentar degradar al único otro admin: debe quedar uno activo.
    const second = await makeUser('admin2@x.com', 'ADMIN');
    const admin2 = await login('admin2@x.com');
    expect((await admin2.patch(`/api/admin/users/${adminU.id}`).send({ isActive: false })).status).toBe(200);
    const last = await admin2.patch(`/api/admin/users/${second.id}`).send({ isActive: false });
    expect(last.status).toBe(400); // es él mismo
  });

  it('cambiar el rol de un profesor revoca sus vínculos', async () => {
    const teacher = await makeUser('profe@x.com', 'TEACHER');
    const ana = await makeUser('ana@x.com', 'DANCER');
    await makeUser('admin@x.com', 'ADMIN');
    const admin = await login('admin@x.com');
    const link = (await admin.post('/api/admin/links').send({ teacherId: teacher.id, dancerId: ana.id })).body.link;
    await (await login('ana@x.com')).post(`/api/links/${link.id}/accept`);
    await admin.patch(`/api/admin/users/${teacher.id}`).send({ role: 'DANCER' });
    expect((await prisma.teacherLink.findUniqueOrThrow({ where: { id: link.id } })).status).toBe('REVOKED');
  });

  it('gestiona disciplinas: crear, editar, desactivar y evitar duplicados', async () => {
    await makeUser('admin@x.com', 'ADMIN');
    await makeUser('ana@x.com', 'DANCER');
    const admin = await login('admin@x.com');
    const created = await admin.post('/api/admin/disciplines').send({ name: 'Tango' });
    expect(created.status).toBe(201);
    expect((await admin.post('/api/admin/disciplines').send({ name: 'tango' })).status).toBe(409);
    const id = created.body.discipline.id;
    expect((await admin.patch(`/api/admin/disciplines/${id}`).send({ name: 'Tango argentino' })).body.discipline.name).toBe('Tango argentino');
    await admin.patch(`/api/admin/disciplines/${id}`).send({ isActive: false });

    const ana = await login('ana@x.com');
    const list = (await ana.get('/api/disciplines')).body.items as { id: number }[];
    expect(list.some((d) => d.id === id)).toBe(false); // la desactivada no se ofrece
    expect((await ana.post('/api/trainings').send(trainingBody({ disciplineId: id }))).status).toBe(400);
    expect((await ana.get('/api/admin/disciplines')).status).toBe(403);
  });
});
