# Prompt: implementar el diseño "vivo" de SIPU

Copia todo lo que está debajo de la línea en Claude Code (VS Code). Está pensado para hacerse por fases; pide una fase a la vez.

---

Vamos a implementar en el frontend de SIPU un rediseño visual llamado "vivo". Las maquetas de referencia están en `docs/diseno/referencia-vivo/`:

- `Login.dc.html`: autenticación.
- `Ofertas.dc.html`: ofertas del estudiante, con filtros desplegables.
- `Detalle.dc.html`: detalle de oferta.
- `Empresa.dc.html`: panel de la empresa.
- `Estadisticas.dc.html`: estadísticas del administrador.

Son HTML con estilos en línea y un bloque `<script>` con datos de ejemplo. Úsalas solo como referencia visual: copia sus medidas, colores, radios, sombras y animaciones, pero NO copies su HTML tal cual. Impleméntalo con los componentes React existentes y con clases en `frontend/src/index.css`, que es la convención actual del proyecto. Los datos salen de la API, como ya funcionan hoy.

## Reglas generales

- **Paleta y tipografía:** no cambies la paleta. Usa las variables de `:root` en `frontend/src/index.css` (`--primary`, `--primary-dark`, `--selection`, `--primary-soft`, `--sky`, `--primary-bright`, etc.) y agrega `--navy: #0d2240`. La tipografía sigue siendo DM Sans; agrega el peso 800 al `@import` de Google Fonts.
- **Lógica:** no cambies la lógica de negocio, las llamadas a la API, `App.tsx` ni la navegación entre pantallas. Solo cambia la presentación.
- **Textos:** todo en español de Colombia y tuteando, igual que hoy.
- **Accesibilidad:**
  - Botones reales para las acciones, `aria-label` en los botones que solo tienen ícono, foco visible y áreas táctiles de al menos 44 px.
  - Los estados nunca dependen solo del color: llevan texto o ícono.
- **Íconos:** SVG en línea de trazo, sin emojis. Crea `frontend/src/components/icons.tsx` con los íconos que se repiten.
- **Movimiento:** todas las animaciones nuevas se desactivan con `@media (prefers-reduced-motion: reduce)`.
- **Celular:** cada pantalla debe seguir funcionando a 390 px de ancho. Las grillas usan `repeat(auto-fit, minmax(...))` y el menú se colapsa como hoy.
- **Al terminar cada fase:**
  1. Ejecuta `npm test` en `frontend/` y confirma que las 26 pruebas pasan. Ajusta las que dependan de textos o estructura que hayas cambiado, sin debilitarlas.
  2. Ejecuta `npm run build`.
  3. Muéstrame el resumen de cambios.
  4. No hagas commit hasta que te lo pida.

## Fase 1: base visual y componentes compartidos

1. **Utilidades nuevas en `index.css`:**
   - `.display`: títulos en peso 800 con `letter-spacing: -0.04em` y `line-height: 1.05`.
   - `.highlight`: trazo de marcador detrás de una palabra. Es `background-image: linear-gradient(transparent 68%, rgba(77,135,255,.8) 68%, rgba(77,135,255,.8) 92%, transparent 92%)` sobre fondo oscuro; sobre fondo claro usa `#dce9ff`.
   - `.dots`: trama de puntos `radial-gradient(rgba(255,255,255,.22) 1.4px, transparent 1.4px)` de 16 px.
   - `.hero-card`: radio de 28 px y degradado `linear-gradient(130deg, #0d2240, #123b70 40%, #155eef 85%, #3978f4)` con un brillo `radial-gradient` arriba a la derecha.
   - Tarjetas con radio de 20 a 22 px, borde `#d3e0f5` y elevación al pasar el mouse (`translateY(-3px)` más sombra).
2. **`NavBar`:**
   - Los enlaces van dentro de una píldora con fondo `#eef3fc`, y el enlace activo es una píldora marino `#123b70` con texto blanco.
   - La campana es un botón circular con borde.
   - El nombre del usuario pasa a ser un botón con avatar circular de iniciales (degradado de `#123b70` a `#4d87ff`) más el primer nombre.
   - Mantén las notificaciones, el menú móvil y el botón de cerrar sesión exactamente como funcionan hoy.
