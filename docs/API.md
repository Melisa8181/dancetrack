# API REST de DanceTrack

Base: `http://localhost:4000/api` (en desarrollo, también `http://localhost:5173/api` mediante el proxy de Vite).
Formato JSON. La sesión viaja en la cookie `httpOnly` `dt_session` (el cliente debe enviar `credentials: 'include'`).

**Errores** (formato único):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Hay datos inválidos en la solicitud.", "details": { "durationMinutes": "La duración debe ser mayor que cero." } } }
```
Códigos HTTP: `400` validación · `401` sin sesión · `403` sin permiso · `404` no existe (o es ajeno) · `409` conflicto · `429` demasiados intentos · `500` error interno.

## Autenticación

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /auth/register` | Público | Crea un **bailarín** y abre sesión. Rechaza campos extra como `role`. |
| `POST /auth/login` | Público | Inicia sesión. |
| `POST /auth/logout` | Público | Borra la cookie. `204`. |
| `GET /auth/me` | Autenticado | Usuario actual. |

```http
POST /api/auth/register
{ "name": "Ana Ferreyra", "email": "ana@ejemplo.com", "password": "Clave12345" }

201 { "user": { "id": "cm…", "name": "Ana Ferreyra", "email": "ana@ejemplo.com", "role": "DANCER", "isActive": true, "bio": null, "mainDisciplineId": null, "mainDiscipline": null, "createdAt": "…" } }
```
Errores: `400` (contraseña débil, `role` presente), `409 EMAIL_TAKEN`, `401` credenciales incorrectas, `403 ACCOUNT_DISABLED`.

## Perfil (cualquier rol autenticado)

| Ruta | Descripción |
|---|---|
| `GET /profile` | Datos del usuario |
| `PATCH /profile` | `{ name?, email?, bio?, mainDisciplineId? }` (estricto: no admite `role`) |
| `POST /profile/password` | `{ currentPassword, newPassword }` → `204` |

## Disciplinas

`GET /disciplines` (autenticado) → `{ "items": [ { "id": 1, "name": "Ballet clásico" } ] }` solo activas.

## Entrenamientos (solo rol DANCER, solo datos propios)

| Ruta | Descripción |
|---|---|
| `GET /trainings?from=&to=&disciplineId=&page=1&pageSize=20` | Listado, más recientes primero |
| `POST /trainings` | Crear → `201 { training }` |
| `GET /trainings/:id` | Detalle (`404` si es ajeno) |
| `PUT /trainings/:id` | Reemplazo completo → `200 { training }` |
| `DELETE /trainings/:id` | `204` |

```http
POST /api/trainings
{
  "date": "2026-10-18", "disciplineId": 1, "activityType": "CLASS",
  "durationMinutes": 90, "intensity": 7, "energyLevel": 4, "restHours": 8,
  "hasDiscomfort": true, "discomfortDescription": "Molestia leve en el tobillo", "notes": "Buena clase"
}

201 { "training": { "id": "cm…", "date": "2026-10-18", "discipline": { "id": 1, "name": "Ballet clásico" }, "activityType": "CLASS", "durationMinutes": 90, "intensity": 7, "energyLevel": 4, "restHours": 8, "hasDiscomfort": true, "discomfortDescription": "Molestia leve en el tobillo", "notes": "Buena clase", "createdAt": "…", "updatedAt": "…" } }
```
Valores: `activityType` ∈ `CLASS | REHEARSAL | TECHNIQUE | CROSS_TRAINING | OTHER`; `durationMinutes` 1–600; `intensity` 1–10; `energyLevel` 1–5 (1 muy baja … 5 muy alta); `restHours` 0–24 opcional; fecha no futura (zona `APP_TIMEZONE`). Si `hasDiscomfort` es `false`, la descripción se descarta.

Listado: `200 { "items": [ … ], "total": 31, "page": 1, "pageSize": 20 }`.

## Dashboard (solo DANCER)

`GET /dashboard?weekOffset=0` (`0` = esta semana, `-1` = anterior, hasta `-104`)

