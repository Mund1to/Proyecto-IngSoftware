-- Fase 6: nuevo tipo de oferta para cursos y capacitaciones.
-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción que lo crea,
-- por eso esta migración va sola y sin BEGIN/COMMIT.

ALTER TYPE offer_type ADD VALUE IF NOT EXISTS 'FORMACION';
