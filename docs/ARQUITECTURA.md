# Arquitectura y decisiones técnicas

## Estructura

```
dancetrack/
├── backend/
│   ├── prisma/            schema.prisma, migrations/, seed.ts
│   ├── scripts/           createAdmin.ts
│   ├── src/
│   │   ├── config/        env.ts (validación de variables con Zod)
│   │   ├── lib/           prisma, errores HTTP, fechas, serializadores
│   │   ├── middleware/    auth (cookie/roles/origen), manejo de errores
│   │   ├── routes/        auth, profile, disciplines, trainings, dashboard, links, teacher, admin
│   │   ├── services/      dashboard.ts (cálculo de métricas)
│   │   └── validation/    schemas.ts (Zod)
│   └── tests/             Vitest + Supertest sobre una base real de PostgreSQL
└── frontend/
    └── src/
        ├── api/           client.ts (fetch), types.ts
        ├── auth/          AuthContext, guardas de rutas
        ├── components/    ui, Layout, WeekChart, WeekSummaryView
        ├── lib/           formato, validación del formulario
        └── pages/         Landing, AuthPages, Dashboard, TrainingForm, History,
                           Profile, Privacy, TeacherHome, TeacherDancerPage, Admin
```

El frontend **solo** habla con la API REST; nunca con PostgreSQL.

## Modelo de datos

```
User 1───* Training *───1 Discipline
 │ │                          ▲
 │ └─ mainDiscipline (opcional)┘
 │
 ├─* TeacherLink (teacherId)   TeacherLink 1───1 SharingPermission
 └─* TeacherLink (dancerId)
```

| Tabla | Descripción | Restricciones relevantes |
|---|---|---|
| `User` | Cuenta. `role` (DANCER/TEACHER/ADMIN), `isActive`, `passwordHash` (bcrypt) | `email` único (minúsculas); índice por rol |
| `Discipline` | Catálogo gestionado por el administrador | `name` único; se desactiva, no se borra |
| `Training` | Sesión de entrenamiento | FK a usuario (CASCADE) y disciplina (RESTRICT); índice `(userId, date)`; CHECK: duración 1–600, intensidad 1–10, energía 1–5, descanso 0–24 |
| `TeacherLink` | Asociación profesor–bailarín con estado PENDING/ACCEPTED/REJECTED/REVOKED | Único `(teacherId, dancerId)`; CHECK profesor ≠ bailarín |
| `SharingPermission` | 5 permisos booleanos por vínculo, **todos `false` por defecto** | Único por vínculo; CASCADE |

Las fechas de entrenamiento son `DATE` (sin zona horaria) y se transportan como texto `AAAA-MM-DD`. "Hoy" y el límite de fecha futura se calculan en `APP_TIMEZONE` (por defecto `America/Argentina/Buenos_Aires`). Las escalas (intensidad 1–10, energía 1–5) se guardan como enteros con restricciones CHECK (migración `…_check_constraints`).

## Roles y permisos

| Capacidad | Bailarín | Profesor | Administrador |
|---|:-:|:-:|:-:|
| Registro público | ✔ (siempre como bailarín) | — | — |
| Ver/editar su perfil, cambiar su contraseña | ✔ | ✔ | ✔ |
| CRUD de **sus** entrenamientos, historial, dashboard | ✔ | ✘ | ✘ |
| Aceptar/rechazar/revocar vínculos y definir permisos | ✔ (sobre los suyos) | ✘ | ✘ |
| Ver bailarines **vinculados y aceptados** | ✘ | ✔ | ✘ |
| Ver resumen / listado / energía y descanso / molestias / observaciones de un bailarín | ✘ | Solo si el bailarín activó **ese** permiso | ✘ (no existe endpoint) |
| Modificar o borrar entrenamientos ajenos | ✘ | ✘ | ✘ |
| Listar/buscar usuarios, cambiar roles, activar/desactivar cuentas | ✘ | ✘ | ✔ |
| Gestionar disciplinas | ✘ | ✘ | ✔ |
| Crear/revocar vínculos profesor–bailarín | ✘ | ✘ | ✔ (el bailarín debe aceptar) |

Permisos de lectura del profesor (por bailarín, todos opcionales y apagados por defecto):
`shareSummary` (métricas), `shareHistory` (fecha, disciplina, tipo, duración, intensidad), `shareEnergyRest`, `shareDiscomfort`, `shareNotes`. Los tres últimos requieren `shareHistory`.

## Cómo se aplica la seguridad

- **Sesión:** JWT firmado (7 días) en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción. No hay tokens en `localStorage`. En **cada** petición se vuelve a leer al usuario en la base: un cambio de rol o una desactivación surten efecto de inmediato.
- **Contraseñas:** bcrypt (costo 12). Política: 8–72 caracteres, con letra y número.
- **Autorización en el servidor:** `authenticate` + `requireRole` en cada router; la propiedad de cada recurso se verifica en la consulta (`where: { id, userId }`). Un recurso ajeno responde **404** (no revela su existencia).
- **Privacidad del profesor:** el vínculo debe estar `ACCEPTED`; los campos sensibles ni siquiera se leen de la base si no hay permiso (lista blanca en `select`). Al revocar un vínculo los permisos vuelven a `false`.
- **Roles:** los esquemas de registro y perfil son `.strict()` y no admiten `role`; solo `PATCH /api/admin/users/:id` cambia roles. Un administrador no puede degradarse ni desactivarse a sí mismo.
- **CSRF/CORS:** CORS limitado a `CLIENT_ORIGIN`, cookie `SameSite=Lax` y rechazo de peticiones que modifican datos desde otro `Origin`.
- **Otros:** `helmet`, límite de cuerpo 50 kB, límite de intentos en login/registro, mensajes de login genéricos, formato de error uniforme.
- **Administrador sin acceso a datos privados:** no existe ningún endpoint que devuelva entrenamientos de terceros a un administrador, y los endpoints de entrenamientos exigen rol bailarín.

## Decisiones técnicas

- **Express 5 + Zod:** errores asíncronos manejados por el framework; validación declarativa con mensajes en español, reutilizada por el script de administrador.
- **Prisma con `engineType = "client"` y adaptador `pg`:** cliente sin binario nativo; menos problemas en Windows y en despliegues.
- **Migraciones SQL versionadas** (`prisma/migrations`), con CHECK constraints en una migración aparte.
- **Dashboard calculado en el servidor** (`services/dashboard.ts`), sobre datos persistidos. Definiciones: semana lunes–domingo; *sesiones* = registros; *tiempo total* = suma de minutos; *intensidad promedio* = promedio simple por sesión (1 decimal); *comparación* = diferencia con la semana anterior, solo si esa semana tuvo sesiones. El mismo cálculo alimenta el resumen que ve el profesor autorizado.
- **Vínculos creados por el administrador y aceptados por el bailarín:** simple y explícito; evita que un profesor pueda "pedir" acceso a cualquiera.
- **Vite proxy** en desarrollo: un único origen, cookies sin configuración extra.
- **Gráfico propio en HTML/CSS** (sin librería) con tabla equivalente para lectores de pantalla.
- **Accesibilidad:** etiquetas visibles, errores asociados con `aria-describedby`, foco visible, `<dialog>` nativo para confirmaciones, enlace "saltar al contenido", respeto de `prefers-reduced-motion`.
- **Sin sobreingeniería:** sin Redux, sin librerías de formularios, sin ORM de UI.
