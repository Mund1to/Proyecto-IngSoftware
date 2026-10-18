# Informe de la Fase 7: verificación documental de organizaciones

Rama: `feature/verificacion-documental`, creada sobre `refactor/arquitectura-modular`. Fecha: 17 de octubre de 2026.

## Objetivo

Antes de esta fase, un administrador aprobaba o rechazaba una empresa solo con su NIT y su sitio web, y la empresa no podía aportar pruebas ni saber por qué la rechazaban. Esta fase añade cuatro cosas:

1. La empresa sube sus documentos de soporte desde **Mi empresa** y envía una solicitud de verificación.
2. El administrador o el funcionario revisa las solicitudes en una bandeja (**Solicitudes**), abre los documentos y aprueba o rechaza con un motivo.
3. Las dos partes reciben un aviso por correo, y la empresa ve el resultado en su pantalla.
4. Además, mejoras de seguridad, operación e integración continua (sección 6).

## 1. Flujo

```text
Empresa                                        Revisor (ADMINISTRADOR o FUNCIONARIO_PUBLICO)
───────                                        ─────────────────────────────────────────────
Registra el NIT en "Mi empresa"
Adjunta el RUT y el certificado de Cámara de Comercio
(opcional: documento del representante legal u otros)
Envía la solicitud ───────── correo ─────────▶  Ve la solicitud en "Solicitudes" (con el número en el menú)
  · los documentos quedan bloqueados             Abre cada documento
  · puede retirarla mientras siga pendiente      Aprueba, o rechaza con un motivo (mínimo 10 caracteres)
Recibe la decisión ◀──────── correo ──────────
  · aprobada: sello de verificada, documentos bloqueados
  · rechazada: ve el motivo, corrige y envía de nuevo
```

## 2. Modelo de datos

La migración `20261017_verification_requests_documents.sql` es aditiva e idempotente:

| Cambio | Detalle |
| --- | --- |
| Tabla `documentos_verificacion` | `organizacion_id`, `tipo` (`RUT`, `CAMARA_COMERCIO`, `CEDULA_REPRESENTANTE`, `OTRO`), `nombre`, `mime`, `tamano` y `contenido` (`BYTEA`). Se guarda en la base por la misma razón que los archivos del perfil: el disco de Render se borra en cada despliegue. |
| `verificaciones.solicitado_por` | Usuario que envió la solicitud. Es `NULL` en las decisiones directas de un revisor, que existían antes de esta fase. |
| `verificaciones.mensaje` | Nota de la empresa para el revisor. |
| `verificaciones.documentos` | Copia en `JSONB` de los metadatos (sin contenido) de los documentos enviados. Conserva el historial aunque la empresa cambie los documentos después de un rechazo. |
| `verificaciones.revisado_at` | Fecha de la decisión. |
| Índice único parcial | Una sola solicitud de empresa pendiente por organización (`estado = 'PENDIENTE' AND solicitado_por IS NOT NULL`). |
| Índice `(estado, created_at DESC)` | Sirve a la bandeja del revisor. |

Se reutiliza la tabla `verificaciones`, porque su diseño original ya tenía un estado `PENDIENTE` por defecto y un revisor opcional. Las decisiones anteriores siguen siendo válidas.

## 3. API

### Empresa (`authenticate`; el servicio exige un perfil `ORGANIZACION`, si no responde `403`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/verifications/me` | Devuelve el estado (`SIN_SOLICITUD`, `PENDIENTE`, `APROBADA` o `RECHAZADA`), la solicitud vigente, los documentos y `faltantes` (`NIT`, `RUT`, `CAMARA_COMERCIO`). También devuelve `bloqueada`, `puedeEnviar` y `requisitos`, el catálogo de tipos, formatos y límites. |
| `POST` | `/api/verifications/me/documents?tipo=RUT` | Sube un documento. El cuerpo es binario y el nombre va en `X-File-Name`. Respuestas: `201`, `400` (tipo inválido o archivo vacío), `409` (bloqueado o más de 10 documentos), `413` (más de 5 MB) y `415` (formato o firma inválidos). |
| `GET` / `DELETE` | `/api/verifications/me/documents/:documentId` | Abre o elimina un documento propio. El de otra empresa responde `404`. |
| `POST` | `/api/verifications/me/request` | Envía la solicitud con un `mensaje` opcional de hasta 1000 caracteres. Exige el NIT, el RUT y la Cámara de Comercio (`400`). Una segunda solicitud pendiente o una empresa ya verificada responden `409`. |
| `DELETE` | `/api/verifications/me/request` | Retira la solicitud pendiente (`404` si no hay ninguna). |

