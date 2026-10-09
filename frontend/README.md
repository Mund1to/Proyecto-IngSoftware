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
| `npm run build` | Verifica TypeScript y genera la compilación de producción. |
| `npm run preview` | Sirve localmente la compilación generada. |
| `npm test` | Ejecuta las pruebas con Vitest y Testing Library. |
| `npm run typecheck` | Verifica los tipos con TypeScript. |

## Roles en la interfaz

| Rol | Se asigna cuando | Menú |
| --- | --- | --- |
| Estudiante | Perfil `ESTUDIANTE` | Ofertas, Mis postulaciones, Mi perfil |
| Empresa | Perfil `ORGANIZACION` | Ofertas, Postulantes, Mi empresa |
| Profesional | Perfil `CANDIDATO_EXTERNO` | Ofertas, Mis postulaciones, Mi perfil |
| Administración | Rol `ADMINISTRADOR` o `FUNCIONARIO_PUBLICO` | Estadísticas, Verificación, Convocatorias, Usuarios |

## Estructura relevante

```text
src/
├── components/  # Componentes reutilizables (NavBar, ChangePasswordCard, UniversityLogo, ArdyMark)
├── screens/     # Pantallas por rol (auth, estudiante, empresa, externo)
├── lib/         # Cliente de API (api.ts), sesión (session.tsx) y helpers (offers.ts, useStoredList.ts)
├── imports/     # Recursos gráficos
├── App.tsx      # Sesión, navegación por rol y ErrorBoundary
├── index.css    # Sistema de estilos global
└── main.tsx     # Punto de entrada de React
```
