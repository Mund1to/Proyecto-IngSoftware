# Informe: revisión de redundancias y estructura escalable

**Fecha:** 19 de octubre de 2026
**Rama:** `refactor/estructura-escalable`, creada desde `main` (`a1ac4f0`)

## 1. Objetivo

1. Revisar todos los archivos del repositorio y quitar lo redundante.
2. Dejar el proyecto preparado para cambios futuros: nuevas funcionalidades, cambios de tecnología y tecnologías nuevas.

La reorganización del backend ya se había hecho en la Fase 7. Este trabajo aplica lo mismo al frontend, unifica lo que estaba duplicado entre los dos lados y agrega pruebas que mantienen las reglas.

La guía permanente de la estructura quedó en [`arquitectura.md`](arquitectura.md).

## 2. Diagnóstico

| Hallazgo | Problema |
| --- | --- |
| `frontend/src/styles.css`, `imports/image.png`, `imports/image-1.png`, `imports/ardy.png`, `backend/.gitkeep`, `frontend/.gitkeep` | Sin uso en la app. Las imágenes eran el arte original del brief de diseño. |
| `frontend/src/App.tsx` (530 líneas) | Mezclaba tipos de dominio, convertidores, estado, acciones, un `switch` de 16 pantallas con `props: any` y el `ErrorBoundary`. Veinte archivos importaban tipos desde `App`. |
| `frontend/src/lib/api.ts` (430 líneas) | Un solo objeto `api` con los ocho dominios y todos sus tipos. |
| `toUiOffer` y `mapOfferToJob` | Estaban definidos dentro de `StudentDashboard` y `ExternalDashboard`, así que otras pantallas importaban esas pantallas solo para usarlos. |
| `JobApplication`, `toJobApplications`, `state.jobApplications`, `applyToJob` | Duplicaban `Application`, `applications` y `applyToOffer` con otros nombres de campo. La app guardaba dos copias de la misma lista. |
| `lib/offers.ts` | Mezclaba formato genérico (fechas, salario) con el dominio de ofertas y los estados de postulación. |
| Regla de contraseña | Tres copias en el frontend y dos listas de requisitos iguales. El backend solo exigía mayúscula y número cuando el administrador asignaba la contraseña: el registro, la recuperación y el cambio desde el perfil aceptaban `clave1234`, aunque la interfaz la rechazaba. |
| Constantes repetidas entre frontend y backend | Tipos de oferta, tipos que ve el externo, estados de postulación, tipos de documento y motivo mínimo de rechazo. Nada avisaba si un lado cambiaba y el otro no. |
| "Capa de compatibilidad" en `index.css` | Seis reglas con `!important` que reescribían colores fijos de la pantalla de carga y del `ErrorBoundary`. |
| `index.css` (862 líneas) | Todos los estilos en un solo archivo. |
| `.env.example` en la raíz | Documentaba la API, pero dotenv lee `backend/.env`. |
| Finales de línea | El índice guardaba LF, pero la copia de trabajo en Windows quedaba con CRLF, y las ediciones mezclaban ambos. |

**Se conservan a propósito:**

- `Proyecto-Archivos/`, que es material entregado.
- La copia histórica del backlog dentro de esa carpeta.
- Las pantallas que difieren por rol (ver la sección 6).

## 3. Cambios

### 3.1. Frontend organizado por funcionalidades

```text
src/
├── app/        # App, routes (tabla de pantallas), types, session, NavBar, ErrorBoundary
├── features/   # auth, offers, applications, profile, verifications, convocatorias, stats, admin
├── shared/     # api/client.ts, api/account.ts, ui/, lib/, assets/
├── styles/     # un archivo por sección
└── test/       # pantallas, utilidades, arquitectura y contrato
```

- **Nombres alineados con el backend:** las funcionalidades llevan el mismo nombre que los módulos del backend.
- **API por funcionalidad:** cada una declara sus llamadas en `<x>.api.ts` (`offersApi`, `applicationsApi`...) y su modelo en `<x>.model.ts`.
- **`shared/api/client.ts`** se queda solo con el cliente HTTP. Allí se cambiaría `fetch` por otra librería.
- **Tabla de pantallas:** `app/routes.tsx` reemplaza el `switch`, con props tipadas (`ScreenProps`). Para agregar una pantalla basta registrarla allí; esa tabla también es el punto de partida si más adelante se adopta `react-router`.
- **`App.tsx`** baja de 530 a 275 líneas.
- **Una sola lista de postulaciones:** se eliminan `JobApplication`, `toJobApplications`, `state.jobApplications` y `applyToJob`.
- **`tsconfig.json`** activa `noUnusedLocals` y `noUnusedParameters`.

### 3.2. Reglas comprobadas por pruebas

