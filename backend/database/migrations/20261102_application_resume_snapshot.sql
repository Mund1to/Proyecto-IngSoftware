-- Fase 8: cada postulación conserva la hoja de vida con la que se envió.
-- Antes la empresa veía siempre el archivo y los datos actuales del perfil, así
-- que al cambiar la hoja de vida para una oferta nueva también cambiaba la que
-- había recibido una oferta anterior. Idempotente.

BEGIN;

-- Copia de los datos de la hoja de vida (formación, experiencia, habilidades,
-- datos académicos) en el momento de postularse. Los datos de contacto (nombre,
-- correo y teléfono) siguen leyéndose del perfil para que la empresa use los vigentes.
ALTER TABLE postulaciones ADD COLUMN IF NOT EXISTS hoja_vida JSONB;

-- Archivo PDF enviado con la postulación. Se guarda en la base por la misma
-- razón que los archivos del perfil: el disco de Render se borra en cada despliegue.
--   origen PERFIL: copia del archivo que el candidato tenía en su perfil al postularse.
--   origen PROPIO: archivo que el candidato subió solo para esta postulación.
CREATE TABLE IF NOT EXISTS postulacion_cv (
    postulacion_id BIGINT PRIMARY KEY REFERENCES postulaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INTEGER NOT NULL CHECK (tamano > 0),
    contenido BYTEA NOT NULL,
    origen VARCHAR(10) NOT NULL DEFAULT 'PERFIL' CHECK (origen IN ('PERFIL', 'PROPIO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Postulaciones anteriores a esta migración: la mejor copia disponible es la que
-- la empresa veía hasta ahora, es decir, el perfil y el archivo actuales.
UPDATE postulaciones p
SET hoja_vida = (
    SELECT jsonb_build_object(
        'perfilTipo', pf.tipo,
        'universidad', pe.universidad,
        'programaAcademico', pe.programa_academico,
        'semestre', pe.semestre,
        'resumen', pc.resumen,
        'ubicacion', pc.ubicacion,
        'disponibilidad', pc.disponibilidad,
        'cvUrl', pc.cv_url,
        'educacion', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('titulo', e.titulo, 'institucion', e.institucion, 'periodo', e.periodo) ORDER BY e.orden, e.id)
            FROM perfil_educacion e WHERE e.perfil_id = pf.id
        ), '[]'::jsonb),
        'experiencia', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('cargo', x.cargo, 'empresa', x.empresa, 'periodo', x.periodo, 'descripcion', x.descripcion) ORDER BY x.orden, x.id)
            FROM perfil_experiencia x WHERE x.perfil_id = pf.id
        ), '[]'::jsonb),
        'habilidades', COALESCE((
            SELECT jsonb_agg(h.nombre ORDER BY h.categoria, h.id)
            FROM perfil_habilidades h WHERE h.perfil_id = pf.id
        ), '[]'::jsonb)
    )
    FROM perfiles pf
    LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = pf.id
    LEFT JOIN perfiles_candidato pc ON pc.perfil_id = pf.id
    WHERE pf.id = p.candidato_id
)
WHERE p.hoja_vida IS NULL;

INSERT INTO postulacion_cv (postulacion_id, nombre, mime, tamano, contenido, origen, created_at)
SELECT p.id, a.nombre, a.mime, a.tamano, a.contenido, 'PERFIL', a.created_at
FROM postulaciones p
INNER JOIN archivos a ON a.perfil_id = p.candidato_id AND a.tipo = 'CV'
ON CONFLICT (postulacion_id) DO NOTHING;

COMMIT;