3. **Componentes nuevos** en `frontend/src/components/`:
   - `TypeBadge`: tipo de oferta con ícono. Práctica en `#155eef` sobre `#dce9ff`, Empleo en blanco sobre `#123b70` y Formación en `#0d2240` sobre `#dff4ff`.
   - `DueBadge`: "Cierra en N días" en ámbar si faltan 14 días o menos; "Abierta" en verde en otro caso; "Cerrada" en rojo.
   - `ArdyBubble`: Ardy circular con un globo de diálogo (título y texto) y una animación suave de flotación.
   - `ProgressMeter`: barra de 8 px redondeada con relleno degradado de `#155eef` a `#4d87ff`.
   - `FilterDropdown`: los filtros desplegables. Si ya existe porque implementamos el prompt anterior de filtros, reutilízalo y solo ajusta los radios a 12 px.

## Fase 2: Autenticación (`screens/AuthScreen.tsx`)

Toma como referencia `Login.dc.html`.

- **Panel izquierdo:**
  - Va con márgenes de 16 px, radio de 28 px y la trama de puntos.
  - El título es "Tu talento encuentra oportunidades reales.", con "oportunidades reales." resaltado.
  - En el centro, Ardy circular rodeado de tres tarjetas flotantes decorativas, marcadas con `aria-hidden`.
  - Abajo, píldoras con los tres públicos: Estudiantes, Profesionales y Empresas.
- **Panel derecho:**
  - Un control segmentado (`role="tablist"`) cambia entre las vistas `login` y `register`.
  - Los campos llevan ícono y un botón de ojo para mostrar la contraseña; ese botón reemplaza la casilla "Mostrar contraseña".
  - El botón principal tiene una flecha que se desplaza al pasar el mouse.
- **Accesos de registro en la vista de login:** debajo, tres botones de perfil (Estudiante, Profesional, Empresa). Cada uno abre `register` con ese rol ya elegido.
- **Selector de tipo de cuenta en registro:** tarjetas en lista, con ícono, título, descripción y un radio visual. Mantén el `<fieldset>`/`<legend>` y los inputs radio reales.
- **Lo que no cambia:** las vistas `forgot` y `reset`, la validación, los mensajes de error, el aviso de servidor lento y la lista de reglas de contraseña. Solo adáptalos al nuevo estilo.

## Fase 3: Ofertas del estudiante (`screens/StudentDashboard.tsx`)

Toma como referencia `Ofertas.dc.html`.

- **Cabecera:** usa `.hero-card` con el saludo "Hola, {nombre}. Tu próxima oportunidad está aquí." ("oportunidad" resaltado) y el buscador blanco grande con el botón "Buscar".
  - A la derecha va `ArdyBubble` con "¡Encontré N ofertas para ti!", donde N son las ofertas recomendadas que devuelve `api.getRecommendedOffers`.
  - Debajo de Ardy, píldoras con el número de ofertas guardadas y de postulaciones en entrevista (de `session.applications`). Si no hay sesión, oculta el bloque.
- **"Explora por tipo":** cuatro fichas (Todas, Prácticas, Empleos, Formación) que actúan sobre el estado `offerType` existente y muestran cuántas ofertas hay de cada tipo.
- **Filtros:** `FilterDropdown` para Ciudad, Área, Modalidad y Ordenar por, el botón "Solo guardadas" y los chips de filtros activos.
- **`OfferCard` nueva:**
  - Arriba: `TypeBadge`, `DueBadge` y el botón circular de guardar, que se rellena al guardar.
  - Luego: la marca de la empresa, el título, la empresa con un check de verificada, y chips de ciudad, modalidad y área con íconos.
  - Abajo: la barra "Afinidad con tu perfil" y el pie con la remuneración más un botón circular con flecha.
- **Afinidad:** `GET` de ofertas recomendadas ya devuelve `recommendationScore` (en `backend/src/controllers/offers.controller.js`, `scoreOffer`), pero es un puntaje sin tope.
  - En el backend, agrega un campo `affinity` (0 a 100) normalizando el puntaje contra el máximo posible de `scoreOffer`, y agrega su prueba en el backend.
  - En el frontend, si `affinity` no viene, no muestres la barra.
- **Estado vacío:** con Ardy y el texto "Ardy siguió buscando, pero nada coincide. Prueba quitando algunos filtros."

## Fase 4: Detalle de oferta (`screens/OfferDetail.tsx`)

Toma como referencia `Detalle.dc.html`.

