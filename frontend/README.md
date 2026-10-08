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

En producción, configure `VITE_API_URL` en Vercel con la URL pública de la API, incluyendo `/api`. Las variables `VITE_*` quedan incorporadas en la compilación y no deben contener secretos.

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

## Estructura relevante

```text
src/
├── components/  # Componentes reutilizables (NavBar, UniversityLogo, ArdyMark)
├── screens/     # Pantallas por rol (auth, estudiante, empresa, externo)
├── lib/         # Cliente de API (api.ts) y helpers (offers.ts, useStoredList.ts)
├── imports/     # Recursos gráficos
├── App.tsx      # Componente principal y navegación
├── index.css    # Sistema de estilos global
└── main.tsx     # Punto de entrada de React
```
