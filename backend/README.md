# Backend de SIPU

API HTTP de SIPU, construida con Node.js y Express.

Expone autenticación JWT, perfiles, ofertas, postulaciones, verificación de organizaciones, convocatorias, estadísticas y administración de usuarios. Al arrancar crea el esquema si la base está vacía y aplica las migraciones pendientes.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL 15 o superior para ejecutar la base de datos local.

## Configuración

Desde la carpeta `backend`, copie las variables de ejemplo a un archivo local `.env` y ajuste sus valores:

```bash
copy .env.example .env
```

En PowerShell también puede utilizar:

```powershell
Copy-Item .env.example .env
```

Variables disponibles:

| Variable | Descripción | Valor de ejemplo |
| --- | --- | --- |
| `PORT` | Puerto HTTP de la API | `3000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://usuario:contraseña@localhost:5432/sipu` |
| `JWT_SECRET` | Secreto para firmar tokens. **Obligatorio en producción**: con el valor por defecto la API no arranca. | valor aleatorio |
| `JWT_EXPIRES_IN` | Vigencia de los tokens | `7d` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas. Vacío permite cualquiera. | `https://sipu.vercel.app` |
| `APP_URL` | URL pública del frontend, usada en el enlace de recuperación de contraseña. | `https://sipu.vercel.app` |
| `RESEND_API_KEY` | Clave de Resend para enviar correos. Sin ella, en desarrollo el enlace se muestra en la consola. | `re_...` |
| `MAIL_FROM` | Remitente de los correos. | `SIPU <no-responder@dominio>` |
| `TEST_DATABASE_URL` | Base para `npm test`. Por defecto, la de `DATABASE_URL` con el sufijo `_test`. | `postgresql://.../sipu_test` |

El archivo `.env` no se versiona.

## Ejecutar en desarrollo

```bash
cd backend
npm install
npm run dev
```

El servidor quedará disponible en `http://localhost:3000`.

## Ejecutar en modo normal

```bash
cd backend
npm start
```

## Verificar el servicio

Con el backend ejecutándose, abra `http://localhost:3000/api/health` o ejecute:

```bash
curl http://localhost:3000/api/health
```

La respuesta esperada es:

```json
{"service":"sipu-backend","status":"ok"}
```

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Express con reinicio automático mediante `node --watch`. |
| `npm start` | Inicia Express sin modo de vigilancia. |
| `npm test` | Ejecuta las 145 pruebas de la API (`node:test` + `supertest`) sobre una base `<base>_test` que se recrea en cada ejecución. |
| `npm run grant-role -- correo ROL` | Asigna `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO` a una cuenta existente. Sirve para crear el primer administrador. |

## Seguridad

- Los roles y el estado de la cuenta se consultan en la base en cada petición autenticada; retirar un rol o desactivar una cuenta aplica de inmediato.
- `/api/auth/login` admite 10 intentos por IP y correo cada 15 minutos.
- Un identificador no numérico en la URL responde `400`, igual que el JSON mal formado o el texto con codificación inválida.
- Todas las respuestas llevan `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Content-Security-Policy: default-src 'none'`. En producción llevan además HSTS. No se envía `X-Powered-By`.
- Los archivos subidos (CV, foto y documentos de verificación) se validan por su firma binaria y no solo por `Content-Type`.
- Ante `SIGTERM` o `SIGINT` el servidor termina las peticiones en curso y cierra el pool antes de salir, con un máximo de 10 segundos.

## Endpoints añadidos en la Fase 5

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `PUT` | `/api/profile/password` | Autenticado | Cambia la contraseña verificando la actual. |
| `PATCH` | `/api/applications/:id/withdraw` | Candidato dueño | Retira una postulación pendiente. |
| `GET` | `/api/convocatorias/:id/offers` | Público | Ofertas publicadas de una convocatoria. |
| `PUT` / `DELETE` | `/api/convocatorias/:id/offers/:offerId` | Administrador o funcionario | Asocia o quita una oferta. |
| `GET` | `/api/admin/users?q=` | Administrador | Lista usuarios con roles, perfiles y `solicitud_contrasena` (última solicitud de recuperación sin atender, últimos 7 días). |
| `PUT` | `/api/admin/users/:userId/roles` | Administrador | Reemplaza los roles (siempre conserva `USUARIO`; no deja el sistema sin administradores). |
| `PATCH` | `/api/admin/users/:userId/active` | Administrador | Activa o desactiva una cuenta. |
| `PUT` | `/api/admin/users/:userId/password` | Administrador | Asigna una contraseña nueva a otra cuenta (8+ caracteres, mayúscula y número). Cierra sus sesiones, invalida sus enlaces de recuperación y le avisa por correo. No aplica a la cuenta propia (`409`). |
| `POST` | `/api/init-db` | Administrador | Reaplica las migraciones pendientes (antes era `GET` público). |