- **`test/architecture.test.ts`:**
  - `shared/` no importa de `app/` ni de `features/`;
  - una funcionalidad no importa las pantallas de otra.
  - Se comprobó que la prueba falla al introducir una violación a propósito.
- **`test/contracts.test.ts`:** importa los módulos puros del backend y comprueba que coincidan los tipos de oferta, los tipos que ve el externo, las modalidades, los estados de postulación, los tipos de documento, el motivo mínimo de rechazo y la regla de contraseña.

### 3.3. Backend

- **`core/security/password.js`:** una sola regla de contraseña para registro, recuperación, cambio desde el perfil y administración. Es el único cambio de comportamiento de este trabajo: la API ahora rechaza lo que los formularios ya rechazaban.
- **`applications/applications.domain.js`:** los estados de postulación salen del servicio, como ya se hacía en `offers.domain.js`.

### 3.4. Estilos y configuración

- **CSS:**
  - se elimina la capa de compatibilidad, y las dos vistas afectadas usan los tokens directamente;
  - `index.css` se divide en once archivos por sección, en el mismo orden, y el CSS compilado resulta idéntico byte a byte.
- **Archivos sin uso:** se borran, y el arte original pasa a `docs/diseno/recursos/`.
- **Configuración de git:**
  - `.gitignore` en la raíz, que deja fuera `.vscode/`;
  - `.gitattributes` con `eol=lf`;
  - `.env.example` pasa a `backend/`.

## 4. Commits

| Commit | Contenido |
| --- | --- |
| `1d863f3` | Archivos sin uso fuera; recursos de diseño a `docs/diseno/recursos/`. |
| `8e5bc7c` | Frontend en `app/`, `shared/` y `features/` (solo movimientos). |
| `40e1933` | API dividida por funcionalidad. |
| `c30eed3` | `App` dividido en tipos, sesión, rutas y modelos; prueba de arquitectura. |
| `877574f` | Una sola lista de postulaciones y un solo `applyToOffer`. |
| `6433b4e` | `.gitattributes` con LF. |
| `7fadf1c` | Backend: una sola regla de contraseña; estados de postulación en su dominio. |
| `36c7936` | Prueba de contrato y regla de contraseña compartida en el frontend. |
| `b1c9519` | Fuera la capa de compatibilidad del CSS. |
| `7992f9e` | Estilos divididos por sección. |
| `208a3ad` | `.env.example` en `backend/`. |
| `0097e3c` | Props de las pantallas tipadas con `ScreenProps`. |

## 5. Verificación

| Comprobación | Antes | Después |
| --- | --- | --- |
| Pruebas del backend (`npm test`) | 123 | 124 |
| Pruebas del frontend (`npm test`) | 54 | 62 |
| `npm run typecheck` (ahora con `noUnusedLocals` y `noUnusedParameters`) | Sin errores | Sin errores |
| `npm run build` | Correcto | Correcto; el CSS compilado es idéntico antes y después de dividirlo |
| Prueba integral con navegador entre los cinco roles (Playwright, Edge) | — | 27 de 27, sin errores de consola ni de red |

Detalles de la verificación:

- Las pruebas pasaron después de cada commit.
- El script de la prueba integral se actualizó al flujo de la Fase 7: el menú "Verificación" ahora se llama "Solicitudes", la aprobación se confirma en una ventana, y el botón anuncia "Solicitudes, N pendientes" cuando hay pendientes.

## 6. Pendientes y sugerencias

1. **Unificar las pantallas por rol.** `StudentDashboard`/`ExternalDashboard`, `OfferDetail`/`ExternalJobDetail`, `StudentApplications`/`ExternalApplications` y `StudentProfile`/`ExternalProfile` comparten la mitad de su lógica, pero siguen diseños y textos distintos. Unificarlas en pantallas configurables cambia lo que ve el usuario y conviene decidirlo con diseño.
2. **`react-router`.** La tabla `SCREENS` ya está lista. Faltan tres cosas:
   - un `vercel.json` con *rewrites*;
   - cargar por id las pantallas de detalle, que hoy reciben la oferta por estado;
   - mantener el enlace `/?reset=` de recuperación.
3. **Llevar la prueba integral al repositorio** (`e2e/` con Playwright) y a CI, con un navegador instalado en el runner.
4. **Centralizar la regla "qué perfil representa al candidato".** Hoy está repetida en tres consultas SQL.
5. **Las sugerencias del informe de la Fase 7 siguen vigentes:** almacenamiento de objetos, antivirus, NIT, vigencia, privacidad, Redis, ESLint, OpenAPI y paginación de usuarios. La tabla de la sección 6 de [`arquitectura.md`](arquitectura.md) indica qué archivos toca cada una.