```json
{
  "today": "2026-10-19", "weekOffset": 0,
  "current":  { "weekStart": "2026-10-19", "weekEnd": "2026-10-25", "sessions": 3, "totalMinutes": 255, "averageIntensity": 5.7 },
  "previous": { "weekStart": "2026-10-12", "weekEnd": "2026-10-18", "sessions": 2, "totalMinutes": 150, "averageIntensity": 6.5 },
  "comparison": { "sessionsDiff": 1, "minutesDiff": 105, "intensityDiff": -0.8 },
  "byDay": [ { "date": "2026-10-19", "sessions": 1, "minutes": 90 } ],
  "totalRecords": 16
}
```
`comparison` es `null` si la semana anterior no tuvo sesiones; `averageIntensity` es `null` sin sesiones.

## Vínculos y permisos (solo DANCER, sobre sus propios vínculos)

| Ruta | Descripción |
|---|---|
| `GET /links` | Vínculos PENDING y ACCEPTED con su profesor y permisos |
| `POST /links/:id/accept` | Acepta (permisos siguen en `false`) |
| `POST /links/:id/reject` | Rechaza (solo si está pendiente) → `204` |
| `POST /links/:id/revoke` | Revoca el vínculo y restablece permisos a privado → `204` |
| `PUT /links/:id/permissions` | Define permisos (solo vínculos ACCEPTED) |

```http
PUT /api/links/cm…/permissions
{ "shareSummary": true, "shareHistory": true, "shareEnergyRest": false, "shareDiscomfort": false, "shareNotes": false }
```

## Profesor (solo TEACHER, solo lectura)

| Ruta | Descripción |
|---|---|
| `GET /teacher/dancers` | Bailarines con vínculo aceptado |
| `GET /teacher/dancers/:dancerId/summary?weekOffset=0` | `{ dancer, permissions, summary }`; `summary` es `null` si no hay permiso |
| `GET /teacher/dancers/:dancerId/trainings?page=&pageSize=&from=&to=` | Listado según permisos; `403 NOT_SHARED` si no compartió el historial |

Respuesta de ejemplo con solo `shareSummary` y `shareHistory` activos (no aparecen `energyLevel`, `restHours`, `hasDiscomfort`, `discomfortDescription` ni `notes`):
```json
{ "permissions": { "shareSummary": true, "shareHistory": true, "shareEnergyRest": false, "shareDiscomfort": false, "shareNotes": false },
  "items": [ { "id": "cm…", "date": "2026-10-18", "activityType": "REHEARSAL", "durationMinutes": 135, "intensity": 4, "discipline": { "id": 1, "name": "Ballet clásico" } } ],
  "total": 16, "page": 1, "pageSize": 10 }
```
Si el bailarín no existe entre los vínculos aceptados del profesor: `404`.

## Administración (solo ADMIN)

| Ruta | Descripción |
|---|---|
| `GET /admin/users?search=&role=&page=&pageSize=` | Lista/busca usuarios (id, nombre, correo, rol, estado) |
| `PATCH /admin/users/:id` | `{ role?, isActive? }`. No se puede degradar/desactivar a uno mismo (`400 SELF_MODIFICATION_FORBIDDEN`) |
| `GET /admin/disciplines` | Todas, incluidas inactivas |
| `POST /admin/disciplines` | `{ name }` → `201` (`409` si existe) |
| `PATCH /admin/disciplines/:id` | `{ name?, isActive? }` |
| `GET /admin/links` | Todos los vínculos |
| `POST /admin/links` | `{ teacherId, dancerId }` → `201`, queda `PENDING` |
| `POST /admin/links/:id/revoke` | `204` |

```http
PATCH /api/admin/users/cm…
{ "role": "TEACHER" }

200 { "user": { "id": "cm…", "name": "Marta Quiroga", "email": "profe@dancetrack.test", "role": "TEACHER", "isActive": true, "createdAt": "…" } }
```

## Otros

`GET /health` → `{ "status": "ok" }`
