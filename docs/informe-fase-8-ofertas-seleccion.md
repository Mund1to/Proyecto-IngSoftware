# Informe de la Fase 8: ofertas con opciones, hoja de vida por postulación y proceso de selección

Rama: `feature/fase-8-ofertas-seleccion`, creada sobre `main` (`b5087cf`). Fecha: 2 de noviembre de 2026.

## Objetivo

La revisión partió de tres problemas reportados al usar la aplicación:

1. **Crear una oferta era un formulario estático de texto libre.** Se podía escribir "Que necesitas rey" como habilidades, "obvio" como experiencia, "Area?" como área o "sasadasd" como descripción, y la oferta se publicaba igual. Además, una práctica con remuneración de $3.333 pasaba sin aviso.
2. **La hoja de vida de una postulación cambiaba sola.** Si un candidato se postulaba a "Software Engineering" con un CV y luego subía otro CV para "Ingeniería de datos", la primera empresa también veía el CV nuevo. El primero se perdía.
3. **La gestión de postulantes no era un proceso.** La empresa solo tenía un botón que cambiaba el estado, sin fecha de entrevista, sin mensaje para el candidato, sin notas ni historial. El candidato solo veía una etiqueta.

## 1. Diagnóstico del CV que cambiaba

La tabla `archivos` guarda **un** CV por perfil (`UNIQUE (perfil_id, tipo)`) y la descarga de la empresa (`GET /api/applications/:id/cv`) hacía un `JOIN` con ese archivo por `candidato_id`. La postulación no guardaba ninguna copia: siempre se servía el CV vigente del perfil. Lo mismo pasaba con la formación, la experiencia y las habilidades que la empresa veía en el perfil del candidato.

**Solución:** cada postulación guarda una copia al enviarse.

- `postulaciones.hoja_vida` (`JSONB`): formación, experiencia, habilidades y datos académicos con los que se postuló.
- `postulacion_cv`: el PDF enviado, con `origen` `PERFIL` (copia del CV del perfil) o `PROPIO` (un PDF subido solo para esa oferta).
- La postulación, la copia del CV y el primer evento del historial se guardan en una sola transacción.
- Los datos de contacto (nombre, correo y teléfono) se siguen leyendo del perfil, para que la empresa use los vigentes.
- La migración copió los datos actuales en las postulaciones anteriores, porque era lo que la empresa ya veía.

Con esto, cambiar o borrar el CV del perfil no altera lo enviado. La prueba `cambiar la hoja de vida del perfil no altera la de postulaciones anteriores` reproduce el caso reportado (software y luego datos).

## 2. Formulario de oferta por pasos

El formulario se reemplazó por un asistente de cinco pasos con vista previa en vivo.

| Paso | Contenido |
| --- | --- |
| 1. Tipo | Tarjetas de Práctica, Empleo, Empleo público y Formación, cada una con su público y lo que cambia. Al cambiar de tipo se corrige lo que ya no aplica. |
| 2. La oferta | Título con sugerencias según el tipo y el área, área entre 15 opciones u "Otra área", descripción con guía para redactarla y contador de palabras útiles, y vacantes (o cupos). |
| 3. Perfil | Habilidades sugeridas según el área (chips, de 1 a 15), programas sugeridos con búsqueda, semestre mínimo (solo prácticas), experiencia por opciones (una práctica no pide más de un año), idiomas con nivel A1 a C2 o nativo, y requisitos adicionales. |
| 4. Condiciones | Modalidad en tarjetas y ciudad por lista (en remoto, "Todo el país"). La jornada es obligatoria en empleo. Duración y horario tienen sugerencias. La remuneración depende del tipo: con o sin apoyo económico en práctica, rango en empleo y ninguna en formación. Beneficios sugeridos por tipo. |
| 5. Publicación | Fecha de cierre con atajos de 2 semanas a 3 meses y días restantes, correo de contacto con el de la cuenta ya escrito, y un resumen para revisar antes de publicar. |

Otros comportamientos del asistente:

- **Validación por paso:** "Siguiente" no avanza si hay errores, muestra el mensaje junto al campo, lleva el foco al primero y marca el paso en el indicador superior ("2 por revisar").
- **Texto sin sentido:** se rechaza la descripción con menos de 10 palabras (60 caracteres) o con aspecto de texto al azar (pocas palabras distintas o palabras sin vocales). Los encabezados de la guía no cuentan como contenido.
- **Avisos:** un pago mensual menor que $200.000 muestra un aviso de posible error de digitación, sin bloquear.
- **Calidad de la oferta:** un indicador de 0 a 100 % con consejos (descripción de más de 200 caracteres, 3 habilidades o más, programas, remuneración visible, beneficios, al menos dos semanas para postularse).
- **Borradores:** se guardan solos en el navegador mientras se escribe. "Guardar borrador" crea una oferta `BORRADOR` en la cuenta, que aparece en el panel con "Continuar borrador" y solo se publica al completarla.
- **Errores del servidor:** la API devuelve `errors` por campo y el asistente lleva al paso de ese campo.

### Reglas en el servidor

Las mismas reglas están en `backend/src/modules/offers/offers.validation.js`, así que no dependen del navegador:

- **Formato:** siempre se valida el formato. Los códigos de experiencia y jornada deben ser del catálogo, los niveles de idioma A1 a C2 o nativo, las listas tienen máximos y largos por elemento, las vacantes van de 1 a 50, el cierre es como máximo a un año y la remuneración tiene un máximo.
- **Contenido para publicar:** al publicar se exigen título con letras, descripción con contenido, área, ciudad, modalidad, correo, cierre y al menos una habilidad. Una práctica no puede exigir más de un año de experiencia, y si tiene apoyo económico debe ser mayor que cero. El empleo necesita salario.
- **Ajustes por tipo:** la formación nunca lleva salario, experiencia ni semestre. Solo la práctica pide semestre y usa un único valor de remuneración.
- **Borradores y ofertas anteriores:** un borrador puede quedar incompleto. Una oferta publicada antes de estas reglas puede editar un campo, por ejemplo ampliar el cierre, sin tener que completar todo; lo editado sí debe cumplir las reglas.
- **Afinidad:** la afinidad con el candidato ahora cuenta las habilidades y los programas estructurados.

## 3. Proceso de selección

### Etapas y reglas

Las reglas son funciones puras en `backend/src/modules/applications/applications.domain.js`. El frontend las repite en `features/applications/applicants.model.ts` y una prueba de contrato comprueba que coincidan para todos los estados y tipos de oferta.

| Desde | Práctica, empleo y empleo público | Formación |
| --- | --- | --- |
| Nueva (`ENVIADA`) | En revisión, Entrevista, Descartado | En revisión, Inscrito, Descartado |
| En revisión | Entrevista, Descartado | Inscrito, Descartado |
| Entrevista (`PRESELECCIONADA`) | Reprogramar, Seleccionado, Descartado, volver a revisión | — |
| Seleccionado o descartado | Reabrir (volver a revisión) | Reabrir |
| Retirada | Ninguna: la retiró el candidato | Ninguna |

Reglas que aplican a todas las etapas:

- **Mensaje de bloqueo:** un cambio no permitido responde `409` con el motivo, por ejemplo "Antes de aceptar a un candidato debes citarlo a entrevista." El frontend muestra el mismo texto.
- **Entrevista:** citar exige fecha y hora futuras, como máximo a seis meses, y modalidad presencial, virtual o telefónica. La presencial necesita dirección, la virtual un enlace `https` y la telefónica nada más. La duración va de 15 a 240 minutos.
- **Datos que se conservan:** volver a revisión borra la entrevista vigente. Decidir después de la entrevista la conserva como registro.
- **Concurrencia:** cada cambio bloquea la fila (`FOR UPDATE`) para que dos personas de la empresa no se crucen.

### Historial, notas, calificación y avisos

- **Historial:** `postulacion_eventos` guarda la postulación, los cambios de etapa con su mensaje para el candidato, las entrevistas, las reprogramaciones, el retiro con su motivo, los cambios de CV y las notas.
- **Notas:** son privadas (`privado = TRUE`). La empresa las ve con el nombre de quien las escribió; el candidato no las recibe.
- **Calificación:** es interna, de 1 a 5 estrellas (`postulaciones.calificacion`), y el candidato no la ve.
- **Correos:** el candidato recibe un correo cuando lo citan, le reprograman la entrevista, lo seleccionan o lo descartan. El correo incluye el mensaje de la empresa y los datos de la entrevista en hora de Colombia. Un fallo del proveedor de correo no deshace el cambio.

