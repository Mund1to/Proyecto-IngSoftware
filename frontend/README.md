# Frontend de SIPU

Aplicación web de SIPU, construida con React, Vite, TypeScript y Tailwind CSS.

> El flujo visual disponible actualmente es un prototipo de interfaz. La autenticación, la persistencia de datos y la comunicación con la API se implementarán durante la Fase 1.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

## Configuración

Desde la raíz del repositorio, cree el archivo de variables locales si necesita configurar la URL de la API en el futuro:

```text
frontend/.env
```

Las variables que comiencen con `VITE_` son accesibles desde la aplicación. Por ejemplo:

```env
VITE_API_URL=http://localhost:3000/api
```

El archivo `.env` no se versiona.

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
├── components/  # Componentes reutilizables
├── screens/     # Pantallas del prototipo
├── imports/     # Recursos gráficos
├── App.tsx      # Componente principal y navegación temporal
├── index.css    # Sistema de estilos global
└── main.tsx     # Punto de entrada de React
```
