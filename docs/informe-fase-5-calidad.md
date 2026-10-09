# Informe de la Fase 5: calidad, pruebas y corrección del inicio de sesión

Rama: `feature/fase-5-calidad`. Fecha: 9 de octubre de 2026.

## Objetivo

Auditar el sistema completo tras cerrar el backlog (#1 a #21), corregir el fallo del despliegue en Vercel al iniciar sesión, dar función a los botones que no la tenían, corregir los errores encontrados y dejar pruebas automatizadas que eviten regresiones.

## 1. Fallo en Vercel: la aplicación no cargaba tras iniciar sesión

### Diagnóstico

- La API de Render (`https://proyecto-ingsoftware.onrender.com/api`) respondía bien en `/health`, `/db-check`, `/auth/login` y CORS. El fallo estaba en el frontend.
- En producción, la oferta con id `1` tenía la modalidad guardada con una codificación incorrecta: `"H�brida"` y `"Bogot�"`. Se había creado desde una terminal que no enviaba UTF-8.
- `ExternalDashboard` buscaba el estilo con `modalityStyle[job.modality]`. Con una modalidad desconocida el resultado era `undefined`, y `mod.bg` lanzaba `TypeError: Cannot read properties of undefined (reading 'bg')`. React desmontaba toda la aplicación y la pantalla quedaba en blanco justo después del login.
- La prueba `screens.test.tsx` reproduce el fallo con el componente anterior y confirma que la versión corregida muestra la oferta.

### Otros factores que empeoraban el inicio de sesión

| Problema | Efecto |
| --- | --- |
| El botón "Iniciar sesión" no mostraba estado de carga y las peticiones no tenían tiempo límite. | Render, en el plan gratuito, tarda cerca de un minuto en despertar y la pantalla parecía congelada. |
| `/api/auth/login` devolvía `profileTypes: []`. PostgreSQL entrega los arrays de enum como texto y no se convertían. | Empresas y candidatos entraban primero al panel de estudiante. |
| Login y registro no traen los datos del perfil y ya no se consultaba `/profile/me`. | Formularios de perfil vacíos hasta recargar. |
| Sin `VITE_API_URL`, el build de producción apuntaba a `http://localhost:3000/api`. | La app publicada no podía contactar la API. |
| La sesión guardada mostraba el formulario de login mientras se validaba el token. | Parpadeo y confusión al recargar. |

### Corrección

- Se normalizan las modalidades en el frontend (`normalizeModality`) y en la API, con un estilo por defecto en las tarjetas.
- La migración `20261009_normalize_offer_modality.sql` repara los datos existentes. Se aplica sola al desplegar.
- La API rechaza con `400` el texto con caracteres de reemplazo (U+FFFD), para que no vuelvan a entrar datos dañados.
- `ErrorBoundary` en `App.tsx`: si una pantalla falla, se muestra un aviso con "Volver al inicio" en vez de una página en blanco.
- Login con estado "Iniciando sesión...", aviso tras 5 s ("El servidor se está activando..."), ping a `/health` al abrir la pantalla y tiempo límite de 70 s con mensajes claros.
- Pantalla "Cargando tu sesión..." al restaurar un token y cierre automático de la sesión ante un `401`.
- Sin `VITE_API_URL`, el build de producción usa la URL de Render.

## 2. Botones sin funcionalidad y pantallas incompletas

| Antes | Ahora |
| --- | --- |
| Notificaciones fijas ("Bancolombia revisó tu perfil"). | Se generan a partir del estado real de las postulaciones del candidato. |
| "Guardar oferta" se perdía al recargar y no tenía uso. | Se guarda por usuario y existe el filtro "Solo guardadas". |
| "Ver oferta" / "Ver vacante" en postulaciones solo volvía al catálogo. | Abren el detalle real de la oferta. |
| No era posible retirar una postulación. | Botón "Retirar postulación" (`PATCH /api/applications/:id/withdraw`). |
| "Postulantes" desde el menú mostraba una página vacía. | Muestra un selector con las ofertas de la empresa. |
| La empresa no podía editar sus datos (el endpoint existía sin pantalla). | Nueva pantalla "Mi empresa", con el estado de verificación. |
| No existía cambio de contraseña. | Tarjeta "Cambiar contraseña" en todos los perfiles (`PUT /api/profile/password`). |
| "¿Olvidaste tu contraseña?" simulaba el envío de un correo. | Explica cómo recuperar el acceso; SIPU no envía correos. |
| La hoja de vida del candidato externo no llegaba a las empresas. | Campo "Enlace a tu hoja de vida", visible para la empresa. |
| Las empresas veían Verificación, Convocatorias y Estadísticas, que respondían `403`. | Menú propio para administradores y funcionarios. |
| No había forma de crear administradores. | Script `npm run grant-role` y pantalla "Usuarios". |
| Convocatorias sin manera de asociar ofertas. | Asociar y quitar ofertas, con confirmación al eliminar. |
| El modal de éxito decía siempre "Bancolombia recibió tu perfil". | Muestra la empresa de la oferta. |

## 3. Errores corregidos en la API

### Seguridad

- **Roles leídos de la base de datos en cada petición.** Antes se confiaba en los roles del token: retirar un rol o desactivar una cuenta no surtía efecto hasta 7 días después.
- **`JWT_SECRET` obligatorio en producción.** Con el valor por defecto, cualquiera podía firmar un token de administrador; ahora el servicio no arranca.
- **Verificación de organizaciones** reservada a `ADMINISTRADOR` y `FUNCIONARIO_PUBLICO`. Antes, cualquier empresa verificada podía aprobar o rechazar a otras.
- **`GET /api/init-db`** era público. Ahora es `POST` y exige administrador.
- **Límite de intentos en el login:** 10 por IP y correo cada 15 minutos.
- **CORS configurable** con `CORS_ORIGIN`.

### Datos y validaciones

- Las ofertas validan modalidad, rango salarial (máximo ≥ mínimo), correo de contacto y fechas. Los campos opcionales pueden vaciarse y la fecha de publicación se fija sola al publicar.
- Los perfiles de organización y de candidato externo permiten vaciar campos (antes `COALESCE` lo impedía). Una identificación fiscal duplicada devuelve `409`.
- Dos postulaciones simultáneas a la misma oferta devolvían `500`; ahora devuelven `409`.
- Las convocatorias permiten vaciar fechas. Las columnas `DATE` ya no se desplazan por la zona horaria del servidor.
- Las estadísticas devuelven números. La tabla "Organizaciones con más ofertas" mostraba `undefined ofertas`.
- Un identificador no numérico en la URL devolvía `500`; ahora devuelve `400`. El JSON mal formado devuelve `400`.
- Un candidato externo que se postulaba a una práctica, o un estudiante a un empleo, no veía esa postulación en "Mis postulaciones".

### Migraciones

`initializeDatabaseSchema` registra en `schema_migrations` las migraciones aplicadas y ejecuta en orden las pendientes de `backend/database/migrations/`. Antes, una base creada antes de la Fase 3 quedaba sin la tabla `verificaciones`.

## 4. Pruebas automatizadas

| Proyecto | Herramienta | Pruebas | Comando |
| --- | --- | --- | --- |
| Backend | `node:test` + `supertest` sobre PostgreSQL real | 80 | `cd backend && npm test` |
| Frontend | Vitest + Testing Library (jsdom) | 21 | `cd frontend && npm test` |

- Las pruebas del backend usan una base aislada `<base>_test`, derivada de `DATABASE_URL` o tomada de `TEST_DATABASE_URL`. La base se borra y se recrea en cada ejecución, y el script se niega a usar una base cuyo nombre no termine en `_test`.
- Cobertura del backend: registro, login, límite de intentos, tokens falsificados, roles revocados, cuentas desactivadas, perfiles, cambio de contraseña, ofertas, recomendaciones, postulaciones (incluida la concurrencia), verificaciones, convocatorias, estadísticas, administración de usuarios, migraciones y utilidades.
- Cobertura del frontend: cliente HTTP (errores, red caída, tiempo límite, sesión expirada, URL de producción), utilidades de fechas y modalidades, roles y pantallas (catálogo con datos dañados, login con carga y error, sesión vencida, panel de administrador).
- Además se ejecutó una prueba de extremo a extremo con Microsoft Edge (Playwright) contra la API local. Pasaron 20 de 20 flujos: registro de los tres tipos de cuenta, publicación de oferta, guardar y filtrar ofertas, postular, abrir el detalle desde postulaciones, retirar, aceptar candidatos, notificación al estudiante, administrador creado con `grant-role`, verificación de empresa, convocatoria con oferta asociada, desactivar y reactivar una cuenta, login erróneo, persistencia y cierre de sesión, y cambio de contraseña.

## 5. Pasos para publicar

1. En Render, confirmar que `JWT_SECRET` tiene un valor privado; sin él la API no arranca. Si se cambia el valor, todas las sesiones abiertas se cierran.
2. Opcional: definir `CORS_ORIGIN` con la URL de Vercel.
3. Fusionar la rama y desplegar. Al arrancar, la API aplica `20261009_normalize_offer_modality.sql`, que repara la oferta dañada.
4. En Vercel, verificar `VITE_API_URL` y volver a desplegar.
5. Crear el primer administrador con la `External Database URL` de Render:

   ```powershell
   cd backend
   $env:DATABASE_URL = "<External Database URL>"
   npm run grant-role -- correo@unibague.edu.co ADMINISTRADOR
   ```

   La cuenta debe existir; basta registrarla antes desde la aplicación. Después el administrador asigna roles desde la pantalla "Usuarios".

## 6. Pendientes conocidos

- La subida real de archivos (CV y foto) sigue pendiente; el candidato externo comparte un enlace.
- Educación, experiencia y habilidades del perfil se guardan solo en el navegador.
- La recuperación de contraseña por correo requiere un servicio de envío de correos.
- El límite de intentos vive en memoria; con varias instancias de la API haría falta un almacenamiento compartido.
- Los despliegues de vista previa en Vercel tienen activa la protección de despliegue (SSO), así que solo los abre quien tenga sesión en Vercel.