### Pantalla de la empresa (Postulantes)

- **Cabecera:** la oferta, su cierre y cuántas vacantes van cubiertas, con una barra de avance.
- **Tablero:**
  - Columnas Nuevas, En revisión, Entrevista, Seleccionados y Descartados. La formación tiene Nuevas, En revisión, Inscritos y Descartados.
  - Las tarjetas muestran la coincidencia de habilidades con la oferta, si hay CV, la calificación, la fecha de la entrevista y hace cuánto se postuló.
  - Mover una tarjeta, arrastrándola o con el menú "Mover a…" (accesible por teclado), solo ofrece las etapas permitidas. Al soltarla en una columna no permitida, aparece el motivo.
- **Lista:** una vista de lista con búsqueda por nombre, carrera o habilidad, y orden por fecha, coincidencia o calificación.
- **Panel del candidato:**
  - Contacto con enlaces de correo y teléfono, etapa y estrellas.
  - Pestaña "Hoja de vida": el CV enviado (y si es copia del perfil o subido para la oferta), el mensaje del candidato, la coincidencia con habilidades que tiene y que le faltan, formación, experiencia y resumen.
  - Pestaña "Actividad y notas": el historial completo con autor y el campo para escribir notas internas.
  - La acción principal depende de la etapa: Empezar revisión, Citar a entrevista, Seleccionar o Reabrir.
- **Diálogos:**
  - Citar o reprogramar: fecha, hora, modalidad, enlace o dirección y duración, con una frase que muestra cómo lo verá el candidato.
  - Seleccionar: indica si se cubre o se excede el número de vacantes.
  - Descartar: mensajes sugeridos (perfil, vacante cubierta, después de la entrevista o uno propio).
  - Reabrir: mensaje opcional para el candidato.

### Pantalla del candidato (Mis postulaciones)

- **Postularse:**
  - El candidato elige la hoja de vida que envía: la de su perfil (se manda una copia), un PDF distinto solo para esa oferta o ninguna.
  - Puede dejar un mensaje para la empresa.
  - La ventana le explica que lo enviado no cambia aunque después edite su perfil.
  - El profesional externo ahora también confirma antes de enviar; antes se postulaba con un solo clic.
- **Seguimiento:**
  - La entrevista aparece con su fecha y hora de Colombia, la modalidad, el enlace o la dirección, la duración y el botón "Agregar a mi calendario", que descarga un archivo `.ics`.
  - Se ven el último mensaje de la empresa y el historial completo.
  - Se ve la hoja de vida enviada. Mientras la postulación siga Enviada, el candidato puede cambiarla o adjuntarla.
- **Retiro:** retirar una postulación pide un motivo opcional, que queda en el historial que ve la empresa.
- **Notificaciones:** el menú avisa cada paso de la empresa, como la citación, la reprogramación o la decisión.

## 4. Modelo de datos

Las tres migraciones son aditivas e idempotentes y Render las aplica al arrancar:

| Migración | Cambios |
| --- | --- |
| `20261102_application_resume_snapshot.sql` | `postulaciones.hoja_vida` y tabla `postulacion_cv`; copia de los datos actuales en las postulaciones existentes. |
| `20261102_application_pipeline.sql` | Tabla `postulacion_eventos` (con índice por postulación y fecha), `postulaciones.entrevista` y `postulaciones.calificacion`; reconstrucción del historial existente. El texto automático "Postulación a …" de versiones anteriores no se muestra como mensaje del candidato. |
| `20261102_offer_structured_requirements.sql` | Columnas `programas`, `semestre_minimo`, `habilidades`, `experiencia`, `idiomas`, `jornada`, `beneficios` y `vacantes` en `ofertas`. |

El detalle de las columnas está en [`database-schema.md`](database-schema.md).

## 5. API

