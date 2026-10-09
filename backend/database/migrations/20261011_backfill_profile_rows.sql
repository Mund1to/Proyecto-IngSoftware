-- Crea la fila de detalle que falta en perfiles creados sin ella (cuentas
-- antiguas o creadas a mano). Sin esa fila, guardar el perfil respondía
-- "No existe un perfil de candidato externo para este usuario."
-- Idempotente: solo inserta donde no existe la fila.
BEGIN;

INSERT INTO perfiles_estudiante (perfil_id)
SELECT p.id FROM perfiles p
WHERE p.tipo = 'ESTUDIANTE'
  AND NOT EXISTS (SELECT 1 FROM perfiles_estudiante pe WHERE pe.perfil_id = p.id);

INSERT INTO perfiles_candidato (perfil_id)
SELECT p.id FROM perfiles p
WHERE p.tipo = 'CANDIDATO_EXTERNO'
  AND NOT EXISTS (SELECT 1 FROM perfiles_candidato pc WHERE pc.perfil_id = p.id);

INSERT INTO organizaciones (perfil_id, razon_social)
SELECT p.id, u.nombre_completo FROM perfiles p
JOIN usuarios u ON u.id = p.usuario_id
WHERE p.tipo = 'ORGANIZACION'
  AND NOT EXISTS (SELECT 1 FROM organizaciones o WHERE o.perfil_id = p.id);

COMMIT;
