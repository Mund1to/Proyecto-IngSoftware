# Brief de diseño: SIPU completo

Pega este documento en Claude Design. Adjunta también estas imágenes del repositorio:

- `frontend/src/imports/sipu-logo.png`: logo de SIPU.
- `frontend/src/imports/ardy.png`: Ardy, la ardilla mascota institucional.
- `frontend/src/imports/image.png` y `image-1.png`: logo de la Universidad de Ibagué.

---

## 1. Qué es SIPU

SIPU es el portal de empleo y prácticas de la Universidad de Ibagué (Colombia). Conecta tres públicos:

- **Estudiantes y egresados**, que buscan prácticas, empleos y cursos de formación.
- **Profesionales externos**, que no pertenecen a la universidad y buscan empleo.
- **Empresas**, que publican ofertas y revisan a los postulantes.

Un **administrador** de la universidad verifica empresas, publica convocatorias y consulta estadísticas.

Todo el texto de la interfaz va en español de Colombia. El tono es institucional, cercano y claro. Se tutea al usuario ("Crea tu cuenta", "Tus postulaciones").

## 2. Qué necesito

Diseña todas las pantallas de la aplicación en versión **escritorio (1440 px)** y **móvil (390 px)**. El objetivo es una identidad visual unificada, porque hoy conviven dos paletas (ver sección 3).

Entregables:

1. Una hoja de estilo con color, tipografía, espaciado, radios, sombras y componentes.
2. Las 17 pantallas de la sección 6, con sus estados vacío, de carga y de error cuando aplique.
3. Los flujos clave de la sección 7 conectados.

## 3. Identidad visual actual

### Paleta A: hojas de estilo globales (autenticación, botones, navegación)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#f6f9ff` | Fondo de la app |
| `--surface` | `#ffffff` | Tarjetas |
| `--text` | `#1d2939` | Texto principal |
| `--muted` | `#667085` | Texto secundario |
| `--border` | `#d0d9e8` | Bordes |
| `--primary` | `#155eef` | Acción principal, enlaces |
| `--primary-hover` | `#0b4dd1` | Hover |
| `--primary-dark` | `#123b70` | Fondos de marca |
| `--primary-soft` | `#dce9ff` | Fondos suaves |
| `--selection` | `#eaf2ff` | Selección y hover suave |
| `--success` | `#157347` | Éxito |
| `--warning` | `#a15c00` | Advertencia |
| `--danger` | `#b42318` | Error y acciones destructivas |

### Paleta B: pantallas internas (Tailwind)

| Color | Uso |
| --- | --- |
| `#0d2240` | Azul marino: títulos, cabeceras y botones oscuros |
| `#1e293b`, `#475569`, `#64748b`, `#94a3b8` | Escala de grises pizarra para texto |
| `#e2e8f0`, `#e8eef4`, `#f1f5f9`, `#f8fafc`, `#f0f4f8` | Bordes y fondos |
| `#16a34a`, `#f0fdf4`, `#bbf7d0` | Verde: estados positivos ("Aceptada", "Verificada") |
| `#60a5fa` | Azul claro de acento |

**Propuesta:** unificar en una sola paleta. Usa el azul `#155eef` como primario, el marino `#0d2240`/`#123b70` para la marca y los encabezados, y los grises pizarra para el texto.

### Tipografía

- **DM Sans**, pesos 400, 500, 600 y 700.
- Cuerpo de 16 px con interlineado 1.5.
- Títulos con `letter-spacing: -0.02em`.
- "Eyebrow" sobre los títulos: 14 px, peso 700, mayúsculas, espaciado 0.08em y color primario.

### Formas y detalles

- Botones de 44 px de alto mínimo y radio de 6 px.
- El botón primario lleva un degradado de `#155eef` a `#3478ff`, con sombra azul suave y una ligera elevación en hover.
- El botón secundario es blanco con borde gris y texto azul.
- Las tarjetas son blancas, con radio entre 12 y 24 px, borde fino y sombra `0 12px 35px rgba(18,59,112,.10)`.
- Contenedor de 1200 px de ancho máximo, con márgenes laterales de 16 px.
- El foco del teclado es visible: contorno azul de 2 px.

### Mascota

**Ardy**, una ardilla, aparece en:

- La pantalla de inicio de sesión: imagen grande con borde blanco translúcido.
- Los estados vacíos: avatar circular de 88 px.

## 4. Roles y navegación

Barra superior fija con el logo de SIPU a la izquierda, los enlaces del rol en el centro y, a la derecha, la campana de notificaciones (con contador de no leídas) y el botón de cerrar sesión. En móvil los enlaces pasan a un botón "Menú".

| Rol | Enlaces de la barra | Pantalla de inicio |
| --- | --- | --- |
| Estudiante | Ofertas · Mis postulaciones · Mi perfil | Ofertas |
| Profesional externo | Ofertas · Mis postulaciones · Mi perfil | Ofertas |
| Empresa | Ofertas · Postulantes · Mi empresa | Ofertas (panel empresarial) |
| Administrador | Estadísticas · Verificación · Convocatorias · Usuarios | Estadísticas |

El panel de notificaciones se despliega bajo la campana. Cada notificación tiene un punto de estado (leída o no leída), un título y un detalle.

## 5. Modelo de datos visible

### Oferta

- Título, empresa, tipo y modalidad (`Presencial`, `Remota`, `Híbrida`).
- Ciudad, descripción, requisitos, programa o carrera y habilidades.
- Remuneración (no aplica a formación), fecha de cierre, correo de contacto y estado.

| Tipos de oferta | Estados de una oferta |
| --- | --- |
| Práctica · Empleo · Formación (curso o programa) | Borrador · Publicada · Cerrada · Cancelada |

Estados de una postulación: Enviada · En revisión · Entrevista · Aceptada · Rechazada · Retirada.

- **Hoja de vida del candidato:** foto, datos de contacto, educación (título, institución, periodo), experiencia (cargo, empresa, periodo, descripción), habilidades agrupadas por categoría y CV en PDF.
- **Empresa:** nombre, NIT, sector, descripción, sitio web, logo y estado de verificación.

## 6. Pantallas

### 6.1 Autenticación (`auth`)

Pantalla dividida en dos mitades.

**Izquierda (marca):**

- Degradado de 145° de `#123b70` a `#155eef` y `#3978f4`, con dos círculos de luz difuminados.
- Logo de la Universidad de Ibagué y SIPU.
- Título grande: "Tu talento encuentra oportunidades reales."
- Texto introductorio.
- Imagen de Ardy.
- Nota de confianza con un check en círculo blanco.

**Derecha:** tarjeta translúcida con radio de 24 px y desenfoque de fondo. Tiene cuatro vistas:

1. **Iniciar sesión:** correo, contraseña con botón para mostrarla, botón "Iniciar sesión", enlace "¿Olvidaste tu contraseña?" y enlace "Crear cuenta".
2. **Crear cuenta:** selector de tipo de cuenta en tres tarjetas (Estudiante · Profesional · Empresa); nombre (o razón social), correo, contraseña y confirmar contraseña.
3. **Recuperar contraseña:** campo de correo y botón "Enviar enlace". La confirmación es genérica: "Si el correo existe, recibirás un enlace".
4. **Nueva contraseña** (se abre desde el enlace del correo): título "Crea una nueva contraseña", nueva contraseña, confirmar y "Guardar nueva contraseña".

**Estados:**

- Botón en carga.
- Aviso de servidor lento: "El servidor se está activando, puede tardar hasta un minuto".
- Errores de validación bajo cada campo.
- Mensaje "Tu sesión expiró. Inicia sesión nuevamente."

En móvil la mitad de marca se oculta y el logo queda encima de la tarjeta.

### 6.2 Estudiante: Ofertas (`student-dashboard`)

- Saludo "Hola, {nombre}" con resumen (ofertas nuevas, postulaciones activas).
- Bloque de **recomendadas para ti**, calculadas con las habilidades y el programa del estudiante.
- Buscador y filtros: tipo (Práctica · Empleo · Formación), modalidad y ciudad. Pestaña de ofertas guardadas.
- Tarjeta de oferta:
  - Logo de la empresa, título, empresa, ciudad y modalidad.
  - Etiqueta del tipo.
  - "Cierra en X días", en rojo si faltan pocos.
  - Botón para guardar (marcador) y enlace "Ver detalle →".
- Estado vacío con Ardy: "No encontramos ofertas".