| Método | Ruta | Acceso | Cambio |
| --- | --- | --- | --- |
| `POST` | `/api/offers`, `PATCH /api/offers/:id` | Organización | Campos estructurados nuevos. Al publicar se aplican las reglas de contenido; un `400` incluye `errors` por campo. |
| `POST` | `/api/applications/offers/:offerId` | Candidato | Acepta `cartaPresentacion` (hasta 1500 caracteres) y `cvPerfil` (`false` para no copiar el CV del perfil). Devuelve el CV copiado. |
| `PUT` | `/api/applications/:id/cv` | Candidato dueño | Nuevo. Sube un PDF solo para esa postulación mientras siga `ENVIADA` (después responde `409`). |
| `GET` | `/api/applications/:id/cv` | Organización dueña o candidato | Sirve la copia enviada; ahora también la ve el propio candidato. |
| `PATCH` | `/api/applications/:id/status` | Organización dueña | Recibe `mensaje` y `entrevista`; valida la etapa y devuelve el evento creado. |
| `POST` | `/api/applications/:id/notes` | Organización dueña | Nuevo. Nota interna. |
| `PATCH` | `/api/applications/:id/rating` | Organización dueña | Nuevo. Calificación de 1 a 5 o `null`. |
| `PATCH` | `/api/applications/:id/withdraw` | Candidato dueño | Acepta `motivo` opcional. |
| `GET` | `/api/applications/offers/:offerId` | Organización dueña | Incluye `hoja_vida` enviada, datos del CV, `entrevista`, `calificacion` y `eventos` (con notas y autor). |
| `GET` | `/api/applications/me` | Candidato | Incluye datos del CV enviado, `entrevista` y `eventos` públicos (sin notas ni nombres de usuarios de la empresa). |

## 6. Pruebas

| Suite | Antes | Ahora | Qué cubren las nuevas |
| --- | --- | --- | --- |
| Backend (`npm test`) | 124 | 145 | CV por postulación (el caso reportado, CV propio, permisos, migración), etapas y entrevista, formación sin entrevista, notas privadas, calificación, retiro con motivo, migración del historial, campos estructurados, reglas de publicación, borradores, ofertas anteriores y afinidad. Además, reglas puras en `unit.test.js`. |
| Frontend (`npm test`) | 69 | 99 | Asistente completo (validación por paso, opciones, envío), errores del servidor, reglas y conversión del formulario (`offerForm.test.ts`), tablero, citación y notas de la empresa, seguimiento del candidato, postularse con un PDF propio, retiro con motivo, modelo de selección y calendario (`selection.test.ts`), y contratos de catálogos, límites, etapas y modalidades de entrevista. |

Algunas pruebas anteriores se ajustaron porque las reglas cambiaron a propósito:

- Aceptar sin entrevista ahora responde `409`.
- El candidato puede descargar su propio CV enviado.
- El ayudante de pruebas publica ofertas con descripción y habilidades.
- El rango salarial se prueba en un empleo, porque la práctica usa un solo valor.
- El conteo por etapa cita con los datos de la entrevista.

Se ejecutaron `npm test` en el backend (145 de 145), `npm test`, `npm run typecheck` y `npm run build` en el frontend (99 de 99, sin errores de tipos y con el build correcto).

No se hizo una revisión visual en el navegador. Antes de desplegar conviene revisar en el navegador el asistente, el tablero (incluido arrastrar y soltar) y la vista móvil.

## 7. Pendientes y sugerencias

- **Revisión visual:** probar la interfaz de punta a punta en el navegador con cuentas de empresa y de candidato, en escritorio y en móvil.
- **Reunión virtual:** generar el enlace de la reunión automáticamente (Google Meet o Teams) en lugar de pegarlo a mano.
- **Respuesta del candidato:** que el candidato confirme o pida cambiar la fecha de la entrevista desde SIPU.
- **Equipos:** asignar un responsable por postulación y mencionar a compañeros en las notas.
- **Almacenamiento:** si el volumen de CV crece, guardar los PDF una sola vez por contenido (hash) o en un almacenamiento de objetos, en lugar de un `BYTEA` por postulación.
- **Catálogo de programas:** los programas sugeridos son una lista de referencia. Conviene reemplazarla por el catálogo oficial de la universidad.
