# Despliegue de SIPU en Render y Vercel

El repositorio contiene el frontend, la API y el esquema PostgreSQL, pero GitHub no ejecuta esos servicios. El despliegue usa PostgreSQL y la API en Render, y Vite en Vercel. Los proveedores necesitan sus propias variables de entorno; no se deben subir credenciales al repositorio.

## 1. Crear PostgreSQL en Render

1. En Render, crea una base de datos PostgreSQL y selecciona el plan adecuado para el uso esperado. Revisa el costo, límites y retención del plan antes de crearla.
2. Guarda la `Internal Database URL` para configurarla en el servicio backend. Mantén la base y el backend en la misma región.

## 2. Desplegar la API en Render

1. Crea un `Web Service` conectado al repositorio `Mund1to/Proyecto-IngSoftware` y selecciona la rama que se va a publicar.
2. Configura `Root Directory` como `backend`, `Build Command` como `npm install` y `Start Command` como `npm start`.
3. Agrega estas variables en la configuración del servicio:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `Internal Database URL` de la base de Render |
| `JWT_SECRET` | Secreto aleatorio y privado, generado para producción |
| `JWT_EXPIRES_IN` | `7d` |

Render proporciona `PORT` automáticamente. Al iniciar, la API crea el esquema si la base está vacía y agrega las columnas faltantes de ofertas si ya existe.

Después del despliegue, comprueba `https://<api-render>/api/health` y `https://<api-render>/api/db-check`. Ambos deben responder correctamente antes de configurar el frontend.

## 3. Desplegar el frontend en Vercel

1. Importa el mismo repositorio en Vercel y selecciona la rama que se va a publicar.
2. Configura `Root Directory` como `frontend`, `Build Command` como `npm run build` y `Output Directory` como `dist`.
3. Define `VITE_API_URL` como `https://<api-render>/api` en las variables de entorno de producción.
4. Despliega o vuelve a desplegar el frontend para que Vite incorpore la URL de la API en la compilación.

La URL debe apuntar al servicio backend de Render, no a PostgreSQL. No pongas contraseñas ni tokens en variables `VITE_*`, porque su contenido es público en el navegador.

## 4. Verificación

1. Abre la URL de Vercel y comprueba el catálogo de ofertas y el inicio de sesión.
2. En las herramientas de red del navegador, confirma que las solicitudes van a `https://<api-render>/api` y no a `localhost`.
3. Prueba registro, autenticación, consulta y gestión de ofertas con cuentas apropiadas.
4. Si el frontend no puede contactar la API, revisa `VITE_API_URL` y vuelve a desplegar Vercel. Si `/api/db-check` falla, revisa `DATABASE_URL` y que ambos servicios estén en la misma región.

## Seguridad y mantenimiento

- Configura los secretos directamente en Render y Vercel; no los agregues a commits, issues ni archivos `.env` versionados.
- Usa la URL interna de PostgreSQL solo desde Render. No la configures en el frontend.
- La rama `feature/fase-3-bolsa-empleo` puede usarse para validar el despliegue; para producción, publica desde `develop` o `main` después de revisar y fusionar el Pull Request.
- Los planes gratuitos pueden tener límites o expiración. Verifica las condiciones vigentes de cada proveedor antes de depender de ellos.