### Revisión (`ADMINISTRADOR` o `FUNCIONARIO_PUBLICO`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/verifications/requests?estado=&page=&limit=` | Bandeja paginada. `estado` admite `PENDIENTE` (por defecto), `APROBADA`, `RECHAZADA` o `TODAS`. `limit` admite como máximo 50. Las pendientes salen primero y en orden de llegada; las revisadas, de la más reciente a la más antigua. Devuelve `{ requests, total, page, limit }`. |
| `GET` | `/api/verifications/requests/summary` | Devuelve `{ pendientes }` para el número del menú. |
| `PATCH` | `/api/verifications/requests/:requestId` | Recibe `{ estado: APROBADA \| RECHAZADA, observaciones }`. Rechazar sin un motivo de al menos 10 caracteres responde `400`, y una solicitud ya revisada responde `409`. |
| `GET` | `/api/verifications/documents/:documentId` | Abre cualquier documento, con `Cache-Control: private, no-store` y `nosniff`. |
| `PATCH` | `/api/verifications/organizations/:organizationId` | Es la decisión directa que ya existía. Ahora resuelve la solicitud pendiente si la hay, en lugar de crear otra fila, y avisa a la empresa por correo. |

## 4. Reglas y decisiones técnicas

- **Formatos:** PDF, PNG o JPG de hasta 5 MB, y como máximo 10 documentos por empresa. El tipo se comprueba por la firma binaria del archivo, no solo por la cabecera, igual que en los archivos del perfil.
- **Bloqueo de documentos:** los documentos quedan bloqueados durante la revisión y después de la aprobación, porque son la evidencia de la decisión. Si un revisor retira la verificación, la empresa puede volver a editarlos.
- **Concurrencia:** toda transacción bloquea primero la fila de `organizaciones` y después la de `verificaciones`. El orden fijo evita interbloqueos, por ejemplo cuando la empresa retira su solicitud mientras el revisor la decide. El índice único es la última barrera ante dos envíos simultáneos.
- **Retiro:** retirar una solicitud elimina su fila, porque todavía no hay una decisión que conservar.
- **Correos:** se envían después de confirmar la transacción. Un fallo del proveedor se registra y no cambia la respuesta.
- **Capas:** las reglas puras (`verifications.rules.js`) se prueban sin base de datos. El lado de la empresa (`organizationVerification.*`) y el lado de la revisión (`verifications.*`) comparten un único repositorio, que es el único lugar con SQL.

## 5. Frontend

- **Mi empresa** incluye la sección `OrganizationVerificationPanel`. Muestra el estado, la lista de requisitos, los documentos (con las opciones ver y eliminar), un selector de tipo y la subida con validación previa. También tiene el mensaje para el revisor y los botones "Enviar solicitud" y "Retirar solicitud". Tras un rechazo muestra el motivo y el botón "Enviar de nuevo".
- **Solicitudes** (antes "Verificación") tiene tres pestañas:
  - Pendientes: tarjetas con los datos de la empresa, el contacto, el mensaje y los documentos.
  - Historial: filtrable por estado, con "Cargar más".
  - Organizaciones: la vista general, con aprobación directa y la opción de retirar una verificación.
- La decisión se toma en `VerificationDecisionModal`, que reemplaza el `window.prompt` anterior.
- El menú del revisor muestra el número de solicitudes pendientes (`SessionContext.pendingVerifications`).
- `lib/verification.ts` reúne las etiquetas, los estados y la validación previa, a partir del catálogo que envía el servidor. `lib/files.ts` comparte `formatSize`.

## 6. Mejoras transversales

