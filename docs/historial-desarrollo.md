# Historial de desarrollo de SIPU

Esta guía resume, en orden cronológico, cómo se construyó el repositorio y cómo continuar el desarrollo. Está pensada para que una persona nueva pueda entender el proyecto sin depender del historial completo de GitHub.

## 1. Objetivo del proyecto

SIPU (Sistema de Intermediación de Prácticas Universitarias) es una plataforma de intermediación laboral. El alcance inicial son las prácticas universitarias; posteriormente se ampliará a candidatos externos, empleo general y empleo público.

La evolución se divide en cinco fases:

- **Fase 0:** base técnica.
- **Fase 1:** MVP de prácticas.
- **Fase 2:** candidatos externos.
- **Fase 3:** bolsa de empleo general.
- **Fase 4:** agencia pública de empleo.

El backlog y los criterios de salida están en [`backlog-fases.md`](backlog-fases.md).

## 2. Estructura final del repositorio

```text
.
├── backend/                 # API Express y esquema PostgreSQL
│   ├── database/schema.sql  # Modelo relacional inicial
│   ├── src/controllers/     # Lógica de endpoints
│   ├── src/routes/          # Rutas HTTP
│   └── README.md            # Guía específica del backend
├── frontend/                # React + Vite + TypeScript + Tailwind
│   ├── src/components/      # Componentes reutilizables
│   ├── src/screens/         # Pantallas del prototipo
│   └── README.md            # Guía específica del frontend
├── docs/                    # Documentación vigente del proyecto
├── Proyecto-Archivos/       # Material histórico entregado
└── README.md                # Entrada principal del repositorio
```

## 3. Inicio del repositorio

Se creó un monorepo para mantener frontend, backend y documentación dentro del mismo proyecto. La rama estable de integración es `develop`; `main` se reserva para versiones consideradas listas para entrega.

La estrategia utilizada es similar a GitFlow:

- `main`: versión estable.
- `develop`: integración del trabajo aprobado.
- `feature/<nombre>`: trabajo aislado por funcionalidad o fase.

Cada cambio debe desarrollarse en una rama `feature/*`, registrarse en uno o varios commits claros y llegar a `develop` mediante una pull request.

## 4. Configuración del frontend

El frontend se inicializó con React, Vite y TypeScript. Tailwind CSS se integró mediante el plugin `@tailwindcss/vite`, compatible con la configuración actual de Tailwind v4.

El prototipo contiene pantallas visuales para autenticación, estudiantes, empresas y candidatos externos. Estas pantallas permiten validar navegación y diseño, pero no representan todavía una autenticación real ni una conexión con la API.

Comandos principales:

```powershell
cd frontend
npm install
npm run dev
npm run build
```

La guía detallada está en [`../frontend/README.md`](../frontend/README.md).

## 5. Configuración del backend

El backend se creó con Node.js y Express. En la Fase 0 se dejó disponible el endpoint:

```text
GET /api/health
```

Respuesta esperada:

```json
{"service":"sipu-backend","status":"ok"}
```

La ruta se separó en un controlador y un módulo de rutas para dejar preparada la estructura de la Fase 1:

- `backend/src/controllers/health.controller.js`
- `backend/src/routes/health.routes.js`
- `backend/src/server.js`

Comandos principales:

```powershell
cd backend
npm install
npm run dev
```

La guía detallada está en [`../backend/README.md`](../backend/README.md).

## 6. Variables de entorno

El archivo raíz `.env.example` contiene valores de referencia para `PORT` y `DATABASE_URL`. Cada desarrollador debe crear sus archivos locales `.env`; nunca se deben subir contraseñas, tokens ni cadenas de conexión reales.

Ejemplo para el backend:

```powershell
cd backend
Copy-Item ..\.env.example .env
```

## 7. Diseño de PostgreSQL

Se diseñó un esquema inicial en `backend/database/schema.sql`. El modelo separa:

- usuarios y credenciales;
- roles y permisos;
- perfiles funcionales;
- estudiantes y candidatos;
- organizaciones;
- ofertas;
- postulaciones;
- convocatorias y verificaciones futuras.

El diseño evita asociar una oferta exclusivamente con estudiantes y permite que la misma plataforma evolucione hacia empleo general y empleo público. Las decisiones completas están en [`database-schema.md`](database-schema.md).

