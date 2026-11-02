import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/** Recrea el esquema de la base de PRUEBAS aplicando las migraciones SQL del proyecto, en orden. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Definí TEST_DATABASE_URL en backend/.env');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL debe ser distinta de DATABASE_URL.');
  const dbName = new URL(url).pathname.replace('/', '');
  if (!dbName.endsWith('_test')) throw new Error(`Por seguridad, la base de tests debe terminar en "_test" (actual: ${dbName}).`);

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  for (const name of fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort()) {
    await client.query(fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'));
  }
  await client.end();
}
