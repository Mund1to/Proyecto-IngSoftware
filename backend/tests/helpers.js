import pg from 'pg';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/config/database.js';
import { initializeDatabaseSchema } from '../src/config/migrate.js';
import { loginRateLimiter } from '../src/middleware/rateLimit.middleware.js';

export const api = () => request(app);

async function ensureTestDatabase() {
  const url = new URL(process.env.DATABASE_URL);
  const database = url.pathname.replace(/^\//, '');
  url.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '')}"`);
    }
  } finally {
    await admin.end();
  }
}

// Recrea el esquema desde cero y aplica schema.sql y todas las migraciones.
export async function resetDatabase() {
  await ensureTestDatabase();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const result = await initializeDatabaseSchema();
  if (!result.ok) throw new Error(`No se pudo crear el esquema de pruebas: ${result.message}`);
  loginRateLimiter.reset();
}

export async function closeDatabase() {
  await pool.end();
}

let sequence = 0;
export function uniqueEmail(prefix = 'user') {
  sequence += 1;
  return `${prefix}.${Date.now()}.${sequence}@sipu.test`;
}

export const PASSWORD = 'Clave1234';

export async function registerUser(profileType, overrides = {}) {
  const email = overrides.email ?? uniqueEmail(profileType.toLowerCase());
  const response = await api().post('/api/auth/register').send({
    email,
    password: PASSWORD,
    nombreCompleto: `Usuario ${profileType}`,
    profileType,
    ...overrides,
  });

  if (response.status !== 201) {
    throw new Error(`Registro falló (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return { email, token: response.body.token, user: response.body.user };
}

export async function grantRole(userId, role) {
  await pool.query(
    `INSERT INTO usuario_roles (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE nombre = $2 ON CONFLICT DO NOTHING`,
    [userId, role]
  );
}

export async function createAdmin(role = 'ADMINISTRADOR') {
  const account = await registerUser('ESTUDIANTE', { nombreCompleto: `Admin ${role}` });
  await grantRole(account.user.id, role);
  return account;
}

export function futureDate(days = 30) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function offerPayload(overrides = {}) {
  return {
    titulo: 'Practicante de desarrollo',
    descripcion: 'Apoyo en desarrollo de APIs',
    tipo: 'PRACTICA',
    estado: 'PUBLICADA',
    ubicacion: 'Bogotá',
    modalidad: 'Híbrida',
    area: 'Tecnología',
    requisitos: ['JavaScript', 'SQL'],
    remuneracion: 1300000,
    contactoEmail: 'rrhh@empresa.test',
    fechaCierre: futureDate(),
    ...overrides,
  };
}

export async function createOffer(token, overrides = {}) {
  const response = await api().post('/api/offers').set('Authorization', `Bearer ${token}`).send(offerPayload(overrides));
  if (response.status !== 201) {
    throw new Error(`Crear oferta falló (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body.offer;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
