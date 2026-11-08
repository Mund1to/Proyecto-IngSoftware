-- Papelera de ofertas: una oferta cancelada guarda cuándo y por qué se canceló,
-- se puede restaurar como borrador y, si nunca recibió postulaciones, borrar
-- definitivamente. Las postulaciones abiertas reciben un evento OFERTA para que
-- el candidato sepa que la empresa canceló la oferta. Idempotente.

BEGIN;

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS cancelada_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(300);

-- Ofertas canceladas antes de esta migración: la mejor fecha disponible es updated_at.
UPDATE ofertas SET cancelada_at = updated_at
WHERE estado = 'CANCELADA' AND cancelada_at IS NULL;

-- Nuevo tipo de evento del historial: OFERTA (la empresa canceló la oferta).
ALTER TABLE postulacion_eventos DROP CONSTRAINT IF EXISTS postulacion_eventos_tipo_check;
ALTER TABLE postulacion_eventos ADD CONSTRAINT postulacion_eventos_tipo_check
    CHECK (tipo IN ('POSTULACION', 'ESTADO', 'ENTREVISTA', 'NOTA', 'RETIRO', 'CV', 'OFERTA'));

COMMIT;
