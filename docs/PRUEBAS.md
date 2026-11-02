# Pruebas y limitaciones

## Cómo ejecutar

```powershell
cd backend
npm test            # requiere TEST_DATABASE_URL (base *_test) en backend/.env
npm run typecheck
npm run build
cd ../frontend
npm run build       # incluye verificación de tipos
```

Las pruebas del backend (Vitest + Supertest) recrean el esquema de la base de pruebas aplicando los archivos `prisma/migrations/*/migration.sql` en orden y trabajan contra PostgreSQL real.

## Qué se verificó realmente (entorno de desarrollo del autor: Linux, Node 22, PostgreSQL 16)

**Ejecutado y aprobado — 31 pruebas automatizadas del backend:**
- Registro siempre como bailarín; rechazo de `role` en registro y perfil; hash bcrypt almacenado; correo duplicado; contraseña débil.
- Login/logout con cookie `httpOnly` y `SameSite=Lax`; 401 sin sesión; rechazo de `Origin` ajeno; cuenta desactivada (login 403 y sesión previa invalidada).
- CRUD de entrenamientos; orden más reciente primero; filtros por período y disciplina; 10 casos de validación (fecha futura, duración 0 y >600, intensidad 0 y 11, energía 6, descanso negativo, tipo inválido, disciplina inexistente, campo extra).
- Aislamiento: un bailarín no puede leer, editar ni borrar entrenamientos de otro cambiando el ID (404).
- Dashboard: valores calculados desde datos persistidos y solo propios; estado vacío; sin comparación cuando no hay semana previa.
- Profesor: sin vínculo o con vínculo pendiente no ve nada; al aceptar todo sigue privado; con permisos parciales **no aparecen** molestias ni notas en la respuesta; con todos los permisos sí; al revocar se corta el acceso y los permisos vuelven a privado; no puede modificar ni borrar entrenamientos; no ve bailarines de otro profesor; un bailarín no puede aceptar ni configurar vínculos ajenos.
- Administrador: lista usuarios sin hashes; 403 para no administradores; no accede a entrenamientos ni observaciones; cambia roles y desactiva cuentas; no puede degradarse/desactivarse a sí mismo; cambiar el rol de un profesor revoca sus vínculos; gestión de disciplinas (crear, renombrar, desactivar, duplicados, no se ofrecen al registrar).

**Ejecutado manualmente:**
- Migraciones SQL aplicadas sobre bases PostgreSQL nuevas, sin errores (con `psql`).
- `npm run db:seed` dos veces (idempotente) y `npm run create-admin` (con y sin variables).
- Compilación (`tsc`) y build de backend y frontend sin errores.
- Con el backend compilado y el servidor Vite: login a través del proxy, lista de bailarines del profesor, historial compartido sin campos privados, 403 al profesor creando entrenamientos y `BAD_ORIGIN` con origen ajeno.

## Pendiente / no verificado

- **No se ejecutó `prisma migrate deploy` ni `prisma migrate dev`:** el entorno de desarrollo no podía descargar los motores de Prisma (dominio bloqueado). Las migraciones se escribieron a mano siguiendo el formato de Prisma y se aplicaron con `psql`. **Verificá en tu máquina** con `npm run prisma:deploy` sobre una base nueva. Si `prisma migrate dev` detectara diferencias, usá `npx prisma migrate reset` en tu base de desarrollo o regenerá la migración inicial (`migrate dev --name init`) conservando el SQL de las restricciones CHECK.
- **Interfaz no revisada visualmente en un navegador:** el entorno no tenía navegador. El frontend compila y su integración con la API se probó por HTTP, pero falta recorrerlo manualmente (responsive, contraste, foco, teclado). No hay pruebas automatizadas de frontend.
- No se probó en Windows (las instrucciones están escritas para PowerShell pero no se ejecutaron allí).
- No hay pruebas de carga ni auditoría de dependencias.

## Limitaciones conocidas

- **Sesión sin revocación por dispositivo:** el cierre de sesión borra la cookie del navegador, pero un JWT copiado seguiría válido hasta expirar (7 días) mientras la cuenta esté activa. Desactivar la cuenta sí lo invalida.
- **Enumeración de correos:** el registro informa si un correo ya existe.
- **Dominios distintos:** con frontend y API en sitios distintos en producción, la cookie `SameSite=Lax` no se enviaría en peticiones `fetch` entre sitios; lo recomendado es servir ambos bajo el mismo sitio (por ejemplo, proxy inverso con `/api`).
- **Sin recuperación de contraseña ni verificación de correo.**
- **Un administrador puede ver nombres y correos** de las cuentas (necesario para gestionarlas), pero no sus entrenamientos.
- **Solo los bailarines registran entrenamientos;** profesores y administradores no tienen entrenamientos propios.
- Semana lunes–domingo fija; comparación solo contra la semana anterior.
