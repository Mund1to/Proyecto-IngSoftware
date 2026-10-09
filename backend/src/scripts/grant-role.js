// Asigna un rol a una cuenta existente. Sirve para crear el primer
// administrador, ya que el registro público solo otorga el rol USUARIO.
//
// Uso: npm run grant-role -- correo@dominio.com ADMINISTRADOR
import { pool } from '../config/database.js';
import { ASSIGNABLE_ROLES } from '../controllers/admin.controller.js';

const [email, rawRole = 'ADMINISTRADOR'] = process.argv.slice(2);
const role = String(rawRole).trim().toUpperCase();

if (!email) {
  console.error('Uso: npm run grant-role -- correo@dominio.com [ADMINISTRADOR|FUNCIONARIO_PUBLICO]');
  process.exit(1);
}

if (!ASSIGNABLE_ROLES.includes(role)) {
  console.error(`Rol no válido. Opciones: ${ASSIGNABLE_ROLES.join(', ')}`);
  process.exit(1);
}

try {
  const result = await pool.query(
    `INSERT INTO usuario_roles (usuario_id, rol_id)
     SELECT u.id, r.id FROM usuarios u, roles r
     WHERE LOWER(u.email) = LOWER($1) AND r.nombre = $2
     ON CONFLICT DO NOTHING
     RETURNING usuario_id`,
    [email, role]
  );

  const user = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  if (user.rowCount === 0) {
    console.error(`No existe un usuario con el correo ${email}.`);
    process.exitCode = 1;
  } else if (result.rowCount === 0) {
    console.log(`${email} ya tenía el rol ${role}.`);
  } else {
    console.log(`Rol ${role} asignado a ${email}. Debe cerrar sesión y volver a entrar.`);
  }
} catch (error) {
  console.error('No se pudo asignar el rol:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
