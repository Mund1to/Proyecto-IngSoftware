# Informe de actualización: roles y ofertas

**Fecha:** 8 de octubre de 2026  
**Rama:** `feature/fase-3-bolsa-empleo`

## Objetivo

Unificar el catálogo de ofertas para estudiantes y candidatos externos, asegurar que cada organización gestione únicamente sus publicaciones y hacer persistentes los datos solicitados al publicar o editar.

## Comportamiento por rol

| Rol | Puede consultar | Puede realizar |
|---|---|---|
| Estudiante | Ofertas publicadas | Postularse a ofertas vigentes, consultar sus postulaciones y editar su perfil |
| Candidato externo | El mismo catálogo público | Postularse a ofertas vigentes, consultar sus postulaciones y editar su perfil |
| Organización | Sus propias publicaciones y sus postulantes | Crear, editar y cancelar sus ofertas; revisar y actualizar el estado de postulaciones recibidas |

Las rutas de escritura requieren autenticación. El backend comprueba que la oferta pertenece a la organización autenticada. Cancelar cambia el estado a `CANCELADA`; no borra la oferta ni las postulaciones asociadas. Los candidatos consultan ofertas publicadas y no pueden enviar postulaciones después de la fecha límite.

Los catálogos de estudiantes y candidatos externos consultan el mismo endpoint público y se actualizan cada 30 segundos. Un cambio puede tardar hasta ese intervalo en aparecer en una pantalla que ya está abierta.

## Datos y presentación

Las ofertas persisten área, requisitos, duración, horario y correo de contacto, además de los campos previos. La interfaz muestra el nombre real de la organización y solo muestra la insignia de verificación cuando la API confirma `verificada: true`. Se retiraron beneficios, salarios, experiencia y descripciones empresariales ficticias de las vistas conectadas al API.

## Actualizar una base existente

La migración es aditiva y no reinicializa ni elimina datos. Desde la raíz del repositorio, con PostgreSQL disponible:

```powershell
psql -U postgres -d sipu -f backend/database/migrations/20261008_offer_details.sql
```

Si se crea una base nueva, ejecutar `backend/database/schema.sql` como indica el README. Después de actualizar el código, instalar dependencias e iniciar API y frontend:

```powershell
cd backend
npm install
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

## Verificaciones realizadas

- `npm run build` en `frontend`: correcto.
- `node --check` en los controladores de ofertas y postulaciones: correcto.
- `GET http://localhost:3000/api/offers`: devuelve ofertas publicadas junto con los nuevos campos.
- Prueba autenticada desde el perfil de estudiante: intentar crear una oferta devuelve `403` con el mensaje de que solo una organización puede publicar.
- Vista abierta con el perfil de Juan: muestra el saludo con su nombre y seis ofertas.
- Migración aplicada a la base local configurada; no se recreó la base.

## Alcance y pendientes

La sincronización entre perfiles es periódica, no instantánea: no se implementó WebSocket ni envío de correo. La gestión de foto/CV requiere almacenamiento de archivos en backend y no forma parte de esta actualización. No se validó el flujo completo de crear, editar y cancelar con credenciales de una organización en el navegador; sus rutas y permisos se verificaron por lectura del controlador, compilación y consulta de API.
