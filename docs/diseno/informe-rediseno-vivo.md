# Informe del rediseño "vivo"

Este informe registra la implementación por fases del rediseño visual "vivo" del frontend de SIPU. El plan está en [`prompt-implementacion-vivo.md`](prompt-implementacion-vivo.md) y las maquetas de referencia en [`referencia-vivo/`](referencia-vivo/).

Reglas que aplican a todas las fases:

- La paleta y la tipografía (DM Sans) no cambian.
- La lógica de negocio, las llamadas existentes a la API, `App.tsx` y la navegación no cambian.
- Accesibilidad:
  - foco visible y áreas táctiles de al menos 44 px;
  - `aria-label` en los botones que solo tienen ícono;
  - los estados nunca dependen solo del color.
- Todas las animaciones nuevas se desactivan con `prefers-reduced-motion`.
- Todo funciona a 390 px de ancho.

## Estado

| Fase | Alcance | Estado |
| --- | --- | --- |
| 1 | Base visual y componentes compartidos | Terminada |
| 2 | Autenticación | Terminada |
| 3 | Ofertas del estudiante | Terminada |
| 4 | Detalle de oferta | Terminada |
| 5 | Panel de empresa | Terminada |
| 6 | Estadísticas | Terminada |
| 7 | Resto de pantallas y limpieza de la capa de compatibilidad | Terminada |

## Fase 1: base visual y componentes compartidos

- `index.css`:
  - Agrega el peso 800 de DM Sans y la variable `--navy: #0d2240`.
  - Agrega las utilidades `.display`, `.highlight` (más `.highlight.on-light` para fondos claros), `.dots` y `.hero-card`.
  - Agrega las tarjetas `.panel-card` y `.panel-card.interactive`.
- `NavBar`:
  - Los enlaces van en una píldora y el enlace activo es una píldora azul marino.
  - La campana, cerrar sesión y el menú son botones circulares.
  - Hay un avatar con iniciales y el primer nombre; abre "Mi perfil". El administrador no tiene perfil, así que para él el avatar no es un botón.
  - En el celular, "Cerrar sesión" está dentro del menú. Antes no había forma de cerrar sesión en el celular.
- Componentes nuevos:

| Componente | Qué hace |
| --- | --- |
| `icons.tsx` | Íconos de trazo, incluido el check de organización verificada. |
| `TypeBadge` | Tipo de oferta con ícono. Acepta el código de la API o la etiqueta. |
| `DueBadge` | "Cierra en N días", "Abierta" o "Cerrada", siempre con texto e ícono. |
| `ArdyBubble` | Ardy con un globo de diálogo y una flotación suave. |
| `ProgressMeter` | Barra de progreso con `role="progressbar"`. |

- `FilterDropdown`: el disparador pasa a radio de 12 px.

## Fase 2: autenticación (`AuthScreen.tsx`)

- **Panel izquierdo:**
  - El título resalta "oportunidades reales.".
  - Ardy aparece con tres tarjetas flotantes decorativas (`aria-hidden`).
  - Abajo van las píldoras de los tres públicos.
- **Control segmentado:** usa `role="tablist"` para cambiar entre iniciar sesión y crear cuenta; las flechas izquierda y derecha también cambian de pestaña.
- **Campos:** llevan ícono. Un botón de ojo con `aria-pressed` reemplaza la casilla "Mostrar contraseña".
- **Login:** muestra tres accesos de perfil que abren el registro con ese tipo de cuenta ya elegido.
- **Registro:** el tipo de cuenta se elige en tarjetas que conservan el `fieldset` y los radios reales.
- **Sin cambios:** la validación, las vistas de recuperación y los mensajes.

## Fase 3: ofertas del estudiante (`StudentDashboard.tsx`)

- **Backend:**
  - `GET /api/offers/recommended` devuelve `affinity`, un valor de 0 a 100.
  - Se calcula con `offerAffinity`: el puntaje de `scoreOffer` frente a `maxScoreOffer`, el máximo posible de esa oferta para ese tipo de perfil.
  - Solo cuentan los criterios que el perfil puede cumplir. El estudiante no registra ciudad, así que la ciudad no entra en su máximo.
  - La verificación de la empresa sigue sumando al orden, pero no a la afinidad.
