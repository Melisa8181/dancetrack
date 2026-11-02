# DanceTrack

Aplicación web para registrar y seguir el entrenamiento de bailarines. Proyecto académico individual.

- **Frontend:** React + TypeScript + Vite + React Router + Tailwind CSS (Fetch API).
- **Backend:** Node.js + Express + TypeScript (API REST, validación con Zod).
- **Base de datos:** PostgreSQL + Prisma ORM (migraciones y seed).

> DanceTrack **no es una aplicación médica**: no diagnostica lesiones ni da recomendaciones de salud.

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/ARQUITECTURA.md` | Estructura, modelo de datos, roles y permisos, decisiones técnicas |
| `docs/API.md` | Endpoints con ejemplos de solicitud y respuesta |
| `docs/PRUEBAS.md` | Qué se probó, cómo ejecutarlo, qué quedó pendiente y limitaciones conocidas |

## Requisitos (Windows)

1. **Node.js 20 o superior** (recomendado 22 LTS): https://nodejs.org — verificá con `node -v`.
2. **PostgreSQL 14 o superior**: https://www.postgresql.org/download/windows/ (anotá la contraseña del usuario `postgres`).
3. **Git** (opcional) y una terminal (PowerShell).

## Instalación paso a paso

### 1. Crear las bases de datos

Abrí PowerShell y ejecutá (te pedirá la contraseña de `postgres`; si `psql` no se reconoce, usá "SQL Shell (psql)" del menú Inicio o agregá `C:\Program Files\PostgreSQL\<versión>\bin` al PATH):

```powershell
psql -U postgres -c "CREATE USER dancetrack WITH PASSWORD 'dancetrack' CREATEDB;"
psql -U postgres -c "CREATE DATABASE dancetrack OWNER dancetrack;"
psql -U postgres -c "CREATE DATABASE dancetrack_test OWNER dancetrack;"
```

(`dancetrack_test` se usa solo para las pruebas automáticas; **sus tablas se vacían** en cada ejecución.)

### 2. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Editá `backend/.env`:
- `JWT_SECRET`: reemplazalo por un valor aleatorio de 32+ caracteres. Generá uno con:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DATABASE_URL` y `TEST_DATABASE_URL`: ajustá usuario/contraseña si usaste otros.

Luego creá las tablas, generá el cliente y cargá datos de demostración:

```powershell
npm run prisma:deploy     # aplica las migraciones sobre la base nueva
npm run prisma:generate   # genera el cliente de Prisma
npm run db:seed           # disciplinas + cuentas y datos de demostración
npm run dev               # API en http://localhost:4000
```

### 3. Frontend (otra terminal)

```powershell
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Abrí http://localhost:5173. En desarrollo, Vite reenvía `/api` al backend, por lo que no hace falta configurar nada más.

## Cuentas de demostración

Las crea `npm run db:seed` (solo fuera de producción). Contraseña de todas: la de `DEMO_PASSWORD` (por defecto `Demo12345`).

| Correo | Rol | Notas |
|---|---|---|
| `admin@dancetrack.test` | Administrador | |
| `profe@dancetrack.test` | Profesor | Vinculada con Ana (acepta) y Lucía (pendiente) |
| `ana@dancetrack.test` | Bailarina | Comparte con la profesora solo resumen y listado; molestias y observaciones **privadas** |
| `lucia@dancetrack.test` | Bailarina | Tiene una solicitud de vínculo pendiente para aceptar en *Privacidad* |

## Crear el administrador inicial (procedimiento seguro)

El registro público **siempre** crea bailarines; no existe ningún botón para crear administradores. Para el primer administrador real:

```powershell
cd backend
$env:ADMIN_EMAIL="tu-correo@ejemplo.com"
$env:ADMIN_NAME="Tu Nombre"
$env:ADMIN_PASSWORD="UnaClaveLarga123"     # mínimo 10 caracteres, letras y números
npm run create-admin
Remove-Item Env:ADMIN_PASSWORD
```

Las credenciales se leen del entorno (no quedan en argumentos de comandos). Si el correo ya existe, el script no modifica nada. Después el administrador puede promover a otros usuarios desde *Administración*.

## Scripts útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | API con recarga automática |
| backend | `npm run build` / `npm start` | Compila a `dist/` y ejecuta |
| backend | `npm run typecheck` | Verifica tipos |
| backend | `npm test` | Pruebas automáticas (usa `TEST_DATABASE_URL`) |
| backend | `npm run db:seed` | Datos de demostración (idempotente) |
| backend | `npx prisma migrate dev --name <cambio>` | Crear una nueva migración al modificar `schema.prisma` |
| frontend | `npm run dev` | Servidor de desarrollo |
| frontend | `npm run build` | Verifica tipos y genera `dist/` |

## Resolución de errores frecuentes

- **`Configuración de entorno inválida`** al iniciar el backend: falta o es inválida una variable de `backend/.env` (ver `.env.example`). `JWT_SECRET` debe tener 32+ caracteres.
- **`ECONNREFUSED 127.0.0.1:5432`**: PostgreSQL no está en ejecución. Iniciá el servicio ("Servicios" de Windows → `postgresql-x64-XX`).
- **`password authentication failed`**: usuario o contraseña incorrectos en `DATABASE_URL`.
- **`database "dancetrack" does not exist`**: creá las bases (paso 1).
- **`npm run prisma:deploy` dice que no hay migraciones o falla**: verificá que estás en `backend/` y que `DATABASE_URL` apunta a la base correcta.
- **`prisma migrate dev` propone una migración nueva o detecta "drift"**: en una base de desarrollo descartable, ejecutá `npx prisma migrate reset` (borra y recrea todo) y luego `npm run db:seed`. Si persiste, ver "Limitaciones conocidas" en `docs/PRUEBAS.md`.
- **`EPERM` al generar el cliente de Prisma en Windows**: detené `npm run dev` del backend y reintentá `npm run prisma:generate`.
- **El frontend muestra "No se pudo conectar con el servidor"**: el backend no está corriendo en el puerto 4000.
- **Error 403 `BAD_ORIGIN`**: accediste al frontend desde un origen distinto de `CLIENT_ORIGIN` (por defecto `http://localhost:5173`; no uses `127.0.0.1`). Ajustá `CLIENT_ORIGIN` si cambiás el puerto.
- **Los tests se niegan a ejecutarse**: `TEST_DATABASE_URL` debe existir, ser distinta de `DATABASE_URL` y su base debe terminar en `_test` (protección contra vaciar datos reales).
- **Puerto ocupado** (`EADDRINUSE`): cambiá `PORT` en `backend/.env` y el `target` del proxy en `frontend/vite.config.ts`.

## Despliegue (nota breve)

En producción: `NODE_ENV=production` (activa cookie `Secure`), HTTPS obligatorio, `CLIENT_ORIGIN` con el dominio real del frontend, un `JWT_SECRET` propio y `npm run prisma:deploy` (nunca `migrate dev`). Si frontend y API están en dominios distintos, ver "Limitaciones conocidas".
