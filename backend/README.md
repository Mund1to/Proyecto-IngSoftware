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
copy ..\\.env.example .env
```

En PowerShell también puede utilizar:

```powershell
Copy-Item ..\\.env.example .env
```

Variables disponibles:

| Variable | Descripción | Valor de ejemplo |
| --- | --- | --- |
| `PORT` | Puerto HTTP de la API | `3000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://usuario:contraseña@localhost:5432/sipu` |
| `JWT_SECRET` | Secreto para firmar tokens. **Obligatorio en producción**: con el valor por defecto la API no arranca. | valor aleatorio |
| `JWT_EXPIRES_IN` | Vigencia de los tokens | `7d` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas. Vacío permite cualquiera. | `https://sipu.vercel.app` |
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
| `npm test` | Ejecuta las 80 pruebas de la API (`node:test` + `supertest`) sobre una base `<base>_test` que se recrea en cada ejecución. |
| `npm run grant-role -- correo ROL` | Asigna `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO` a una cuenta existente. Sirve para crear el primer administrador. |

## Seguridad

- Los roles y el estado de la cuenta se consultan en la base en cada petición autenticada; retirar un rol o desactivar una cuenta aplica de inmediato.
- `/api/auth/login` admite 10 intentos por IP y correo cada 15 minutos.
- Un identificador no numérico en la URL responde `400`, igual que el JSON mal formado o el texto con codificación inválida.

## Endpoints añadidos en la Fase 5

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `PUT` | `/api/profile/password` | Autenticado | Cambia la contraseña verificando la actual. |
| `PATCH` | `/api/applications/:id/withdraw` | Candidato dueño | Retira una postulación pendiente. |
| `GET` | `/api/convocatorias/:id/offers` | Público | Ofertas publicadas de una convocatoria. |
| `PUT` / `DELETE` | `/api/convocatorias/:id/offers/:offerId` | Administrador o funcionario | Asocia o quita una oferta. |
| `GET` | `/api/admin/users?q=` | Administrador | Lista usuarios con roles y perfiles. |
| `PUT` | `/api/admin/users/:userId/roles` | Administrador | Reemplaza los roles (siempre conserva `USUARIO`; no deja el sistema sin administradores). |
| `PATCH` | `/api/admin/users/:userId/active` | Administrador | Activa o desactiva una cuenta. |
| `POST` | `/api/init-db` | Administrador | Reaplica las migraciones pendientes (antes era `GET` público). |

## Estructura relevante

```text
src/
├── controllers/  # Lógica de los endpoints
├── routes/       # Definición de rutas HTTP
├── middleware/   # Autenticación y roles
├── utils/        # Helpers compartidos (payload, perfiles, ofertas, parámetros)
├── scripts/      # grant-role.js
├── app.js        # Configuración de Express (importable por las pruebas)
└── server.js     # Arranque del servidor y migraciones

tests/            # Pruebas de la API (npm test)

database/
├── schema.sql    # Esquema PostgreSQL inicial
└── migrations/   # Migraciones idempotentes, aplicadas en orden y registradas en schema_migrations
```