- **Cabecera:** `.hero-card` con el saludo, el buscador blanco y Ardy con "¡Encontré N ofertas para ti!", donde N es el número de ofertas recomendadas.
- **"Explora por tipo":** fichas con contador. Si hay ofertas de "Empleo público", aparece una quinta ficha. Las fichas reemplazan al desplegable "Tipo", pero su chip sigue en filtros activos.
- **Tarjeta de oferta:** tipo, cierre, botón circular de guardar, check de verificada, chips con íconos, barra de afinidad (solo si llega `affinity`) y remuneración.
- **Píldora "en revisión":** las postulaciones del estudiante no tienen el estado "Entrevista", así que la píldora cuenta las que están "En revisión".

## Fase 4: detalle de oferta (`OfferDetail.tsx`)

- **Cabecera clara:** anillo de afinidad hecho con `conic-gradient`. Se oculta si no hay `affinity`.
- **Habilidades:** se comparan con las del perfil, que se cargan con `GET /api/profile/details`.
  - La oferta no tiene un campo propio de habilidades: se obtienen separando por comas el contenido de `requisitos` y se excluye el área de la oferta.
- **Proceso:** cuatro pasos que se marcan según el estado de la postulación.
- **Barra lateral oscura:**
  - Muestra la remuneración y una cuenta regresiva que mide los últimos 30 días antes del cierre, siempre con los días en texto.
  - Debajo va el "Consejo de Ardy" con el avance del perfil: foto, educación, experiencia, habilidades y hoja de vida.
- **Sin cambios:** los modales de confirmación y de éxito.

## Fase 5: panel de empresa (`CompanyDashboard.tsx`)

- **Backend:** `GET /api/offers/mine` devuelve dos campos nuevos en cada oferta.
  - `conteo_estados`: postulaciones por estado, por ejemplo `{ "ENVIADA": 2, "PRESELECCIONADA": 1 }`.
  - `nuevos_semana`: postulaciones de los últimos 7 días.
  - Ambos se calculan con un `COUNT ... GROUP BY estado` en una sola consulta.
- **Cabecera `.hero-card`:**
  - Saludo "Hola, {organización}." y la frase de postulantes nuevos de la semana; si no hay datos, se omite.
  - Insignia "Organización verificada" o "Verificación pendiente", con ícono y texto.
  - Botones "Crear oferta" y "Revisar postulantes".
- **Indicadores:** cuatro, con ícono: ofertas activas, postulantes, en revisión y nuevos esta semana.
- **Ofertas en grilla de tarjetas:**
  - Cada tarjeta muestra tipo, estado, datos y total de postulantes.
  - La barra está segmentada por etapa: Enviada, En revisión, Entrevista (`PRESELECCIONADA`) y Aceptada.
  - Debajo va la leyenda con los números; la barra tiene `role="img"` con los conteos en su etiqueta.
  - Las postulaciones rechazadas y retiradas cuentan en el total, pero no en la barra.
- **Nueva oferta:** una tarjeta punteada "Publicar una nueva oferta" al final de la grilla.
- **Sin cambios:** el formulario de crear y editar, la vista previa y el modal de cancelar. Solo cambian sus radios y botones.

## Fase 6: estadísticas (`EmploymentStats.tsx`)

- **Título:** "Estadísticas de empleo", con "empleo" resaltado, y la nota de que no incluye datos personales.
- **Indicadores grandes:** cuatro, con el primero oscuro.
  - Ofertas publicadas, con el total de ofertas debajo.
  - Postulaciones, con las aceptadas debajo.
  - Organizaciones, con las verificadas debajo.
  - Tasa de colocación: aceptadas ÷ postulaciones.
