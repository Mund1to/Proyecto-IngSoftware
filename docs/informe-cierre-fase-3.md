# Informe de cierre: Fase 3 — Bolsa de empleo general

**Fecha:** 8 de octubre de 2026
**Rama:** `feature/fase-3-bolsa-empleo`

## Objetivo

Completar la Fase 3 del backlog: publicar ofertas de empleo general, gestionar los
tipos de oferta, verificar empresas y empleadores, y recomendar ofertas según el
perfil del candidato.

## Historias cubiertas

| Historia | Descripción | Estado |
| --- | --- | --- |
| #14 HU-10 | Publicar ofertas de empleo general | Completada |
| #16 HU-12 | Gestionar tipos de oferta | Completada |
| #17 HU-13 | Verificar empresas y empleadores | Completada |
| #20 HU-16 | Recomendar ofertas según perfil | Completada |

### #14 y #16 — Ofertas generales y tipos de oferta

Las organizaciones publican ofertas de tipo `PRACTICA`, `EMPLEO` o `EMPLEO_PUBLICO`
mediante `POST /api/offers`. Los tipos válidos y los estados de oferta están
centralizados en `offers.controller.js` (`OFFER_TYPES`, `OFFER_STATUSES`). El catálogo
público (`GET /api/offers`) devuelve solo las ofertas `PUBLICADA`.

### #17 — Verificación de empresas y empleadores

Se añadió el módulo de verificaciones:

- `backend/src/controllers/verifications.controller.js`
- `backend/src/routes/verifications.routes.js`
- Migración aditiva `backend/database/migrations/20261008_organization_verification.sql`

Endpoints:

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/verifications/organizations` | Lista organizaciones con su estado de verificación más reciente. |
| `PATCH` | `/api/verifications/organizations/:organizationId` | Registra la decisión: `PENDIENTE`, `APROBADA` o `RECHAZADA`. |

Reglas:

- Aprobar (`APROBADA`) activa `organizaciones.verificada`; rechazar la desactiva.
- Cada decisión se registra como una fila nueva en `verificaciones` (historial).
- Pueden revisar los usuarios con rol `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO`, así como
  cuentas cuya organización ya esté verificada. Una organización sin verificar no puede
  aprobarse a sí misma.
- El panel del frontend (`CompanyVerification`) muestra el estado y permite aprobar o
  rechazar. La insignia "Verificada" del catálogo depende de `verificada: true`.

### #20 — Recomendación de ofertas según perfil

`GET /api/offers/recommended` (autenticado) devuelve las ofertas publicadas ordenadas
por afinidad con el perfil del candidato. La puntuación combina:

- coincidencia de área con el programa académico o el resumen del candidato;
- misma ciudad de residencia;
- requisitos que el candidato menciona en su resumen/habilidades;
- tipo de oferta: un estudiante puntúa más alto en `PRACTICA`, un candidato externo en
  `EMPLEO` y `EMPLEO_PUBLICO`;
- un pequeño empujón a las organizaciones verificadas.

No se excluye ninguna oferta: solo se reordenan, para que el candidato siga viendo todo
el catálogo. Si el usuario no tiene perfil de candidato o estudiante, el endpoint
devuelve `403`. El dashboard de estudiante usa este orden cuando hay sesión y cae al
catálogo público si la recomendación falla.

## Actualización de una base existente

La migración es aditiva y no reinicializa ni elimina datos:

```powershell
psql -U postgres -d sipu -f backend/database/migrations/20261008_organization_verification.sql
```

Si se crea una base nueva, ejecutar `backend/database/schema.sql` como indica el README.

## Verificaciones realizadas

- `npm run build` en `frontend`: correcto (51 módulos).
- `npx tsc --noEmit`: sin errores.
- `node --check` en controladores, rutas y `server.js`: correcto.
- Arranque de la API contra PostgreSQL local: conexión correcta y esquema inicializado.

## Alcance y pendientes

- La verificación se resuelve con roles (`ADMINISTRADOR`, `FUNCIONARIO_PUBLICO`) o con
  cuentas de organizaciones ya verificadas; no se implementó un panel de administración
  separado con gestión de usuarios.
- La recomendación es determinista y basada en texto; no usa un modelo de afinidad ni
  aprendizaje a partir de postulaciones previas.
- Persisten pendientes fuera de esta fase: la gestión de archivos (CV/foto) requiere
  almacenamiento en backend, y las convocatorias y estadísticas pertenecen a la Fase 4.