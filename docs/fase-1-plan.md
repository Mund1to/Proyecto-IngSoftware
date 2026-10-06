# Plan de la Fase 1 — MVP de prácticas

## Objetivo

Implementar la base funcional del sistema para estudiantes y empresas: registro, autenticación, gestión de ofertas y postulaciones.

## Alcance mínimo

### Módulo de autenticación

- Registro de estudiante.
- Registro de empresa.
- Inicio de sesión.
- JWT con middleware de autenticación.
- Validación de roles y permisos.

### Módulo de ofertas

- Crear oferta de práctica.
- Listar ofertas públicas.
- Detallar oferta.
- Actualizar y eliminar ofertas si el usuario es propietario.

### Módulo de postulaciones

- Crear postulación desde un estudiante.
- Ver postulaciones del estudiante.
- Ver postulaciones recibidas por una empresa.
- Cambiar estado de una postulación.

## Orden recomendado

1. Configurar PostgreSQL y `DATABASE_URL`.
2. Conectar la API con `pg`.
3. Implementar registro e inicio de sesión.
4. Añadir JWT y middleware.
5. Crear ofertas de práctica.
6. Gestionar postulaciones.
7. Integrar frontend con la API.
8. Verificar flujos completos.

## Requisitos técnicos

- PostgreSQL 15 o superior.
- Node.js 20+.
- Dependencias añadidas: `pg`, `dotenv`.
- Secret JWT en `.env`.

## Variables de entorno necesarias

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sipu
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
```

## Conexión a PostgreSQL

La base de datos se conecta en `backend/src/config/database.js` desde `DATABASE_URL`. El backend intentará comprobar la conexión al arrancar, pero no fallará si la DB no está todavía disponible, con el fin de permitir un arranque más cómodo durante la fase inicial.

## Siguientes pasos reales

- crear una base de datos local `sipu`;
- ejecutar `backend/database/schema.sql`;
- probar la conexión con `/api/db-check`;
- implementar autenticación real usando `bcrypt` y `jsonwebtoken`;
- crear endpoints de registro y login;
- crear el resto del CRUD de ofertas y postulaciones.
