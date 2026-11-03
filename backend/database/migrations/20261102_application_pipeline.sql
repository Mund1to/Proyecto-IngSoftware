-- Fase 8: proceso de selección entre la empresa y el candidato.
-- Cada postulación guarda su historial (cambios de etapa con mensaje para el
-- candidato, entrevistas, notas privadas de la empresa, retiro y cambios de hoja
-- de vida), la entrevista vigente y una calificación interna. Idempotente.

BEGIN;

--   entrevista    entrevista vigente: { fecha, modalidad, lugar, duracionMinutos }.
--   calificacion  valoración interna de la empresa, de 1 a 5; el candidato no la ve.
ALTER TABLE postulaciones
    ADD COLUMN IF NOT EXISTS entrevista JSONB,
    ADD COLUMN IF NOT EXISTS calificacion SMALLINT CHECK (calificacion BETWEEN 1 AND 5);

-- Historial de la postulación. privado = TRUE solo lo ve la empresa (notas).
--   POSTULACION  el candidato se postuló (mensaje = su mensaje para la empresa).
--   ESTADO       la empresa cambió la etapa (mensaje = texto para el candidato).
--   ENTREVISTA   la empresa citó o reprogramó una entrevista.
--   NOTA         nota interna de la empresa.
--   RETIRO       el candidato retiró la postulación.
--   CV           el candidato cambió la hoja de vida enviada.
CREATE TABLE IF NOT EXISTS postulacion_eventos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    postulacion_id BIGINT NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    autor_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('POSTULACION', 'ESTADO', 'ENTREVISTA', 'NOTA', 'RETIRO', 'CV')),
    estado_anterior application_status,
    estado_nuevo application_status,
    mensaje TEXT,
    privado BOOLEAN NOT NULL DEFAULT FALSE,
    entrevista JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS postulacion_eventos_postulacion_idx
    ON postulacion_eventos (postulacion_id, created_at);

-- Historial de las postulaciones anteriores a esta migración: la postulación y,
-- si ya cambió de etapa, ese último cambio (su autor y su fecha exacta no se
-- conocen; se usa updated_at). El texto automático "Postulación a ..." que
-- enviaba la versión anterior no se muestra como mensaje del candidato.
INSERT INTO postulacion_eventos (postulacion_id, autor_id, tipo, estado_nuevo, mensaje, created_at)
SELECT p.id, pf.usuario_id, 'POSTULACION', 'ENVIADA',
       CASE WHEN p.carta_presentacion LIKE 'Postulación a %' THEN NULL ELSE p.carta_presentacion END,
       p.created_at
FROM postulaciones p
INNER JOIN perfiles pf ON pf.id = p.candidato_id
WHERE NOT EXISTS (SELECT 1 FROM postulacion_eventos e WHERE e.postulacion_id = p.id AND e.tipo = 'POSTULACION');

INSERT INTO postulacion_eventos (postulacion_id, tipo, estado_anterior, estado_nuevo, created_at)
SELECT p.id, CASE WHEN p.estado = 'RETIRADA' THEN 'RETIRO' ELSE 'ESTADO' END, 'ENVIADA', p.estado, p.updated_at
FROM postulaciones p
WHERE p.estado <> 'ENVIADA'
  AND NOT EXISTS (
      SELECT 1 FROM postulacion_eventos e
      WHERE e.postulacion_id = p.id AND e.tipo IN ('ESTADO', 'ENTREVISTA', 'RETIRO')
  );

COMMIT;