- **Mini indicadores:** debajo de los grandes, una fila con el resto de `stats.totals`.
- **Gráficos hechos con CSS, sin librerías:**
  - Dona por tipo con `conic-gradient`; la leyenda muestra valor y porcentaje.
  - Columnas de los últimos 6 meses, con el mes más alto resaltado.
  - Barras horizontales por ciudad y por área.
  - Ranking numerado de organizaciones.
- **Accesibilidad:** cada gráfico tiene `role="img"` y un `aria-label` con los datos; el ranking es una lista ordenada con su nombre.
- **Meses sin postulaciones:** la API solo devuelve los meses que tienen datos, así que el frontend completa con 0 los meses vacíos.
- **Periodo:** no se agregó el selector de la maqueta, porque la API no filtra por fechas.

## Fase 7: resto de pantallas y capa de compatibilidad

Pantallas migradas, más los componentes `ProfileSections`, `ProfileFiles` y `ChangePasswordCard`:

- Externo: `ExternalDashboard`, `ExternalJobDetail`, `ExternalApplications` y `ExternalProfile`.
- Estudiante: `StudentApplications` y `StudentProfile`.
- Empresa: `CompanyApplicants` y `CompanyProfile`.
- Administración: `CompanyVerification`, `Convocatorias` y `AdminUsers`.

La lógica de estas pantallas no cambió.

- **Colores fijos:** los de Tailwind (`text-[#0d2240]`, `bg-[#f0f4f8]`, `border-[#e8eef4]`, etc.) pasan a las variables de la paleta: títulos en `--navy`, grises en `--muted`, botones en `--primary`, verdes en `--success` y bordes en `#d3e0f5`. Fueron 399 reemplazos.
- **Colores con nombre:** los de estado (rojo, ámbar, verde, violeta, azul, gris) pasan a `--danger`, `--warning`, `--success`, `--primary` y neutros, en 175 reemplazos. Solo quedan los tonos translúcidos sobre fondos oscuros.
- **Degradados:**
  - Las cabeceras usan el de `.hero-card`.
  - Las marcas de empresa y los avatares usan uno solo; antes cada letra tenía un color distinto fuera de la paleta.
  - Las barras de avance son azules.
- **Botón "Inscribirme" / "Aplicar" del externo:** pasa de verde a azul primario, como el resto de acciones principales. Las acciones de aprobar y aceptar siguen en verde.
- **Emojis:** se reemplazan por íconos SVG (ubicación, modalidad, área, experiencia, fecha, archivo e imagen) o se quitan cuando solo eran decoración.
- **Tarjetas de la bolsa externa:** el tipo de vacante usa `TypeBadge`.
- **Títulos y radios:** los títulos de página usan `.display`. Las tarjetas tienen radios explícitos de 20 y 24 px.
- **Capa de compatibilidad:** solo conserva las clases que todavía usa `App.tsx` (pantalla de carga y `ErrorBoundary`), además de las reglas generales de altura de campos y transiciones.
- **Estilos sin uso:** se eliminaron los del diseño anterior que ya no usaba ninguna pantalla (catálogo, detalle y panel antiguos): 107 reglas. `index.css` pasó de 1.082 a 844 líneas.

## Verificación

| Prueba | Resultado |
| --- | --- |
| Backend (`npm test`) | 100 de 100 |
| Frontend (`npm test`) | 41 de 41 (15 nuevas en el rediseño) |
| `npm run build` y comprobación de tipos | Correctos |

Cada fase se revisó en Microsoft Edge a 1440 y 390 px, sin desplazamiento horizontal y con flujos reales contra la API:

- registro e inicio de sesión;
- cerrar sesión desde el menú del celular;
- guardar ofertas y filtrar;
- abrir el detalle y postularse.

## Pendientes conocidos

- `App.tsx` todavía usa algunas clases de colores fijos en la pantalla de carga y en `ErrorBoundary`. Migrarlas permitiría borrar del todo la capa de compatibilidad, pero el plan pedía no modificar `App.tsx`.
- Un campo `habilidades` propio en las ofertas mejoraría la comparación de habilidades del detalle.
