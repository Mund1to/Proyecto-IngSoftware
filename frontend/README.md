# Frontend de SIPU

Aplicación web de SIPU, construida con React, Vite, TypeScript y Tailwind CSS.

La aplicación consume la API para autenticación, perfiles, ofertas y postulaciones.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

## Configuración

Desde la raíz del repositorio, cree `frontend/.env` para configurar la URL de la API en desarrollo:

```text
VITE_API_URL=http://localhost:3000/api
```

En producción, configure `VITE_API_URL` en Vercel con la URL pública de la API, incluyendo `/api`. Si falta, el build de producción usa `https://proyecto-ingsoftware.onrender.com/api` y nunca `localhost`. Las variables `VITE_*` quedan incorporadas en la compilación y no deben contener secretos.

## Ejecutar en desarrollo

```bash
cd frontend
npm install
npm run dev
```

Vite mostrará la dirección local en la terminal, normalmente `http://localhost:5173`.

## Generar una compilación de producción

```bash
cd frontend
npm run build
```

Los archivos generados se guardan en `frontend/dist/`.

## Vista previa de producción

Después de ejecutar la compilación:

```bash
cd frontend
npm run preview
```

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo de Vite. |
| `npm run build` | Genera la compilación de producción (los tipos se verifican con `npm run typecheck`). |
| `npm run preview` | Sirve localmente la compilación generada. |
| `npm test` | Ejecuta las 62 pruebas con Vitest y Testing Library, incluidas las de arquitectura y contrato con el backend. |
| `npm run typecheck` | Verifica los tipos con TypeScript. |

## Roles en la interfaz

| Rol | Se asigna cuando | Menú |
| --- | --- | --- |
| Estudiante | Perfil `ESTUDIANTE` | Ofertas, Mis postulaciones, Mi perfil |
| Empresa | Perfil `ORGANIZACION` | Ofertas, Postulantes, Mi empresa |
| Profesional | Perfil `CANDIDATO_EXTERNO` | Ofertas, Mis postulaciones, Mi perfil |
| Administración | Rol `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO` | Estadísticas, Solicitudes (con el número de pendientes), Convocatorias, Usuarios |

La empresa solicita la verificación desde **Mi empresa** (`OrganizationVerificationPanel`): adjunta sus documentos y envía la solicitud. El revisor la atiende en **Solicitudes** (`CompanyVerification`), con las pestañas Pendientes, Historial y Organizaciones.

## Estructura relevante

El código se organiza por funcionalidad, con los mismos nombres que los módulos del backend. La guía completa, con las reglas y cómo cambiar de tecnología, está en [`docs/arquitectura.md`](../docs/arquitectura.md).

```text
src/
├── app/                 # Armazón de la aplicación
│   ├── App.tsx          # Estado global y acciones (sesión, postulaciones, perfiles)
│   ├── routes.tsx       # Tabla de pantallas: Screen -> componente
│   ├── types.ts         # Screen, Role, AppState, Navigate, ScreenProps, HOME_SCREEN
│   ├── session.tsx      # UserSession, contexto de sesión, resolveRole
│   ├── NavBar.tsx       # Menú por rol y notificaciones
│   └── ErrorBoundary.tsx
├── features/            # Una carpeta por funcionalidad
│   ├── auth/            # AuthScreen, auth.api.ts
│   ├── offers/          # Catálogos, detalle, panel de la empresa, offers.api.ts, offers.model.ts
│   ├── applications/    # Postulaciones y postulantes, applications.api.ts, applications.model.ts
│   ├── profile/         # Perfiles, hoja de vida, archivos, cambio de contraseña, profile.api.ts
│   ├── verifications/   # Solicitudes, panel de la empresa, verifications.api.ts
│   ├── convocatorias/   # Convocatorias, convocatorias.api.ts
│   ├── stats/           # Estadísticas, stats.api.ts
│   └── admin/           # Usuarios, admin.api.ts
├── shared/              # Reutilizable; no importa de app/ ni de features/
│   ├── api/             # client.ts (request, ApiError, archivos protegidos) y account.ts
│   ├── ui/              # Componentes visuales (iconos, filtros, Ardy, logo, requisitos de contraseña)
│   ├── lib/             # Formato, contraseñas y almacenamiento local
│   └── assets/          # Imágenes
├── styles/              # Un archivo por sección; index.css los importa en orden
├── test/                # Pruebas de pantallas, utilidades, arquitectura y contrato con el backend
└── main.tsx             # Punto de entrada de React
```

Reglas:

- **Pantalla nueva:**
  1. Créala en su funcionalidad.
  2. Agrega su nombre a `Screen`, en `app/types.ts`.
  3. Regístrala en `SCREENS`, en `app/routes.tsx`.
- **Llamadas a la API:** cada funcionalidad declara las suyas en `<x>.api.ts` con `request` de `shared/api/client.ts`. Las pantallas no llaman a `fetch` directamente.
- **Imports entre funcionalidades:** una funcionalidad puede usar la API, el modelo o un componente de otra, pero no sus pantallas. `test/architecture.test.ts` lo comprueba.
- **Constantes compartidas con el backend:** los tipos de oferta, los estados, los documentos y la regla de contraseña deben coincidir con el backend. `test/contracts.test.ts` lo comprueba.
