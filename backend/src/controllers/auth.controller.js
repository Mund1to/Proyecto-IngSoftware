import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getBodyValue(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined && payload[key] !== null) {
      return payload[key];
    }
  }

  return undefined;
}

function buildToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      nombreCompleto: user.nombre_completo,
      roles: user.roles ?? [],
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function registerController(request, response) {
  const payload = request.body ?? {};
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);
  const nombreCompleto = String(getBodyValue(payload, ['nombreCompleto', 'nombre_completo', 'nombre']) ?? '').trim();
  const telefono = getBodyValue(payload, ['telefono', 'phone']) ?? null;

  if (!email || !password || !nombreCompleto) {
    return response.status(400).json({
      ok: false,
      message: 'Se requieren email, password y nombre completo.',
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({
      ok: false,
      message: 'El email no tiene un formato válido.',
    });
  }

  if (String(password).length < 8) {
    return response.status(400).json({
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);

    if (existingUser.rowCount > 0) {
      return response.status(409).json({
        ok: false,
        message: 'Ya existe un usuario con ese email.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const userResult = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, telefono)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nombre_completo, telefono, activo, created_at`,
      [email, passwordHash, nombreCompleto, telefono ? String(telefono).trim() : null]
    );

    const user = userResult.rows[0];
    const roleResult = await pool.query('SELECT id, nombre FROM roles WHERE nombre = $1 LIMIT 1', ['USUARIO']);

    if (roleResult.rowCount === 0) {
      throw new Error('No existe el rol USUARIO en la base de datos.');
    }

    const role = roleResult.rows[0];
    await pool.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [user.id, role.id]);

    const token = buildToken({ ...user, roles: [role.nombre] });

    return response.status(201).json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombre_completo,
        telefono: user.telefono,
        activo: user.activo,
        createdAt: user.created_at,
        roles: [role.nombre],
      },
    });
  } catch (error) {
    console.error('registerController error:', error);
    return response.status(500).json({
      ok: false,
      message: 'No se pudo registrar el usuario.',
    });
  }
}

export async function loginController(request, response) {
  const payload = request.body ?? {};
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);

  if (!email || !password) {
    return response.status(400).json({
      ok: false,
      message: 'Debe indicar email y password.',
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo,
              array_agg(DISTINCT r.nombre ORDER BY r.nombre) AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       WHERE LOWER(u.email) = LOWER($1)
       GROUP BY u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo`,
      [email]
    );

    if (userResult.rowCount === 0) {
      return response.status(401).json({
        ok: false,
        message: 'Credenciales inválidas.',
      });
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return response.status(403).json({
        ok: false,
        message: 'El usuario está inactivo.',
      });
    }

    const isValidPassword = await bcrypt.compare(String(password), user.password_hash);

    if (!isValidPassword) {
      return response.status(401).json({
        ok: false,
        message: 'Credenciales inválidas.',
      });
    }

    const roles = Array.isArray(user.roles) ? user.roles : (user.roles ? user.roles.split(',').filter(Boolean) : []);
    const token = buildToken({ ...user, roles });

    return response.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombre_completo,
        telefono: user.telefono,
        activo: user.activo,
        roles,
      },
    });
  } catch (error) {
    console.error('loginController error:', error);
    return response.status(500).json({
      ok: false,
      message: 'No se pudo iniciar sesión.',
    });
  }
}

