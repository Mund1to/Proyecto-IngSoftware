-- Fase 7: verificación documental de organizaciones.
-- La empresa sube sus documentos (RUT, Cámara de Comercio...) y envía una
-- solicitud; un administrador o funcionario la revisa. Idempotente.

BEGIN;

-- Documentos de soporte de la organización. Se guardan en la base por la misma
-- razón que los archivos del perfil: el disco de Render se borra en cada despliegue.
CREATE TABLE IF NOT EXISTS documentos_verificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(perfil_id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('RUT', 'CAMARA_COMERCIO', 'CEDULA_REPRESENTANTE', 'OTRO')),
    nombre VARCHAR(200) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INTEGER NOT NULL CHECK (tamano > 0),
    contenido BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documentos_verificacion_organizacion_idx
    ON documentos_verificacion (organizacion_id);

-- Cada fila de verificaciones pasa a ser también una solicitud:
--   solicitado_por  quien la envió desde la empresa (NULL si la decisión la tomó
--                   directamente un revisor, como antes de esta fase);
--   mensaje         nota de la empresa para el revisor;
--   documentos      copia de los metadatos (sin contenido) de los documentos
--                   enviados, para conservar el historial aunque luego cambien;
--   revisado_at     momento de la decisión.
ALTER TABLE verificaciones
    ADD COLUMN IF NOT EXISTS solicitado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS mensaje TEXT,
    ADD COLUMN IF NOT EXISTS documentos JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS revisado_at TIMESTAMPTZ;

-- Una organización solo puede tener una solicitud propia en revisión a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS verificaciones_solicitud_pendiente_unica_idx
    ON verificaciones (organizacion_id)
    WHERE estado = 'PENDIENTE' AND solicitado_por IS NOT NULL;

-- Bandeja de solicitudes del revisor, filtrada por estado y ordenada por fecha.
CREATE INDEX IF NOT EXISTS verificaciones_estado_fecha_idx
    ON verificaciones (estado, created_at DESC);

COMMIT;