| Mejora | Detalle |
| --- | --- |
| Validación de archivos compartida | `core/http/files.js` reúne las firmas binarias, `normalizeMime`, `hasValidSignature`, `cleanFileName` y `rawFileBody`. La usan el perfil y la verificación. `escapeHtml` pasa a `core/mail/mailer.js`. |
| Paginación | `core/http/pagination.js` (`parsePagination`) acota `limit` y `page` y puede reutilizarse en otros listados. |
| Cabeceras de seguridad | Sin dependencias nuevas: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'` y HSTS en producción. Además se oculta `X-Powered-By`. |
| Cierre ordenado | `server.js` atiende `SIGTERM`, que Render envía en cada despliegue, y `SIGINT`. Termina las peticiones en curso, cierra el pool y fuerza la salida a los 10 segundos. |
| Integración continua | `.github/workflows/ci.yml` ejecuta las pruebas del backend contra PostgreSQL 16, y el typecheck, las pruebas y el build del frontend, en cada push y pull request. |

## 7. Verificación

| Prueba | Resultado |
| --- | --- |
| Backend (`npm test`) | 123 de 123. Hay 21 nuevas: 13 de integración de la verificación, 7 unitarias y 1 de cabeceras. |
| Frontend (`npm test`) | 53 de 53. Hay 8 nuevas: 4 de pantallas, 3 de utilidades y 1 del menú. |
| `npm run typecheck` y `npm run build` | Sin errores. |
| Servidor real sobre una base desechable | Se aplicaron las 7 migraciones al arrancar. Por HTTP se completó el flujo: subir el RUT y la Cámara de Comercio, enviar, ver el resumen, listar, descargar el PDF y aprobar. El servidor salió con código 0 tras `SIGTERM`. |

## 8. Pasos para publicar

1. Fusionar `refactor/arquitectura-modular` y esta rama en `develop`, y después en `main`.
2. Desplegar. La API aplica sola la migración nueva al arrancar y no hace falta configurar variables nuevas.
3. En GitHub, activar la protección de `main` y `develop` para exigir que pase el flujo **CI**.

## 9. Sugerencias y pendientes

Ordenadas por impacto:

1. **Almacenamiento de objetos para archivos.** Ejemplos: Cloudflare R2, S3 o Supabase Storage. Hoy cada empresa puede guardar hasta 50 MB en `BYTEA`, y 1000 empresas suman unos 50 GB dentro de PostgreSQL, lo que encarece las copias de seguridad y el plan de la base. La base debería guardar solo la clave del objeto y servir el archivo con URL firmadas de corta duración.
2. **Análisis antivirus de los documentos**, por ejemplo con ClamAV o el análisis del proveedor de almacenamiento, antes de que un revisor los abra. Comprobar la firma no detecta un PDF con contenido malicioso.
3. **Validación del NIT.** El dígito de verificación de la DIAN se puede calcular sin servicios externos. Además, se puede consultar el RUES para comprobar la razón social y el estado de la matrícula mercantil.
4. **Vigencia de la verificación.** Añadir `vigente_hasta` y pedir una nueva verificación cada año, porque los certificados de Cámara de Comercio caducan.
5. **Privacidad (Ley 1581 de 2012).** Borrar los documentos de las solicitudes rechazadas o retiradas después de un plazo definido. Registrar además quién abrió cada documento, en una tabla de auditoría.
6. **Límite de peticiones compartido** (Redis o similar), para varias instancias del backend. Aplicarlo también a las subidas.
7. **Frontend:**
   - `react-router`, para tener URL propias (por ejemplo `/admin/solicitudes`), un botón Atrás que funcione y enlaces directos desde el correo;
   - TanStack Query, para la caché y la recarga de datos;
   - tipar las props de `renderScreen`, que hoy son `any`.
8. **Calidad:**
   - ESLint y Prettier en CI;
   - Dependabot;
   - documentación OpenAPI generada a partir de las rutas;
   - registro estructurado (pino) con un identificador por petición, y seguimiento de errores (Sentry).
9. **Paginación** en `/api/admin/users` y `/api/verifications/organizations`, que hoy devuelven todas las filas, con `parsePagination`.
10. **Notificaciones dentro de la aplicación** para la empresa (la campana hoy solo avisa a los candidatos), con una tabla `notificaciones`.