### 6.3 Estudiante: Detalle de oferta (`offer-detail`)

- Cabecera con título, empresa (con insignia de verificada), tipo, modalidad, ciudad, remuneración y fecha de cierre.
- Secciones: Descripción, Requisitos y Habilidades (chips).
- Barra lateral fija con el botón "Postularme" ("Inscribirme" si es formación) y el botón de guardar.
- Modal "Confirma tu postulación" con el resumen del perfil y el aviso de que la empresa verá su hoja de vida.
- Estado de éxito "Postulación enviada" con el botón "Ver mi postulación".
- Si ya se postuló, mostrar el estado actual en lugar del botón.

### 6.4 Estudiante: Mis postulaciones (`student-applications`)

- Lista o tabla con la oferta, la empresa, la fecha y una etiqueta de color por estado.
- Línea de tiempo del proceso: Enviada, En revisión, Entrevista, Resultado.
- Acciones: abrir la oferta y "Retirar postulación" (con confirmación).
- Contadores por estado arriba.
- Estado vacío: "Sin postulaciones aún".

### 6.5 Estudiante: Mi perfil (`student-profile`)

- Cabecera con foto (subir o cambiar), nombre, programa, semestre, correo y teléfono, más un botón "Editar".
- Pestañas: **Educación** · **Experiencia** · **Habilidades**.
  - Educación y experiencia: lista editable con formularios en la misma página (sin ventanas emergentes), con "+ Agregar educación" y "+ Agregar experiencia" y las acciones editar, eliminar y reordenar.
  - Habilidades: grupos por categoría (por ejemplo Backend, Frontend, Blandas) con chips eliminables y un campo "Nueva habilidad en {categoría}".
- Tarjeta **Hoja de vida (PDF)**: zona para arrastrar o seleccionar el archivo, con el nombre, el tamaño, la fecha y las acciones Ver, Reemplazar y Eliminar. Límite de 5 MB.
- Banner de migración: "Encontramos datos guardados en este navegador" con el botón "Guardarlos en mi cuenta".
- Tarjeta **Cambiar contraseña**: actual, nueva y confirmar.

### 6.6 Profesional externo: Ofertas (`external-dashboard`)

Similar a 6.2, con estética más profesional: chips de filtro ("Filtrar:" Todas · Empleo · Formación · modalidad) y tarjetas con salario visible. Estado vacío: "Sin resultados".

### 6.7 Profesional externo: Detalle de oferta (`external-job-detail`)

- Secciones: Descripción del cargo, Requisitos, Beneficios y Sobre la empresa.
- Bloque final "¿Listo para aplicar?" con el botón "Aplicar" ("Inscribirme" en formación).
- Estado de éxito "¡Aplicación enviada!".

### 6.8 Profesional externo: Mis aplicaciones (`external-applications`)

Igual que 6.4. Estado vacío: "Sin aplicaciones aún".

### 6.9 Profesional externo: Mi perfil (`external-profile`)

Igual que 6.5, añadiendo:

- Titular profesional y años de experiencia.
- Enlace "Ver hoja de vida enlazada" (URL externa, por ejemplo LinkedIn).

### 6.10 Empresa: Panel y ofertas (`company-dashboard`)

- Indicadores: ofertas activas, postulantes totales, nuevos esta semana y estado de verificación.
- Tabla "Ofertas publicadas" con título, tipo, estado, postulantes y cierre. Acciones: Ver postulantes, Editar, Cerrar y Cancelar.
- Modal "¿Cancelar esta oferta?" de tipo destructivo.
- **Formulario Crear oferta** en tres bloques: Descripción, Requisitos y Condiciones.
  - Campos: "Tipo de oferta *" (Práctica · Empleo · Formación), título ("Nombre del curso o programa *" si es formación), descripción, programa o carrera, habilidades, modalidad, ciudad, remuneración (se oculta en formación), fecha de cierre y correo de contacto.
  - Botón "Revisar vista previa" que muestra la oferta como la verá el candidato, y luego "Publicar oferta".
  - Confirmación "Oferta publicada" con "Volver a mis ofertas".
- Estado vacío: "No tienes ofertas publicadas" con "Publicar primera oferta".
- Aviso si la empresa no está verificada.

### 6.11 Empresa: Postulantes (`company-applicants`)