Para aplicarlo en una base local:

```powershell
psql -U postgres -d sipu -f backend/database/schema.sql
```

La API todavía no consume la base de datos. Esa integración pertenece a la Fase 1.

## 8. Integración del prototipo

El prototipo visual se importó y se configuró dentro de `frontend/`. Durante la integración se resolvieron conflictos de configuración entre el prototipo y la base inicial del proyecto, conservando la configuración de Vite, TypeScript y Tailwind necesaria para compilar.

La compilación validada fue:

```powershell
cd frontend
npm run build
```

## 9. Pull requests y commits principales

El trabajo se integró progresivamente en GitHub:

- PR #24: integración de la configuración base en `main`.
- PR #26: integración del prototipo visual en `develop`.
- PR #27: documentación, esquema PostgreSQL y cierre de la Fase 0 en `develop`.

Commits relevantes:

- `a04620d`: integración de la configuración base.
- `e09c901`: merge del prototipo en `develop`.
- `ab186d0`: documentación y base técnica de Fase 0.
- `3ebe326`: merge de la PR #27 en `develop`.

Las ramas de funcionalidades ya integradas pueden eliminarse cuando no tengan trabajo exclusivo pendiente. La rama activa de desarrollo debe ser siempre una rama nueva basada en el `develop` actualizado.

## 10. Estado actual

La Fase 0 está integrada en `develop`. El repositorio dispone de:

- frontend ejecutable y compilable;
- backend Express con endpoint de salud;
- documentación de instalación;
- estructura inicial de rutas y controladores;
- esquema PostgreSQL documentado;
- estrategia de ramas y pull requests.

El prototipo sigue siendo visual. La Fase 1 debe comenzar con la implementación real de autenticación, registro, persistencia y conexión entre frontend y backend.

## 11. Procedimiento recomendado para el siguiente desarrollo

Antes de iniciar una historia:

1. Actualice `develop`:

   ```powershell
   git switch develop
   git pull origin develop
   ```

2. Cree una rama descriptiva:

   ```powershell
   git switch -c feature/autenticacion-api
   ```

3. Implemente una historia de usuario y sus pruebas.
4. Ejecute las validaciones del frontend y backend.
5. Registre un commit pequeño y descriptivo:

   ```powershell
   git add .
   git commit -m "feat(auth): implementa registro y login"
   ```

6. Publique la rama y cree una PR hacia `develop`:

   ```powershell
   git push -u origin feature/autenticacion-api
   gh pr create --base develop --head feature/autenticacion-api
   ```

7. Tras la revisión y el merge, elimine la rama de trabajo si ya no se necesita.

## 12. Inicio de la Fase 1

La Fase 1 se inició en la rama `feature/fase-1-autenticacion` con la configuración necesaria para conectar la API a PostgreSQL y preparar el primer bloque funcional del MVP.

### 12.1. Conexión a PostgreSQL

Se añadieron los siguientes elementos:

- `backend/src/config/env.js`: carga `dotenv` y expone las variables de entorno del proyecto.
- `backend/src/config/database.js`: crea un `Pool` de PostgreSQL usando `DATABASE_URL`.
- `backend/src/server.js`: comprueba la conexión al arrancar y expone el endpoint `/api/db-check`.
- `.env.example`: incorpora `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET` y `JWT_EXPIRES_IN`.

