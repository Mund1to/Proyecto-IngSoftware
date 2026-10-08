# Informe de cierre: Fase 4 — Agencia pública de empleo

**Fecha:** 8 de octubre de 2026
**Rama:** `feature/fase-4-agencia-publica`

## Objetivo

Cerrar el backlog incorporando las funciones institucionales: administración de
convocatorias públicas y estadísticas agregadas de empleo.

## Historias cubiertas

| Historia | Descripción | Estado |
| --- | --- | --- |
| #18 HU-14 | Administrar convocatorias públicas | Completada |
| #21 HU-17 | Generar estadísticas de empleo | Completada |

### #18 HU-14 — Convocatorias públicas

Se añadió el módulo de convocatorias:

- `backend/src/controllers/convocatorias.controller.js`
- `backend/src/routes/convocatorias.routes.js`

La tabla `convocatorias` ya existía en el esquema inicial y `ofertas.convocatoria_id`
permite agrupar ofertas bajo una convocatoria.

Endpoints:

| Método | Ruta | Protección | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/convocatorias` | Pública | Lista convocatorias con el número de ofertas asociadas. |
| `GET` | `/api/convocatorias/:id` | Pública | Detalla una convocatoria. |
| `POST` | `/api/convocatorias` | Administrador o funcionario | Crea una convocatoria. |
| `PATCH` | `/api/convocatorias/:id` | Administrador o funcionario | Actualiza una convocatoria. |
| `DELETE` | `/api/convocatorias/:id` | Administrador o funcionario | Elimina una convocatoria. |
| `PATCH` | `/api/convocatorias/:id/offers/:offerId` | Administrador o funcionario | Asocia o desasocia una oferta de la convocatoria. |

Reglas:

- La lectura es pública; la escritura requiere rol `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO`.
- Se validan las fechas y que la fecha de fin no sea anterior a la de inicio.
- Eliminar una convocatoria no borra las ofertas: su `convocatoria_id` pasa a `NULL`
  por la regla `ON DELETE SET NULL` del esquema.
- El frontend incorpora la pantalla `Convocatorias` con alta, edición y borrado.

### #21 HU-17 — Estadísticas de empleo

- `backend/src/controllers/stats.controller.js`
- `backend/src/routes/stats.routes.js`

Endpoint:

| Método | Ruta | Protección | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/stats/employment` | Administrador o funcionario | Devuelve indicadores agregados. |

Los indicadores incluyen totales (ofertas, ofertas publicadas, postulaciones,
postulaciones aceptadas, organizaciones, organizaciones verificadas, estudiantes y
candidatos externos), ofertas por tipo, por área y por ciudad, organizaciones con más
ofertas y postulaciones por mes (últimos 6 meses).

Se respeta la regla de diseño del backlog: **solo datos agregados, sin información
personal**. El frontend incorpora la pantalla `EmploymentStats`.

## Verificaciones realizadas

- `npx tsc --noEmit`: sin errores.
- `npm run build` en `frontend`: correcto.
- `node --check` en controladores, rutas y `server.js`: correcto.
- Import dinámico de los módulos nuevos: correcto.

## Alcance y pendientes

- Las convocatorias se gestionan desde la misma interfaz de empresa para cuentas con
  rol `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO`; no se creó una aplicación de
  administración separada.
- Las estadísticas se calculan en vivo sobre las tablas operativas. Para volúmenes
  grandes convendría materializarlas o cachearlas.
- Con esta fase el backlog queda completo (#1 a #21). Persisten como deuda técnica no
  listada en el backlog: subida real de archivos (CV/foto), tests automatizados y
  persistencia en base de datos de educación, experiencia y habilidades del perfil.
