# Informe de la Fase 6: hoja de vida, archivos, recuperación de contraseña y formación

Rama: `feature/fase-6-perfil-archivos`. Fecha: 9 de octubre de 2026.

## Objetivo

Resolver los pendientes que quedaron abiertos en el informe de la Fase 5:

1. La hoja de vida (educación, experiencia y habilidades) solo se guardaba en el navegador.
2. No había subida real de archivos (CV y foto).
3. No existía recuperación de contraseña por correo.
4. Faltaba el tipo de oferta `FORMACION` previsto en el backlog.

Durante el trabajo apareció además un error de la HU-12: el formulario de la empresa no permitía elegir el tipo de oferta y toda oferta se publicaba como `PRACTICA`.

## 1. Hoja de vida en la base de datos

| Tabla | Contenido |
| --- | --- |
| `perfil_educacion` | Título, institución, periodo y orden. |
| `perfil_experiencia` | Cargo, empresa, periodo, descripción y orden. |
| `perfil_habilidades` | Categoría y nombre; no se repite un nombre dentro de la misma categoría, sin importar mayúsculas. |

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/profile/details` | Devuelve `{ education, experience, skills }` del perfil candidato. |
| `PUT` | `/api/profile/education` | Reemplaza la lista completa (`{ items: [...] }`, máximo 30). |
| `PUT` | `/api/profile/experience` | Igual, para la experiencia (máximo 30). |
| `PUT` | `/api/profile/skills` | Igual, para las habilidades (máximo 100). |

- Cada lista se reemplaza dentro de una transacción. El cliente envía la lista final, así que agregar, editar, eliminar y reordenar usan la misma operación.
- En el frontend, `ProfileSections` reemplaza los `window.prompt` por formularios en la página. Si encuentra datos de la versión anterior guardados en el navegador, ofrece **"Guardarlos en mi cuenta"** y después los borra del navegador.
- La empresa ve la educación, la experiencia y las habilidades de cada postulante.
- Las recomendaciones (HU-16) tienen en cuenta las habilidades guardadas.

## 2. Archivos del perfil

| Tipo | Formatos | Tamaño máximo | Perfiles |
| --- | --- | --- | --- |
| `cv` | PDF | 5 MB | Estudiante y candidato externo |
| `foto` | PNG, JPG, WEBP | 2 MB | Todos (en la empresa hace de logo) |

| Método | Ruta | Descripción |
| --- | --- | --- |
| `PUT` | `/api/profile/files/:tipo` | Sube o reemplaza el archivo. El cuerpo es binario y el nombre va en la cabecera `X-File-Name`. |
| `GET` | `/api/profile/files/:tipo` | Descarga el archivo propio. |
| `DELETE` | `/api/profile/files/:tipo` | Elimina el archivo. |
| `GET` | `/api/applications/:id/cv` | La organización dueña de la oferta descarga el CV del postulante. |

- Los archivos se guardan en la tabla `archivos` (`BYTEA`), porque el disco de Render en el plan gratuito se borra en cada despliegue.
- Además de la cabecera `Content-Type`, se comprueba el contenido real del archivo por su firma binaria (`%PDF-`, PNG, JPEG, WEBP). Un archivo con otra extensión renombrada se rechaza con `415`.
- Las descargas se sirven con `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`.
- `/api/profile/me` incluye `archivos` (tipo, nombre, tamaño, fecha), sin el contenido.

## 3. Recuperación de contraseña

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/auth/forgot-password` | Envía el enlace. Siempre responde lo mismo, exista o no el correo. |
| `POST` | `/api/auth/reset-password` | Recibe `{ token, password }` y cambia la contraseña. |

- El token es aleatorio (32 bytes). En `password_resets` solo se guarda su hash SHA-256; vence en 60 minutos, se usa una sola vez y solo el último enlace emitido es válido.
- Límite de 5 solicitudes cada 15 minutos por IP y correo.
- El correo se envía con la API HTTP de [Resend](https://resend.com), sin dependencias nuevas. Variables: `RESEND_API_KEY`, `MAIL_FROM` y `APP_URL` (la URL del frontend usada en el enlace). Sin `RESEND_API_KEY`, en desarrollo el enlace se muestra en la consola y en producción se registra una advertencia.
- El enlace abre `https://<frontend>/?reset=<token>`. El frontend muestra el formulario de nueva contraseña y luego limpia la URL.
- **Cierre de sesiones:** la columna `usuarios.token_version` viaja en el JWT (`ver`). Cambiar o restablecer la contraseña la incrementa, lo que invalida las sesiones abiertas en otros dispositivos. El cambio desde el perfil devuelve un token nuevo para que la sesión actual continúe. Los tokens emitidos antes de esta fase no llevan `ver` y se tratan como versión 0, así que siguen válidos.

## 4. Ofertas de formación

- La migración `20261010_offer_type_formacion.sql` añade `FORMACION` al enum `offer_type`. Va sola y sin transacción explícita, porque PostgreSQL no permite usar el valor nuevo en la misma transacción que lo crea.
- El formulario de la empresa incluye un selector "Tipo de oferta". Para Formación no se pide remuneración.
- El catálogo del estudiante tiene un filtro por tipo; el detalle muestra "Inscribirme" y las estadísticas incluyen la categoría.

## 5. Verificación

| Prueba | Resultado |
| --- | --- |
| Backend (`npm test`) | 94 de 94 (14 nuevas) |
| Frontend (`npm test`) | 26 de 26 (5 nuevas) |
| E2E Fase 6 en Microsoft Edge | 9 de 9 flujos |
| E2E Fase 5 (regresión) | 20 de 20 flujos |

Flujos E2E de esta fase: publicar una formación, subir el logo de la empresa, registrar educación, experiencia y habilidades, subir CV y foto, inscribirse, ver la hoja de vida del postulante y descargar su CV, recuperar la contraseña con el enlace del correo, comprobar el cierre de la sesión anterior e importar los datos locales de la versión anterior.

La regresión detectó que el enlace "Ver hoja de vida enlazada" había desaparecido del perfil del candidato externo; se restauró.

## 6. Pasos para publicar

1. En Render, añadir `APP_URL` con la URL de producción de Vercel.
2. Para enviar correos reales: crear una cuenta en Resend, verificar un dominio y configurar `RESEND_API_KEY` y `MAIL_FROM` (por ejemplo `SIPU <no-responder@tu-dominio>`). Sin dominio verificado, Resend solo entrega correos a la dirección del propietario de la cuenta.
3. Fusionar y desplegar. La API aplica sola las dos migraciones nuevas.

## 7. Pendientes conocidos

- Los archivos en `BYTEA` son adecuados para el volumen actual. Con muchos usuarios convendría un almacenamiento de objetos (S3, Cloudflare R2) que guarde solo la referencia en la base.
- El límite de solicitudes sigue en memoria.
- Reestructuración del código por módulos y uso de `react-router`, propuesta como fase siguiente.
