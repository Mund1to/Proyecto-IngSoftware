# Backend de SIPU

API HTTP de SIPU, construida con Node.js y Express.

En la Fase 0 el backend expone el endpoint de salud. Las rutas de autenticación, usuarios, ofertas y postulaciones se implementarán progresivamente durante la Fase 1.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL 15 o superior para ejecutar la base de datos local.

## Configuración

Desde la carpeta `backend`, copie las variables de ejemplo a un archivo local `.env` y ajuste sus valores:

```bash
copy ..\\.env.example .env
```

En PowerShell también puede utilizar:

```powershell
Copy-Item ..\\.env.example .env
```

Variables disponibles:

| Variable | Descripción | Valor de ejemplo |
| --- | --- | --- |
| `PORT` | Puerto HTTP de la API | `3000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://usuario:contraseña@localhost:5432/sipu` |

El archivo `.env` no se versiona.

## Ejecutar en desarrollo

```bash
cd backend
npm install
npm run dev
```

El servidor quedará disponible en `http://localhost:3000`.

## Ejecutar en modo normal

```bash
cd backend
npm start
```

## Verificar el servicio

Con el backend ejecutándose, abra `http://localhost:3000/api/health` o ejecute:

```bash
curl http://localhost:3000/api/health
```

La respuesta esperada es:

```json
{"service":"sipu-backend","status":"ok"}
```

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Express con reinicio automático mediante `node --watch`. |
| `npm start` | Inicia Express sin modo de vigilancia. |

## Estructura relevante

```text
src/
├── controllers/  # Lógica de los endpoints
├── routes/       # Definición de rutas HTTP
├── middleware/   # Autenticación y roles
├── utils/        # Helpers compartidos (payload, perfiles)
└── server.js     # Configuración de Express

database/
├── schema.sql    # Esquema PostgreSQL inicial
└── migrations/   # Migraciones aditivas (detalles de oferta, verificación)
```