- Selector de oferta (tarjetas o desplegable con el contador de postulantes).
- Lista de postulantes: foto, nombre, tipo (Estudiante o Profesional), fecha, estado y coincidencia de habilidades.
- Panel o página **"Perfil del candidato"** con:
  - Contacto, educación, experiencia y habilidades.
  - Botón "Descargar hoja de vida (PDF)".
  - Selector para cambiar el estado: En revisión · Entrevista · Aceptada · Rechazada.
- Las postulaciones retiradas aparecen atenuadas con la etiqueta "Retirada".
- Estado vacío con "Crear una oferta".

### 6.12 Empresa: Mi empresa (`company-profile`)

- Logo (subir o cambiar), nombre, NIT, sector, descripción, sitio web y contacto.
- Estado de verificación: Pendiente · Verificada · Rechazada.
- Tarjeta para cambiar la contraseña.

### 6.13 Administrador: Estadísticas de empleo (`employment-stats`)

- Indicadores: usuarios, ofertas activas, postulaciones y tasa de colocación.
- Gráficos:
  - Ofertas por tipo (incluye Formación).
  - Postulaciones por estado.
  - Evolución mensual.
  - Empresas con más ofertas (top 5).

### 6.14 Administrador: Verificación de organizaciones (`company-verification`)

- Tabla de empresas pendientes con nombre, NIT, sector, fecha y contacto.
- Acciones Verificar y Rechazar (rechazar pide un motivo).
- Pestañas Pendientes · Verificadas · Rechazadas.

### 6.15 Administrador: Convocatorias públicas (`convocatorias`)

- Lista de convocatorias con título, fechas de apertura y cierre, estado y número de ofertas asignadas.
- Crear y editar una convocatoria.
- Asignar ofertas existentes a una convocatoria y quitarlas.

### 6.16 Administrador: Usuarios (`admin-users`)

- Título "Usuarios", buscador ("Buscar") y filtros por rol y estado.
- Tabla con nombre, correo, tipo de perfil, roles (chips), activo/inactivo y fecha.
- Acciones: asignar o quitar los roles ADMINISTRADOR y FUNCIONARIO_PUBLICO, y activar o desactivar.
- Advertencia: no se puede quitar el último administrador.

### 6.17 Pantalla de error

Tarjeta centrada con Ardy, el mensaje "Algo salió mal" y el botón "Volver al inicio".

## 7. Flujos a conectar

1. **Registro e ingreso:** crear cuenta, elegir el tipo y llegar a la pantalla de inicio del rol.
2. **Recuperar contraseña:** "¿Olvidaste tu contraseña?", el correo con el enlace, nueva contraseña e iniciar sesión.
3. **Postulación:** buscar, ver el detalle, postularse, ver la postulación y seguir su estado.
4. **Hoja de vida:** completar educación, experiencia y habilidades, y subir el CV y la foto.
5. **Empresa:** crear la oferta, ver la vista previa, publicarla, revisar postulantes, ver el perfil, descargar el CV y cambiar el estado.
6. **Administrador:** verificar una empresa y asignar ofertas a una convocatoria.

## 8. Correo de recuperación

Diseña también el correo HTML con estos elementos:

- Logo de SIPU.
- "Hola, {nombre}".
- El texto "Recibimos una solicitud para restablecer tu contraseña".
- El botón primario "Crear nueva contraseña".
- La nota "El enlace vence en 60 minutos. Si no lo pediste, ignora este correo."

## 9. Requisitos

- **Accesibilidad:** cumplir WCAG 2.1 AA, con contraste mínimo de 4.5:1.
- **Interacción:**
  - Áreas táctiles de al menos 44 px.
  - Foco visible.
  - Los estados no deben depender solo del color: incluyen texto o icono.
- **Diseño adaptable:**
  - Una sola columna en móvil.
  - Las tablas se convierten en tarjetas apiladas.
  - Los filtros pasan a un panel desplegable.
- **Implementación:** el diseño se implementará con React 18 y Tailwind CSS 4. Conviene que los componentes sean reutilizables:
  - botón, campo, selector, chip, etiqueta de estado y tarjeta de oferta;
  - tarjeta de archivo, modal, tabla, pestañas, estado vacío y barra de navegación.
