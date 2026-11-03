# Arquitectura y decisiones técnicas

## 1. Estructura del proyecto

DanceTrack está organizado en dos aplicaciones independientes: un frontend y un backend que se comunican mediante una API REST.

```text
dancetrack/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── scripts/
│   │   └── createAdmin.ts
│   ├── src/
│   │   ├── config/       # Validación de variables de entorno
│   │   ├── lib/          # Prisma, errores HTTP, fechas y serializadores
│   │   ├── middleware/   # Autenticación, autorización y manejo de errores
│   │   ├── routes/       # Rutas de la API REST
│   │   ├── services/     # Lógica de negocio y métricas
│   │   └── validation/   # Esquemas de validación con Zod
│   └── tests/            # Pruebas con Vitest y Supertest
│
└── frontend/
    └── src/
        ├── api/          # Cliente HTTP y tipos
        ├── auth/         # Contexto de autenticación y guardas de rutas
        ├── components/   # Componentes reutilizables
        ├── lib/          # Formato y validaciones
        └── pages/        # Páginas de la aplicación
```

El frontend se comunica exclusivamente con la API REST. Nunca accede directamente a PostgreSQL.

## 2. Modelo de datos

El modelo relacional se compone de cinco entidades principales:

```text
User 1 ───── N Training N ───── 1 Discipline
 │                                  ▲
 └── mainDiscipline (opcional) ─────┘

User 1 ───── N TeacherLink (teacherId)
User 1 ───── N TeacherLink (dancerId)

TeacherLink 1 ───── 1 SharingPermission
```

### Entidades y restricciones

| Entidad             | Descripción                                           | Restricciones relevantes                                                                 |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `User`              | Cuenta de usuario                                     | Email único normalizado a minúsculas; roles DANCER, TEACHER y ADMIN; índice por rol      |
| `Discipline`        | Catálogo de disciplinas gestionado por administración | Nombre único; las disciplinas se desactivan en lugar de eliminarse                       |
| `Training`          | Registro de una sesión de entrenamiento               | FK a usuario (CASCADE) y disciplina (RESTRICT); índice `(userId, date)`                  |
| `TeacherLink`       | Asociación entre profesor y bailarín                  | Estados PENDING, ACCEPTED, REJECTED y REVOKED; combinación `(teacherId, dancerId)` única |
| `SharingPermission` | Permisos de acceso a la información de un bailarín    | Cinco permisos booleanos, todos `false` por defecto; un registro por vínculo             |

Las contraseñas se almacenan mediante hashes generados con bcrypt.

La tabla `Training` incorpora restricciones CHECK para garantizar:

- Duración: entre 1 y 600 minutos.
- Intensidad: entre 1 y 10.
- Nivel de energía: entre 1 y 5.
- Horas de descanso: entre 0 y 24.

También se utiliza una restricción para impedir que un usuario sea profesor y bailarín del mismo vínculo.

### Manejo de fechas

Las fechas de entrenamiento se almacenan como `DATE`, sin información de zona horaria, y se transportan como texto en formato `AAAA-MM-DD`.

El cálculo de la fecha actual y los límites de fechas futuras utilizan la variable `APP_TIMEZONE`, configurada por defecto en `America/Argentina/Buenos_Aires`.

Las escalas de intensidad y energía se almacenan como enteros y cuentan con restricciones CHECK a nivel de base de datos.

## 3. Roles y permisos

El sistema implementa tres roles: bailarín, profesor y administrador.

| Capacidad                                   | Bailarín |    Profesor    | Administrador |
| ------------------------------------------- | :------: | :------------: | :-----------: |
| Registro público                            |    Sí    |       No       |      No       |
| Consultar y editar su perfil                |    Sí    |       Sí       |      Sí       |
| Cambiar su contraseña                       |    Sí    |       Sí       |      Sí       |
| Gestionar sus propios entrenamientos        |    Sí    |       No       |      No       |
| Consultar su historial y dashboard          |    Sí    |       No       |      No       |
| Aceptar, rechazar o revocar vínculos        |    Sí    |       No       |      No       |
| Configurar permisos de privacidad           |    Sí    |       No       |      No       |
| Consultar bailarines vinculados y aceptados |    No    |       Sí       |      No       |
| Consultar información compartida            |    No    | Según permisos |      No       |
| Modificar entrenamientos ajenos             |    No    |       No       |      No       |
| Listar y buscar usuarios                    |    No    |       No       |      Sí       |
| Modificar roles y gestionar cuentas         |    No    |       No       |      Sí       |
| Gestionar disciplinas                       |    No    |       No       |      Sí       |
| Crear o revocar vínculos                    |    No    |       No       |      Sí       |

### Permisos de acceso del profesor

Cada bailarín puede configurar individualmente qué información comparte con sus profesores.

Los cinco permisos disponibles son:

- `shareSummary`: métricas y resumen de actividad.
- `shareHistory`: fecha, disciplina, tipo de actividad, duración e intensidad.
- `shareEnergyRest`: energía y descanso.
- `shareDiscomfort`: molestias registradas.
- `shareNotes`: observaciones personales.

Todos los permisos comienzan desactivados.

Los permisos de energía y descanso, molestias y observaciones requieren que también esté habilitado el acceso al historial.

## 4. Seguridad y protección de datos

### Autenticación y sesiones

