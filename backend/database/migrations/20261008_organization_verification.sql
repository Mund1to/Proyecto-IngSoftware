-- Migración aditiva para la verificación de organizaciones (Fase 3, #17 HU-13).
-- No reinicializa la base ni elimina datos: solo asegura los elementos
-- necesarios para registrar y aprobar verificaciones.

BEGIN;

CREATE TABLE IF NOT EXISTS verificaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(perfil_id) ON DELETE CASCADE,
    revisado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    estado verification_status NOT NULL DEFAULT 'PENDIENTE',
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizaciones
    ADD COLUMN IF NOT EXISTS verificada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS verificaciones_organizacion_id_idx ON verificaciones(organizacion_id);

COMMIT;
