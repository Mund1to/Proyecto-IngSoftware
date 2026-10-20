# Arquitectura de SIPU

Guía de cómo está organizado el código, qué reglas lo mantienen ordenado y qué archivos se tocan para cambiar o agregar una tecnología. El detalle de cada lado está en [`backend/README.md`](../backend/README.md) y [`frontend/README.md`](../frontend/README.md).

## 1. Visión general

SIPU es un monorepo con dos aplicaciones que se despliegan por separado:

- **Backend** (`backend/`): API REST en Express 5 y PostgreSQL, desplegada en Render. Es un **monolito modular**: un solo servicio, con el código dividido en módulos por funcionalidad.
- **Frontend** (`frontend/`): aplicación React 18 + Vite + TypeScript + Tailwind 4, desplegada en Vercel. Está organizada **por funcionalidades** (una variante simplificada de Feature-Sliced Design).

Las funcionalidades llevan el mismo nombre en los dos lados. Quien busca "postulaciones" encuentra `backend/src/modules/applications/` y `frontend/src/features/applications/`.

| Funcionalidad | Backend (`src/modules/`) | Frontend (`src/features/`) | Tablas principales |
| --- | --- | --- | --- |
| Acceso y recuperación de contraseña | `auth/` | `auth/` | `usuarios`, `usuario_roles`, `password_resets` |
| Cuenta, perfiles, hoja de vida y archivos | `profile/` | `profile/` | `perfiles`, `perfiles_*`, `organizaciones`, `perfil_*`, `archivos` |
| Ofertas y recomendaciones | `offers/` | `offers/` | `ofertas` |
| Postulaciones | `applications/` | `applications/` | `postulaciones` |
| Verificación de empresas | `verifications/` | `verifications/` | `verificaciones`, `documentos_verificacion` |
| Convocatorias públicas | `convocatorias/` | `convocatorias/` | `convocatorias` |
| Estadísticas de empleo | `stats/` | `stats/` | (consultas agregadas) |
| Gestión de usuarios | `admin/` | `admin/` | `usuarios`, `usuario_roles` |

## 2. Backend: capas por módulo

```text
routes  ->  controller  ->  service  ->  repository  ->  PostgreSQL
 (URL)      (HTTP)          (reglas)     (único SQL)
```

- **`*.routes.js`:** declara las URL y los middlewares de autenticación y roles.
- **`*.controller.js`:** lee la petición y arma la respuesta. No contiene lógica. Está envuelto en `asyncHandler`, que convierte un `HttpError` en `{ ok: false, message }` con su código de estado.
- **`*.service.js`:** reglas de negocio. No conoce Express ni SQL, y lanza `badRequest`, `forbidden`, `notFound` o `conflict`.
- **`*.repository.js`:** el único archivo con SQL. Las funciones que deben ir dentro de una transacción reciben `db`, y el servicio las agrupa con `withTransaction`.
- **Reglas puras sin base de datos** (constantes, validación, puntajes): en `*.domain.js`, `*.rules.js`, `*.validation.js` y `*.scoring.js`. Se prueban en `tests/unit.test.js`.

**Lo común a todos los módulos** está en `src/core/`:

| Carpeta | Contenido |
| --- | --- |
| `config/` | Variables de entorno |
| `database/` | Pool, `withTransaction` y migraciones |
| `http/` | Errores, lectura del cuerpo, paginación y archivos |
| `mail/` | Envío de correos con Resend |
| `middleware/` | Autenticación, roles, límite de peticiones y cabeceras de seguridad |
| `security/` | Regla de contraseñas |

## 3. Frontend: capas

```text
app/       ->  features/<funcionalidad>/  ->  shared/
(shell)        (pantallas, API, modelo)       (sin dependencias del resto)
```

- **`app/`:** el armazón de la aplicación.
  - `App.tsx`: estado global y acciones.
  - `routes.tsx`: tabla de pantallas.
  - `types.ts`: `Screen`, `AppState` y `ScreenProps`.
  - `session.tsx`: usuario de la sesión y contexto.
  - `NavBar.tsx` y `ErrorBoundary.tsx`.
- **`features/<x>/`:** todo lo de una funcionalidad.
  - Sus pantallas.
  - Sus llamadas a la API (`x.api.ts`, que exporta `xApi`).
  - Su modelo (`x.model.ts`): tipos y conversión de las filas de la API al formato de las pantallas.
  - Sus componentes propios.
- **`shared/`:** código reutilizable que no conoce ninguna funcionalidad.
  - `api/client.ts`: cliente HTTP, `ApiError` y archivos protegidos.
  - `api/account.ts`: forma de la cuenta.
  - `ui/`: componentes visuales.
  - `lib/`: formato, contraseñas y almacenamiento local.
  - `assets/`: imágenes.
- **`styles/`:** un archivo por sección. `index.css` los importa en orden, porque cada uno puede sobrescribir a los anteriores.

Reglas que comprueba `src/test/architecture.test.ts`:

1. `shared/` no importa nada de `app/` ni de `features/`.
2. Una funcionalidad no importa las pantallas de otra. Sí puede usar su API, su modelo o un componente suyo. Por ejemplo, `profile/CompanyProfile` muestra `verifications/OrganizationVerificationPanel`.

## 4. Contrato entre frontend y backend

Algunos valores se repiten a propósito en los dos lados: el frontend los necesita para mostrar etiquetas y validar antes de enviar. `frontend/src/test/contracts.test.ts` importa los módulos puros del backend y comprueba que coincidan:

| Dato | Backend | Frontend |
| --- | --- | --- |
| Tipos de oferta y tipos que ve el externo | `offers/offers.domain.js` | `features/offers/offers.model.ts` |
| Modalidades | `offers/offers.domain.js` | `normalizeModality` |
| Estados de postulación | `applications/applications.domain.js` | `features/applications/applications.model.ts` |
| Tipos de documento y motivo mínimo de rechazo | `verifications/verifications.rules.js` | `features/verifications/verification.ts` |
| Regla de contraseña | `core/security/password.js` | `shared/lib/password.ts` |

Para agregar un tipo de oferta, un estado o un tipo de documento:

1. Cambia el backend: la migración, si es un `ENUM`, y el `*.domain.js`.
2. Cambia el frontend.
3. Corre `npm test` en `frontend/`; la prueba de contrato falla si falta un lado.

## 5. Cómo agregar una funcionalidad completa

1. **Base de datos:** una migración idempotente en `backend/database/migrations/AAAAMMDD_<nombre>.sql`. Documéntala en `docs/database-schema.md`.
2. **Backend:** crea `src/modules/<nombre>/` con `routes`, `controller`, `service` y `repository`, y monta el router en `src/app.js` (`app.use('/api/<nombre>', router)`).
3. **Pruebas del backend:**
   - un archivo `tests/<nombre>.test.js` con supertest;
   - las reglas puras van en `tests/unit.test.js`.
4. **Frontend:**
   1. Crea `src/features/<nombre>/` con `<nombre>.api.ts` (las llamadas), `<nombre>.model.ts` si hace falta convertir datos, y las pantallas.
   2. Registra cada pantalla nueva en dos sitios: su nombre en `Screen` (`app/types.ts`) y su componente en `SCREENS` (`app/routes.tsx`).
   3. Si el menú la muestra, agrégala a `links` en `app/NavBar.tsx`.
   4. Si la pantalla necesita una acción global nueva, súmala a `ScreenProps` y a `App.tsx`.
5. **Documentación:**
   - una sección en `docs/historial-desarrollo.md`;
   - el informe de la fase;
   - los endpoints en `backend/README.md`.

## 6. Cómo cambiar o agregar una tecnología

| Si quieres... | Se toca | No se toca |
| --- | --- | --- |
| Usar un ORM (Prisma, Knex, Drizzle) u otro motor SQL | Los `*.repository.js` y `core/database/` | Servicios, controladores y rutas |
| Guardar archivos en S3, Cloudflare R2 o Supabase Storage en lugar de `BYTEA` | `profileDetails.repository.js`, `verifications.repository.js` y `core/http/files.js` (`sendStoredFile` pasaría a redirigir a una URL firmada) | Validación de archivos y servicios |
| Cambiar Resend por otro proveedor de correo | `core/mail/mailer.js` | Los módulos que llaman a `sendEmail` |
| Cambiar el formato del token o usar sesiones | `auth/auth.tokens.js` y `core/middleware/auth.middleware.js` | Los demás módulos |
| Compartir el límite de peticiones entre varias instancias (Redis) | `core/middleware/rateLimit.middleware.js` | Las rutas que lo usan |
| Cambiar `fetch` por axios, o agregar reintentos o cabeceras comunes | `frontend/src/shared/api/client.ts` | Los `*.api.ts` y las pantallas |
| Agregar caché de datos (TanStack Query) | Las pantallas, usando las funciones de `*.api.ts` como `queryFn` | `client.ts` |
| Agregar URL propias con `react-router` | `app/routes.tsx` (ya es una tabla), `navigate` en `App.tsx` y un `vercel.json` con *rewrites* hacia `index.html` | Las funcionalidades, salvo las pantallas de detalle que hoy reciben la oferta por estado y tendrían que cargarla por id |
| Cambiar Tailwind o el sistema de estilos | `frontend/src/styles/` y las clases de las pantallas | Lógica y API |
| Agregar otra aplicación cliente (móvil, panel aparte) | Nada en el backend: la API ya es independiente del frontend | — |

## 7. Verificación

GitHub Actions (`.github/workflows/ci.yml`) corre en cada push a `main` o `develop` y en cada pull request:

- **Backend:** `npm test` contra un PostgreSQL de servicio.
- **Frontend:** `npm run typecheck`, `npm test` (incluye las pruebas de arquitectura y de contrato) y `npm run build`.

`tsconfig.json` activa `noUnusedLocals` y `noUnusedParameters`, así que el código sin uso no pasa el typecheck.

## 8. Deuda conocida

- **Pantallas por rol con mucho en común.** `StudentDashboard`/`ExternalDashboard`, `OfferDetail`/`ExternalJobDetail`, `StudentApplications`/`ExternalApplications` y `StudentProfile`/`ExternalProfile` siguen diseños y textos distintos para cada público. Unificarlas en una pantalla configurable reduciría código, pero cambia lo que ve el usuario y requiere decidirlo con diseño.
- **Regla de qué perfil representa al candidato** (el de candidato externo tiene prioridad sobre el de estudiante). Está repetida en tres consultas: `applications.repository.js`, `offers.repository.js` y `profileDetails.repository.js`.
- **La prueba integral con navegador** (27 pasos entre roles) se ejecuta a mano con Playwright y no forma parte del repositorio ni de CI.