- La autenticación utiliza JWT firmado.
- El token se almacena en una cookie `httpOnly` con una duración de siete días.
- Se utiliza `SameSite=Lax` y el atributo `Secure` en producción.
- No se almacenan tokens en `localStorage`.
- En cada petición autenticada se vuelve a consultar el usuario en la base de datos. De esta manera, los cambios de rol y la desactivación de cuentas tienen efecto inmediato.

### Contraseñas

- Los hashes se generan mediante bcrypt con costo 12.
- La política de contraseñas exige entre 8 y 72 caracteres, al menos una letra y un número.
- Las contraseñas originales nunca se almacenan.

### Autorización en el servidor

- Los routers utilizan middleware de autenticación y autorización por rol.
- La propiedad de los recursos se verifica en las consultas a la base de datos.
- Los intentos de acceder a entrenamientos ajenos responden con HTTP 404, evitando revelar su existencia.

### Privacidad entre profesores y bailarines

- El vínculo debe estar en estado `ACCEPTED`.
- El acceso a la información depende de los permisos configurados por el bailarín.
- La consulta utiliza una selección explícita de campos autorizados para evitar devolver información privada.
- Al revocar un vínculo, se interrumpe el acceso y los permisos vuelven a estar desactivados.

### Protección de roles

- Los esquemas de registro y perfil utilizan `.strict()` y rechazan campos adicionales, incluido `role`.
- El cambio de roles se realiza exclusivamente mediante el endpoint administrativo correspondiente.
- Un administrador no puede degradar su propio rol ni desactivar su propia cuenta.

### Protección de solicitudes

- CORS se limita al origen configurado mediante `CLIENT_ORIGIN`.
- Se rechazan solicitudes que modifican datos cuando provienen de un origen no autorizado.
- Se utilizan cookies con `SameSite=Lax`.
- Helmet agrega encabezados de seguridad.
- El tamaño máximo del cuerpo de las solicitudes es de 50 kB.
- Se limita la cantidad de intentos de inicio de sesión y registro.
- Los mensajes de error de autenticación evitan revelar información innecesaria.

### Privacidad de los entrenamientos

Los administradores pueden gestionar cuentas y disciplinas, pero no disponen de endpoints para consultar entrenamientos u observaciones privadas de otros usuarios.

Los endpoints de entrenamientos requieren el rol de bailarín y verifican la propiedad de los registros.

## 5. Decisiones técnicas

### Express 5 y Zod

Express 5 permite gestionar los errores de operaciones asíncronas mediante el mecanismo de manejo de errores del framework.

Zod se utiliza para validar las solicitudes mediante esquemas declarativos y mensajes en español. Las validaciones también se reutilizan en el script de creación de administradores.

### Prisma y PostgreSQL

Se utiliza Prisma ORM con el adaptador `pg` y `engineType = "client"`.

Esta configuración permite utilizar el cliente de Prisma mediante el adaptador de PostgreSQL, sin depender del motor binario tradicional.

Las migraciones SQL se mantienen versionadas en `prisma/migrations/`. Las restricciones CHECK se incorporaron mediante una migración adicional.

### Dashboard calculado en el servidor

Las métricas se calculan en `services/dashboard.ts` a partir de los entrenamientos persistidos.

Definiciones utilizadas:

- **Semana:** lunes a domingo.
- **Sesiones:** cantidad de registros de entrenamiento.
- **Tiempo total:** suma de minutos registrados.
- **Intensidad promedio:** promedio simple de la intensidad de las sesiones, expresado con un decimal.
- **Comparación semanal:** diferencia respecto de la semana anterior, cuando existen registros para realizarla.

El mismo cálculo se utiliza para el resumen que puede consultar un profesor autorizado.

### Vínculos entre profesores y bailarines

Los vínculos son creados por un administrador y deben ser aceptados por el bailarín.

Esta decisión permite que el acceso a la información sea explícito y evita que un profesor pueda solicitar acceso libremente a cualquier usuario.

### Comunicación entre frontend y backend

Se utiliza un proxy de Vite durante el desarrollo para facilitar la comunicación entre frontend y API bajo un mismo origen.

En producción, Vercel redirige las solicitudes `/api` al backend desplegado en Render.

### Componentes y accesibilidad

- Se utiliza un gráfico propio implementado con HTML y CSS, sin incorporar una librería externa de gráficos.
- El gráfico cuenta con una tabla equivalente para facilitar la consulta de la información.
- Los formularios utilizan etiquetas visibles y mensajes de error asociados mediante `aria-describedby`.
- Se contempla el foco visible y la navegación mediante teclado.
- Se utiliza el elemento nativo `<dialog>` para confirmaciones.
- Se incluye un enlace para saltar directamente al contenido principal.
- Se respeta la preferencia `prefers-reduced-motion`.

### Alcance de las dependencias

Se priorizaron herramientas que resolvieran necesidades concretas del proyecto, evitando incorporar dependencias innecesarias.

Por ejemplo, no se incorporó Redux para la gestión de estado ni una librería externa de formularios.

## 6. Arquitectura de despliegue

La aplicación se encuentra desplegada utilizando los siguientes servicios:

| Componente    | Servicio        |
| ------------- | --------------- |
| Frontend      | Vercel          |
| Backend       | Render          |
| Base de datos | Neon PostgreSQL |
| Código fuente | GitHub          |

El frontend consume la API mediante el proxy configurado en Vercel. El backend administra las solicitudes y se conecta a PostgreSQL mediante Prisma.