## Endpoints añadidos en la Fase 6

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/auth/forgot-password` | Público | Envía el enlace de recuperación (respuesta genérica). |
| `POST` | `/api/auth/reset-password` | Público | Cambia la contraseña con el token del enlace. |
| `GET` | `/api/profile/details` | Candidato | Educación, experiencia y habilidades. |
| `PUT` | `/api/profile/education`, `/experience`, `/skills` | Candidato | Reemplaza la lista completa. |
| `GET` / `PUT` / `DELETE` | `/api/profile/files/:tipo` (`cv`, `foto`) | Autenticado | Archivo del perfil; `PUT` recibe el binario y la cabecera `X-File-Name`. |
| `GET` | `/api/applications/:id/cv` | Organización dueña | Hoja de vida del postulante (desde la Fase 8, la copia enviada con la postulación; también la ve el candidato). |

El detalle está en [`docs/informe-fase-6-perfil-archivos.md`](../docs/informe-fase-6-perfil-archivos.md).

## Endpoints añadidos en la Fase 7

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/verifications/me` | Organización | Estado de la verificación, documentos, requisitos faltantes y catálogo de tipos y límites. |
| `POST` | `/api/verifications/me/documents?tipo=` | Organización | Sube un documento (`RUT`, `CAMARA_COMERCIO`, `CEDULA_REPRESENTANTE` u `OTRO`). Acepta PDF, PNG o JPG de hasta 5 MB y como máximo 10 documentos. El cuerpo es binario y el nombre va en `X-File-Name`. |
| `GET` / `DELETE` | `/api/verifications/me/documents/:documentId` | Organización dueña | Abre o elimina un documento. Durante la revisión y tras la aprobación la eliminación responde `409`. |
| `POST` / `DELETE` | `/api/verifications/me/request` | Organización | Envía la solicitud (exige el NIT, el RUT y la Cámara de Comercio) o la retira mientras está pendiente. |
| `GET` | `/api/verifications/requests?estado=&page=&limit=` | Administrador o funcionario | Bandeja paginada de solicitudes (`PENDIENTE` por defecto, `APROBADA`, `RECHAZADA` o `TODAS`). |
| `GET` | `/api/verifications/requests/summary` | Administrador o funcionario | Número de solicitudes pendientes. |
| `PATCH` | `/api/verifications/requests/:requestId` | Administrador o funcionario | Aprueba o rechaza una solicitud; rechazar exige un motivo de al menos 10 caracteres. |
| `GET` | `/api/verifications/documents/:documentId` | Administrador o funcionario | Abre un documento de cualquier organización. |

El detalle está en [`docs/informe-fase-7-verificacion-documental.md`](../docs/informe-fase-7-verificacion-documental.md).

