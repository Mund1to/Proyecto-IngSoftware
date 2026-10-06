# SIPU

SIPU (Sistema de Intermediación de Prácticas Universitarias) es una plataforma de intermediación laboral que inicia enfocada en prácticas estudiantiles y evolucionará hacia una bolsa de empleo general y, posteriormente, una agencia pública de empleo.

## Estado del proyecto

La **Fase 0 — Base técnica** está preparada: el monorepo incluye un frontend React/Vite, una API Express, documentación de ejecución local y un esquema inicial de PostgreSQL. La autenticación y las funciones de negocio se desarrollarán en la Fase 1.

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

### Base de datos

1. Cree una base de datos PostgreSQL llamada `sipu`.
2. Ajuste `DATABASE_URL` en `backend/.env`.
3. Ejecute el esquema:

   ```bash
   psql -U postgres -d sipu -f backend/database/schema.sql
   ```

Consulte [`docs/database-schema.md`](docs/database-schema.md) para el modelo y las decisiones de diseño.

## Documentación

- [`frontend/README.md`](frontend/README.md): comandos y estructura del cliente web.
- [`backend/README.md`](backend/README.md): ejecución de la API y endpoint de salud.
- [`docs/historial-desarrollo.md`](docs/historial-desarrollo.md): guía paso a paso de lo realizado y cómo continuar.
- [`docs/backlog-fases.md`](docs/backlog-fases.md): fases, historias de usuario y prioridades.
- [`docs/database-schema.md`](docs/database-schema.md): modelo PostgreSQL inicial.

## Alcance por fases

- **Fase 0:** base técnica del monorepo, frontend, backend y PostgreSQL.
- **Fase 1:** MVP de prácticas para estudiantes y empresas.
- **Fase 2:** registro y postulación de candidatos externos.
- **Fase 3:** bolsa de empleo general y verificación de empleadores.
- **Fase 4:** convocatorias y estadísticas de empleo público.

## Modelo de usuarios

El sistema separa usuarios, perfiles y roles. Los perfiles iniciales son estudiante, candidato externo y empresa u organización. También existen permisos administrativos y, en fases posteriores, permisos para funcionarios públicos.

## Gestión del trabajo

Las issues del desarrollo se gestionan en GitHub:

- https://github.com/Mund1to/Proyecto-IngSoftware/issues