La conexión se hace mediante la cadena:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sipu
```

Esto permite crear una base local llamada `sipu` y apuntar la API a ella. El cliente oficial de PostgreSQL para Node.js es `pg`, que proporciona el `Pool` de conexiones y la ejecución de consultas.

### 12.2. Qué hace la conexión en práctica

En este punto, la API no inserta ni consulta todavía datos reales, pero ya tiene la base técnica para hacerlo. El flujo es el siguiente:

1. La aplicación carga `.env`.
2. `config/database.js` construye un `Pool` con la URL de conexión.
3. El servidor ejecuta `SELECT NOW()` al iniciar si `DATABASE_URL` existe.
4. Si la conexión falla, se registra un warning y se deja el sistema en estado preparado para continuar con la implementación de autenticación.

### 12.3. Siguientes objetivos de la Fase 1

Los siguientes pasos reales son:

- crear la base `sipu` localmente;
- ejecutar el esquema `backend/database/schema.sql`;
- probar la conexión con `GET /api/db-check`;
- implementar registro e inicio de sesión con `bcrypt` y JWT;
- crear la gestión de ofertas y postulaciones;
- conectar el frontend con estos endpoints.

### 12.4. Implementación real de autenticación

Durante la rama `feature/fase-1-autenticacion` se dejó preparada la autenticación con persistencia real en PostgreSQL. La API ya es capaz de:

- registrar un usuario con email, nombre completo y contraseña;
- comprobar si el email ya existe;
- hash de la contraseña con `bcrypt`;
- asignar el rol `USUARIO` al crear la cuenta;
- emitir un JWT con `jsonwebtoken` para el flujo de login;
- validar credenciales y devolver el usuario autenticado con su token.

La estructura de autenticación quedó en los archivos:

- `backend/src/controllers/auth.controller.js`
- `backend/src/config/env.js`
- `backend/src/server.js`

Se añadió además la configuración de dependencias `bcrypt` y `jsonwebtoken` al proyecto del backend para permitir el registro y login reales sin depender de datos temporales.

### 12.5. Middleware JWT y perfil autenticado

La segunda entrega de la Fase 1 añadió protección de rutas y una primera operación autenticada:

- `backend/src/middleware/auth.middleware.js` valida el encabezado `Authorization: Bearer <token>`.
- El mismo middleware expone `requireRole(...)` para las siguientes historias basadas en permisos.
- `backend/src/routes/profile.routes.js` publica `GET /api/profile/me`.
- `backend/src/controllers/profile.controller.js` consulta el usuario y sus roles/perfiles desde PostgreSQL.
- `backend/src/server.js` registra el nuevo grupo de rutas bajo `/api/profile`.

La validación ejecutada sobre el backend local confirmó:

- registro HTTP `201`;
- consulta de perfil autenticado HTTP `200`;
- rechazo sin token HTTP `401`;
- conexión PostgreSQL correcta durante el arranque.

### 12.6. Gestión de ofertas y postulaciones

Durante la continuación de la Fase 1 se añadieron los módulos de negocio del MVP para prácticas universitarias:

- `backend/src/controllers/offers.controller.js` implementa crear, listar, consultar, actualizar y eliminar ofertas.
- `backend/src/controllers/applications.controller.js` gestiona la postulación del estudiante y el cambio de estado por parte de la empresa.
- `backend/src/routes/offers.routes.js` y `backend/src/routes/applications.routes.js` exponen los endpoints del modelo de negocio.
- `backend/src/server.js` monta ambos grupos bajo `/api/offers` y `/api/applications`.

Los flujos verificados mediante peticiones reales contra la API local fueron:

- registro de una empresa autenticada;
- creación de una oferta pública con validación de permisos;
- listado público de ofertas;
- registro de un estudiante autenticado;
- postulación a una oferta con `cartaPresentacion`;
- consulta de postulaciones del estudiante;
- consulta de postulaciones recibidas por la empresa;
- actualización de estado de la postulación a `PRESELECCIONADA`.

La validación ejecutada devolvió respuestas con `201`/`200` y confirmó que la lógica de negocio del MVP funciona con PostgreSQL real.

## 13. Fase 2 — Candidatos externos

Se añadió el flujo para personas que no son estudiantes. Un usuario puede registrarse con tipo de perfil `CANDIDATO_EXTERNO` y completar su perfil laboral.

- `registerController` acepta el tipo de perfil y crea la fila correspondiente en `perfiles_candidato`.
- `profile.controller.js` expone `PUT /api/profile/external` para editar resumen, ubicación, disponibilidad y CV.
- Las postulaciones resuelven el perfil candidato priorizando `CANDIDATO_EXTERNO` sobre `ESTUDIANTE`.
- El frontend incorpora `ExternalDashboard`, `ExternalProfile`, `ExternalApplications` y `ExternalJobDetail`.

## 14. Fase 3 — Bolsa de empleo general

La Fase 3 unifica el catálogo para estudiantes y candidatos externos, permite clasificar ofertas y añade verificación de organizaciones y recomendaciones.

### 14.1. Ofertas generales y tipos de oferta

- Las ofertas usan los tipos `PRACTICA`, `EMPLEO` y `EMPLEO_PUBLICO`.
- `offers.controller.js` centraliza los tipos y estados válidos (`OFFER_TYPES`, `OFFER_STATUSES`).
- La migración `20261008_offer_details.sql` añade área, requisitos, duración, horario y correo de contacto.

### 14.2. Verificación de organizaciones (#17 HU-13)

- `verifications.controller.js` y `verifications.routes.js` permiten listar organizaciones y registrar decisiones.
- Aprobar activa `organizaciones.verificada`; cada decisión queda en el historial `verificaciones`.
- La migración `20261008_organization_verification.sql` asegura la tabla y la columna en bases existentes.
- El panel `CompanyVerification` del frontend permite aprobar o rechazar.

### 14.3. Recomendación de ofertas (#20 HU-16)

- `GET /api/offers/recommended` ordena las ofertas publicadas por afinidad con el perfil del candidato.
- No excluye ofertas: solo las reordena. Si no hay perfil candidato, devuelve `403`.

El detalle completo está en [`informe-cierre-fase-3.md`](informe-cierre-fase-3.md).

### 14.4. Refactor de soporte

Como parte de la Fase 3 se centralizaron helpers para eliminar duplicación: `backend/src/utils/payload.js` y `backend/src/utils/profiles.js`, y `frontend/src/lib/offers.ts`.

## 15. Fase 4 — Agencia pública de empleo

- Convocatorias públicas (#18 HU-14): lectura pública y gestión para `ADMINISTRADOR` y `FUNCIONARIO_PUBLICO`.
- Estadísticas de empleo (#21 HU-17): indicadores agregados sin datos personales.

El detalle está en [`informe-cierre-fase-4.md`](informe-cierre-fase-4.md).

## 16. Fase 5 — Calidad, pruebas y corrección del inicio de sesión

Rama `feature/fase-5-calidad`. Commits:

1. `fix(backend)`: seguridad de autenticación y roles, validaciones, administración de usuarios y migraciones versionadas.
2. `test(backend)`: 80 pruebas de la API con `node:test` y `supertest` sobre una base `<base>_test`.
3. `fix(frontend)`: corrección de la pantalla en blanco tras el login, estado de carga, sesión, botones sin función y pantallas nuevas ("Mi empresa", "Usuarios").
4. `test(frontend)`: 21 pruebas con Vitest y Testing Library.
5. `docs`: este historial, el informe de la fase y las guías actualizadas.

Causa del fallo en Vercel: una oferta con la modalidad `"H�brida"` (texto enviado sin UTF-8) hacía fallar `ExternalDashboard` y desmontaba la aplicación. El detalle completo, la lista de errores corregidos y los pasos para publicar están en [`informe-fase-5-calidad.md`](informe-fase-5-calidad.md).

Desde esta fase, todo cambio debe mantener en verde `npm test` en `backend` y `frontend`.

## 17. Fase 6 — Hoja de vida, archivos y recuperación de contraseña

Rama `feature/fase-6-perfil-archivos`. Commits:

1. `feat(backend)`: tablas de hoja de vida, archivos y tokens de recuperación; endpoints de detalle, archivos, `forgot-password` y `reset-password`; `token_version` para cerrar sesiones; tipo `FORMACION`.
2. `feat(frontend)`: editor de hoja de vida, subida de CV y foto, vista del postulante para la empresa, recuperación de contraseña y selector de tipo de oferta.
3. `docs`: informe de la fase y guías actualizadas.

Decisiones: los archivos se guardan en PostgreSQL (`BYTEA`) porque el disco de Render se borra en cada despliegue; el correo usa la API HTTP de Resend sin dependencias nuevas; las sesiones se invalidan con un contador de versión en lugar de una marca de tiempo, para no depender de los relojes.

El detalle está en [`informe-fase-6-perfil-archivos.md`](informe-fase-6-perfil-archivos.md).

## 18. Regla para mantener la documentación

Cada fase o cambio importante debe actualizar la documentación correspondiente. Si se modifica la forma de arrancar el proyecto, actualice los README. Si cambia el modelo de datos, actualice `database-schema.md` y `backend/database/schema.sql`. Si cambia la estrategia de ramas o una decisión técnica, registre el cambio en este historial.