## Endpoints añadidos o ampliados en la Fase 8

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` / `PATCH` | `/api/offers`, `/api/offers/:id` | Organización | Campos `programas`, `semestreMinimo`, `habilidades`, `experiencia`, `idiomas`, `jornada`, `beneficios` y `vacantes`. Al publicar se exige una oferta completa; el `400` incluye `errors` por campo. |
| `POST` | `/api/applications/offers/:offerId` | Candidato | Guarda una copia de la hoja de vida y del CV del perfil (`cvPerfil: false` para no copiarlo). `cartaPresentacion` admite hasta 1500 caracteres. |
| `PUT` | `/api/applications/:id/cv` | Candidato dueño | Sube un PDF solo para esa postulación mientras siga `ENVIADA` (cuerpo binario y `X-File-Name`). |
| `PATCH` | `/api/applications/:id/status` | Organización dueña | Cambia la etapa según las reglas del proceso; acepta `mensaje` y, para `PRESELECCIONADA`, `entrevista` (`fecha`, `modalidad`, `lugar`, `duracionMinutos`). Un cambio no permitido responde `409`. |
| `POST` | `/api/applications/:id/notes` | Organización dueña | Nota interna; el candidato no la ve. |
| `PATCH` | `/api/applications/:id/rating` | Organización dueña | Calificación interna de 1 a 5 (o `null`). |
| `PATCH` | `/api/applications/:id/withdraw` | Candidato dueño | Acepta un `motivo` opcional que queda en el historial. |

Las postulaciones (`GET /api/applications/me` y `GET /api/applications/offers/:offerId`) incluyen ahora `entrevista`, el CV enviado y `eventos`; la empresa además recibe las notas, sus autores y la `calificacion`. El detalle está en [`docs/informe-fase-8-ofertas-seleccion.md`](../docs/informe-fase-8-ofertas-seleccion.md).

## Estructura relevante

El backend es un **monolito modular**: el código se agrupa por funcionalidad en
`src/modules/`, y lo que comparten todos los módulos vive en `src/core/`.

```text
src/
├── core/
│   ├── config/       # Variables de entorno (env.js)
│   ├── database/     # Pool de PostgreSQL, withTransaction y migraciones
│   ├── http/         # HttpError, asyncHandler, lectura del cuerpo, paginación, validación y envío de archivos
│   ├── mail/         # Envío de correos (Resend)
│   ├── middleware/   # Autenticación, roles, límite de peticiones y cabeceras de seguridad
│   └── security/     # Regla de contraseñas (registro, recuperación, perfil y administración)
├── modules/
│   ├── auth/  profile/  offers/  applications/
│   ├── convocatorias/  verifications/  admin/  stats/  health/
│   └── <modulo>/
│       ├── <modulo>.routes.js      # URLs y middlewares
│       ├── <modulo>.controller.js  # HTTP: lee la petición y arma la respuesta
│       ├── <modulo>.service.js     # Reglas de negocio; lanza HttpError
│       └── <modulo>.repository.js  # Único lugar con SQL
├── scripts/          # grant-role.js
├── app.js            # Configuración de Express (importable por las pruebas)
└── server.js         # Arranque del servidor y migraciones

tests/            # Pruebas de la API (npm test)

database/
├── schema.sql    # Esquema PostgreSQL inicial
└── migrations/   # Migraciones idempotentes, aplicadas en orden y registradas en schema_migrations
```

### Reglas de las capas

- **Las dependencias van en una sola dirección:** routes → controller → service → repository.
- **El controlador no tiene lógica.** Envuelve su función en `asyncHandler(fn, mensajeDe500)`:
  - si el servicio lanza un `HttpError`, responde con su estado y mensaje;
  - cualquier otro error responde 500 con el mensaje indicado.
- **El servicio no conoce Express ni SQL.** Valida, aplica las reglas y lanza `badRequest`, `forbidden`, `notFound` o `conflict`.
- **Solo el repositorio escribe SQL.** Las funciones que deben ir en una transacción reciben `db`; el servicio las agrupa con `withTransaction(async (db) => …)`.
- **Las funciones puras van en archivos propios,** por ejemplo `offers.scoring.js`, `offers.validation.js` y `verifications.rules.js`, y se prueban sin base de datos. Las constantes de cada dominio (tipos, estados) viven en `<modulo>.domain.js`; el frontend comprueba que las suyas coincidan (`frontend/src/test/contracts.test.ts`).
- **Un módulo puede tener varios controladores y servicios si atiende a actores distintos.** Por ejemplo, en `profile/` están `profile.*` y `profileDetails.*`, y en `verifications/` están `organizationVerification.*` (la empresa) y `verifications.*` (la revisión). Comparten un único repositorio por tabla.
- **Para agregar una funcionalidad:**
  1. crea `src/modules/<nombre>/` con los cuatro archivos;
  2. monta el router en `app.js`.
- **Para cambiar de base de datos o pasar a un ORM,** solo se tocan los `*.repository.js`.