- **Cabecera:** clara, con radio de 28 px, marca de empresa de 88 px, `TypeBadge` y `DueBadge`, título de 42 px en peso 800 y chips con íconos.
  - A la derecha, un anillo de afinidad con `conic-gradient`. Si no hay `affinity`, se oculta.
- **Secciones:**
  - "Lo que harás" (la descripción).
  - "Requisitos", con checks dentro de círculos verdes.
  - "Habilidades": las que el estudiante ya tiene van como chips azules rellenos con check; las que le faltan, como chips punteados con "+". Compara con las habilidades del perfil, que ya están en la sesión.
  - "Cómo es el proceso", con los 4 pasos: Enviada, En revisión, Entrevista y Resultado.
  - Duración, horario y contacto como tarjetas con ícono.
- **Barra lateral:**
  - Una tarjeta oscura con la remuneración, la fecha límite con la barra de cuenta regresiva y el botón blanco "Postularme" ("Inscribirme" si la oferta es de formación).
  - Debajo, "Consejo de Ardy" con el avance del perfil. Calcula ese avance en el frontend según qué secciones del perfil están completas (foto, educación, experiencia, habilidades y CV). Si no se puede calcular, oculta la tarjeta.
- **Lo que no cambia:** los modales de confirmación y de éxito, que solo se adaptan al nuevo estilo.

## Fase 5: Panel de empresa (`screens/CompanyDashboard.tsx`)

Toma como referencia `Empresa.dc.html`.

- **Cabecera:** `.hero-card` con "Hola, {organización}.", el número de postulantes nuevos de esta semana (si no hay dato, omite la frase), la insignia de verificación y los botones "Crear oferta" (blanco) y "Revisar postulantes".
- **Indicadores:** 4 indicadores con ícono en cuadro de color: ofertas activas, postulantes, en revisión y nuevos esta semana.
- **Ofertas publicadas:** en grilla de tarjetas.
  - Cada tarjeta lleva tipo, estado, título, datos, el total de postulantes y una barra segmentada por etapa con su leyenda: Enviada `#9dbbf3`, En revisión `#4d87ff`, Entrevista `#155eef` y Aceptada `#0d2240`.
  - Si la API no devuelve el conteo por etapa, agrégalo al endpoint de ofertas de la organización con un `COUNT ... GROUP BY estado`, con su prueba. Mientras no exista, muestra solo el total.
- **Nueva oferta:** una tarjeta punteada "Publicar una nueva oferta" al final de la grilla.
- **Lo que no cambia:** el formulario de crear y editar y el modal de cancelar oferta. Solo adáptalos al estilo (radios, botones).

## Fase 6: Estadísticas (`screens/EmploymentStats.tsx`)

Toma como referencia `Estadisticas.dc.html`.

- **Título:** "Estadísticas de empleo", con "empleo" resaltado, y la nota de que no incluye datos personales.
- **Indicadores:** 4 grandes (el primero oscuro): ofertas publicadas, postulaciones, organizaciones y tasa de colocación. Debajo, una fila de mini indicadores con el resto de `stats.totals`.
- **Gráficos:** hechos con CSS, sin librerías nuevas.
  - "Ofertas por tipo" como dona con `conic-gradient` y leyenda con porcentajes.
  - "Postulaciones por mes" como columnas, con el mes más alto resaltado.
  - "Ofertas por ciudad" y "Ofertas por área" como barras horizontales.
  - "Organizaciones con más ofertas" como ranking numerado.
  - Cada gráfico lleva `role="img"` y un `aria-label` con los datos.
- **Periodo:** NO agregues el selector de periodo de la maqueta salvo que la API soporte filtrar por fechas.

## Fase 7: Resto de pantallas

Aplica los mismos componentes y estilos a las pantallas que no tienen maqueta, sin cambiar su lógica:

- `ExternalDashboard`, `ExternalJobDetail`, `ExternalApplications` y `ExternalProfile`: son equivalentes a las del estudiante.
- `StudentApplications`, `StudentProfile`, `CompanyApplicants`, `CompanyProfile`, `CompanyVerification`, `Convocatorias` y `AdminUsers`.

Estas pantallas usan clases de Tailwind con colores fijos (`bg-[#0d2240]`, `rounded-2xl`, etc.) que la capa de compatibilidad de `index.css` reescribe con `!important`. Al migrar cada una, reemplaza esas clases por las del nuevo estilo. Elimina de la capa de compatibilidad solo las reglas que ya no use ninguna pantalla.
