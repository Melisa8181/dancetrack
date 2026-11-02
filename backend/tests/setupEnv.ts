// Se ejecuta antes de importar la app: apunta TODO a la base de pruebas.
import 'dotenv/config';

if (!process.env.TEST_DATABASE_URL) throw new Error('Definí TEST_DATABASE_URL en backend/.env (base separada para tests).');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.JWT_SECRET = 'x'.repeat(40);
