-- Fase 8: requisitos y condiciones de la oferta como datos estructurados.
-- Antes el formulario guardaba programa, habilidades, experiencia e idiomas como
-- texto libre dentro de `requisitos`, así que se podía escribir cualquier cosa.
-- `requisitos` queda para requisitos adicionales. Idempotente.
--
--   programas        programas o carreras aceptados; vacío = cualquier programa.
--   semestre_minimo  solo prácticas.
--   habilidades      habilidades buscadas (o temas, en formación).
--   experiencia      NINGUNA, MENOS_1, DE_1_A_2, DE_3_A_5, MAS_5.
--   idiomas          [{ "idioma": "Inglés", "nivel": "B2" }] con niveles A1-C2 o NATIVO.
--   jornada          TIEMPO_COMPLETO, MEDIO_TIEMPO, POR_HORAS, FLEXIBLE.
--   beneficios       beneficios que ofrece la empresa.
--   vacantes         cuántas personas se van a contratar o inscribir.

BEGIN;

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS programas TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS semestre_minimo SMALLINT CHECK (semestre_minimo BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS habilidades TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS experiencia VARCHAR(20) CHECK (experiencia IN ('NINGUNA', 'MENOS_1', 'DE_1_A_2', 'DE_3_A_5', 'MAS_5')),
    ADD COLUMN IF NOT EXISTS idiomas JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS jornada VARCHAR(20) CHECK (jornada IN ('TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_HORAS', 'FLEXIBLE')),
    ADD COLUMN IF NOT EXISTS beneficios TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS vacantes SMALLINT NOT NULL DEFAULT 1 CHECK (vacantes BETWEEN 1 AND 50);

COMMIT;
