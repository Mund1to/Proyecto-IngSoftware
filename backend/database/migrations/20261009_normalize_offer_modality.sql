-- Normaliza la modalidad de las ofertas a los valores que usa la interfaz
-- (Presencial, Remota, Híbrida) y repara ciudades guardadas con una
-- codificación incorrecta (por ejemplo 'Bogot�').
-- Una modalidad desconocida rompía el catálogo del candidato externo.
-- Idempotente: solo modifica filas que aún no están normalizadas.

BEGIN;

UPDATE ofertas SET modalidad = 'Híbrida', updated_at = NOW()
WHERE modalidad IS NOT NULL AND modalidad <> 'Híbrida' AND LOWER(modalidad) ~ '^h.?brid';

UPDATE ofertas SET modalidad = 'Presencial', updated_at = NOW()
WHERE modalidad IS NOT NULL AND modalidad <> 'Presencial' AND LOWER(modalidad) LIKE 'presencial%';

UPDATE ofertas SET modalidad = 'Remota', updated_at = NOW()
WHERE modalidad IS NOT NULL AND modalidad <> 'Remota' AND LOWER(modalidad) ~ '^(remot|virtual|teletrabajo)';

UPDATE ofertas SET ubicacion = 'Bogotá', updated_at = NOW()
WHERE ubicacion IS NOT NULL AND ubicacion <> 'Bogotá' AND ubicacion ~ '^Bogot.$';

UPDATE ofertas SET ubicacion = 'Medellín', updated_at = NOW()
WHERE ubicacion IS NOT NULL AND ubicacion <> 'Medellín' AND ubicacion ~ '^Medell.n$';

COMMIT;
