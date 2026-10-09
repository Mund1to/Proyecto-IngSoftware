# SIPU

SIPU (Sistema de Intermediación de Prácticas Universitarias) es una plataforma de intermediación laboral que inicia enfocada en prácticas estudiantiles y evolucionará hacia una bolsa de empleo general y, posteriormente, una agencia pública de empleo.

## Estado del proyecto

La **Fase 0 — Base técnica** está preparada: el monorepo incluye un frontend React/Vite, una API Express, documentación de ejecución local y un esquema inicial de PostgreSQL. La **Fase 1** queda cerrada y verificada con autenticación real, gestión de ofertas y flujo de postulaciones para estudiantes y empresas. La **Fase 2** se inicia con la preparación del perfil de candidato externo y la conexión de sus datos al backend. La **Fase 3** queda completa con la bolsa de empleo general: ofertas de empleo, verificación de organizaciones y recomendación de ofertas según perfil. La **Fase 4** añade convocatorias públicas y estadísticas de empleo. La **Fase 5 — Calidad** corrige el fallo de carga tras iniciar sesión en Vercel, da función a los botones pendientes, endurece la seguridad de la API y añade pruebas automatizadas. La **Fase 6** guarda la hoja de vida en la base de datos, permite subir CV y foto, recuperar la contraseña por correo y publicar ofertas de formación (94 pruebas en el backend y 26 en el frontend).

## Verificación de cierre de la Fase 1

Se validaron en la API desplegada los flujos principales del MVP:

- registro de empresa y publicación de una oferta;
- registro de estudiante y envío de postulación a una oferta;
- consulta de postulaciones desde el perfil del estudiante;
- consulta de postulaciones recibidas desde el perfil de la empresa.

La verificación real devolvió respuestas `ok: true` y confirmación de creación de usuarios, ofertas y aplicaciones en PostgreSQL.

## Estructura

```text
.
├── frontend/             # Aplicación React + Vite + Tailwind
├── backend/              # API Express y esquema PostgreSQL
├── docs/                 # Documentación técnica y de producto vigente
├── Proyecto-Archivos/    # Materiales y entregables de referencia
└── .env.example          # Variables de entorno de ejemplo para la API
```

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL 15 o superior para crear la base de datos local.

## Inicio rápido

Abra dos terminales desde la raíz del repositorio.

### API

```bash
cd backend
copy ..\\.env.example .env
npm install
npm run dev
```

La verificación de salud queda disponible en `http://localhost:3000/api/health`.

### Aplicación web

```bash
cd frontend
npm install
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

### Pruebas

```bash
cd backend
npm test        # API contra una base PostgreSQL aislada <base>_test

cd ../frontend
npm test        # Vitest + Testing Library
```

Las pruebas del backend crean y borran una base cuyo nombre termina en `_test`; nunca tocan la base de desarrollo.

### Primer administrador

El registro público solo otorga el rol `USUARIO`. Para crear el primer administrador, registre la cuenta desde la aplicación y ejecute:

```bash
cd backend
npm run grant-role -- correo@dominio.com ADMINISTRADOR
```

Después, el administrador gestiona los roles desde la pantalla **Usuarios**.

### Base de datos

1. Cree una base de datos PostgreSQL llamada `sipu`.
2. Ajuste `DATABASE_URL` en `backend/.env`.
3. La API crea el esquema y aplica las migraciones al arrancar. Para hacerlo a mano:

   ```bash
   psql -U postgres -d sipu -f backend/database/schema.sql
   ```

Consulte [`docs/database-schema.md`](docs/database-schema.md) para el modelo y las decisiones de diseño.

## Documentación

- [`frontend/README.md`](frontend/README.md): comandos y estructura del cliente web.
- [`backend/README.md`](backend/README.md): ejecución de la API y endpoint de salud.
- [`docs/historial-desarrollo.md`](docs/historial-desarrollo.md): guía paso a paso de lo realizado y cómo continuar.
- [`docs/informe-actualizacion-roles-ofertas.md`](docs/informe-actualizacion-roles-ofertas.md): cambios de roles, ofertas, permisos, validaciones y actualización de base de datos.
- [`docs/informe-cierre-fase-3.md`](docs/informe-cierre-fase-3.md): cierre de la Fase 3 con verificación de organizaciones y recomendación de ofertas.
- [`docs/informe-cierre-fase-4.md`](docs/informe-cierre-fase-4.md): cierre de la Fase 4 con convocatorias públicas y estadísticas de empleo.
- [`docs/informe-fase-5-calidad.md`](docs/informe-fase-5-calidad.md): auditoría de calidad, corrección del login en Vercel y pruebas automatizadas.
- [`docs/informe-fase-6-perfil-archivos.md`](docs/informe-fase-6-perfil-archivos.md): hoja de vida, archivos, recuperación de contraseña y formación.
- [`docs/despliegue-render-vercel.md`](docs/despliegue-render-vercel.md): despliegue de PostgreSQL y API en Render, y frontend en Vercel.
- [`docs/backlog-fases.md`](docs/backlog-fases.md): fases, historias de usuario y prioridades.
- [`docs/database-schema.md`](docs/database-schema.md): modelo PostgreSQL inicial.

## Alcance por fases

- **Fase 0:** base técnica del monorepo, frontend, backend y PostgreSQL.
- **Fase 1:** MVP de prácticas para estudiantes y empresas.
- **Fase 2:** registro y postulación de candidatos externos.
- **Fase 3:** bolsa de empleo general y verificación de empleadores.
- **Fase 4:** convocatorias y estadísticas de empleo público.
- **Fase 5:** calidad, seguridad y pruebas automatizadas.
- **Fase 6:** hoja de vida en base de datos, archivos, recuperación de contraseña y formación.

## Modelo de usuarios

El sistema separa usuarios, perfiles y roles. Los perfiles iniciales son estudiante, candidato externo y empresa u organización. También existen permisos administrativos y, en fases posteriores, permisos para funcionarios públicos.

## Gestión del trabajo

Las issues del desarrollo se gestionan en GitHub:

- https://github.com/Mund1to/Proyecto-IngSoftware/issues
