# Backlog y fases de SIPU

> Versión de trabajo del backlog. La documentación histórica se conserva en `Proyecto-Archivos/docs/`.

## Visión del producto

SIPU evolucionará en tres etapas:

1. Plataforma de prácticas estudiantiles.
2. Bolsa de empleo para candidatos externos.
3. Agencia pública de intermediación laboral.

La arquitectura debe utilizar conceptos generales como `Usuario`, `Perfil`, `Candidato`, `Organización`, `Oferta` y `Postulación`, evitando depender exclusivamente del perfil estudiante.

## Fase 0 — Base técnica

**Objetivo:** preparar la arquitectura y el entorno de desarrollo.

- #1 Configuración inicial del monorepo frontend/backend.
- #2 Inicializar frontend con React, Vite y Tailwind.
- #3 Inicializar backend con Express.
- #4 Diseñar esquema inicial de PostgreSQL.

**Criterio de salida:** el repositorio puede ejecutar frontend, backend y base de datos localmente, con configuración documentada.

## Fase 1 — Plataforma de prácticas

**Objetivo:** entregar el MVP inicial para estudiantes y empresas.

- #5 HU-01: Registrar estudiante.
- #6 HU-02: Registrar empresa.
- #7 HU-03: Iniciar sesión.
- #8 HU-04: Publicar ofertas de práctica.
- #9 HU-05: Postularse a una oferta.
- #10 HU-06: Gestionar postulaciones.
- #11 HU-07: Administrar usuarios y perfiles.

**Criterio de salida:** un estudiante puede registrarse, autenticarse, consultar ofertas y postularse; una empresa puede publicar ofertas y gestionar sus postulaciones.

## Fase 2 — Candidatos externos

**Objetivo:** permitir que personas que no son estudiantes utilicen SIPU.

- #12 HU-08: Registrar candidato externo.
- #13 HU-09: Gestionar perfil laboral.
- #15 HU-11: Postularse a empleos generales.
- #19 HU-15: Buscar y filtrar ofertas.

El perfil laboral debe contemplar experiencia, formación, habilidades, ubicación, disponibilidad y contacto.

**Criterio de salida:** un candidato externo puede crear su cuenta, completar su perfil, buscar ofertas generales y postularse.

## Fase 3 — Bolsa de empleo general

**Objetivo:** ampliar la conexión entre candidatos y organizaciones empleadoras.

- #14 HU-10: Publicar ofertas de empleo general. ✅ Completada
- #16 HU-12: Gestionar tipos de oferta. ✅ Completada
- #17 HU-13: Verificar empresas y empleadores. ✅ Completada
- #20 HU-16: Recomendar ofertas según perfil. ✅ Completada

Los tipos de oferta iniciales serán `PRACTICA`, `EMPLEO` y `EMPLEO_PUBLICO`. Se podrá añadir `FORMACION` posteriormente.

**Criterio de salida:** las organizaciones pueden publicar ofertas clasificadas y los candidatos reciben resultados relevantes según su perfil.

El detalle de cierre está en [`informe-cierre-fase-3.md`](informe-cierre-fase-3.md).

## Fase 4 — Agencia pública de empleo

**Objetivo:** incorporar funciones institucionales y convocatorias públicas.

- #18 HU-14: Administrar convocatorias públicas.
- #21 HU-17: Generar estadísticas de empleo.

**Criterio de salida:** un funcionario autorizado puede administrar convocatorias, supervisar empleadores y consultar indicadores de empleo.

## Orden recomendado

```text
#1 → #2 → #3 → #4
→ #5 → #6 → #7 → #8 → #9 → #10 → #11
→ #12 → #13 → #15 → #19
→ #14 → #16 → #17 → #20
→ #18 → #21
```

## Prioridad

### Alta

- #1, #2, #3, #4
- #5, #6, #7
- #8, #9, #10

### Media

- #11
- #12, #13
- #14, #15, #16
- #19

### Futura

- #18
- #21

## Roles del sistema

- **Estudiante:** busca prácticas y gestiona postulaciones.
- **Candidato externo:** busca empleos generales y administra su perfil laboral.
- **Empresa u organización:** publica ofertas y gestiona candidatos.
- **Administrador:** modera usuarios, perfiles y publicaciones.
- **Funcionario público:** administra convocatorias y consulta estadísticas institucionales.

## Entidades principales

- `Usuario`
- `Perfil`
- `PerfilEstudiante`
- `PerfilCandidato`
- `Organización`
- `Oferta`
- `Postulación`
- `Convocatoria`
- `Verificación`

## Reglas de diseño

- Un usuario puede tener más de un tipo de perfil en el futuro.
- `tipoOferta` debe ser independiente de `tipoUsuario`.
- Una postulación debe relacionar un candidato con cualquier oferta compatible.
- Los permisos deben controlarse mediante roles y políticas, no mediante condiciones rígidas para estudiantes.
- La información sensible debe protegerse y auditarse.
- Las estadísticas deben utilizar datos agregados y respetar la privacidad de las personas.
