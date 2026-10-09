import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/config/database.js';
import { listMigrationFiles } from '../src/config/migrate.js';
import { api, auth, closeDatabase, createAdmin, registerUser, resetDatabase } from './helpers.js';

before(resetDatabase);
after(closeDatabase);

describe('infraestructura de la API', () => {
  it('responde salud y conexión a la base', async () => {
    const health = await api().get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const db = await api().get('/api/db-check');
    assert.equal(db.status, 200);
    assert.equal(db.body.ok, true);
  });

  it('devuelve 404 JSON para rutas desconocidas', async () => {
    const response = await api().get('/api/no-existe');
    assert.equal(response.status, 404);
    assert.equal(response.body.ok, false);
  });

  it('rechaza identificadores no numéricos con 400', async () => {
    const response = await api().get('/api/offers/abc');
    assert.equal(response.status, 400);
  });

  it('rechaza JSON mal formado con 400', async () => {
    const response = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(response.status, 400);
  });

  it('rechaza texto con caracteres de codificación inválida', async () => {
    const response = await api().post('/api/auth/register').send({
      email: 'mal@sipu.test', password: 'Clave1234', nombreCompleto: 'Jos�', profileType: 'ESTUDIANTE',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /codificación/);
  });
});

describe('migraciones', () => {
  it('registra todas las migraciones como aplicadas', async () => {
    const result = await pool.query('SELECT nombre FROM schema_migrations ORDER BY nombre');
    assert.deepEqual(result.rows.map((row) => row.nombre), listMigrationFiles());
  });

  it('la migración de modalidad repara datos dañados', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Datos Viejos SAS' });
    const org = await pool.query('SELECT id FROM perfiles WHERE usuario_id = $1', [company.user.id]);
    await pool.query(
      `INSERT INTO ofertas (organizacion_id, titulo, descripcion, tipo, estado, modalidad, ubicacion)
       VALUES ($1, 'Vieja', 'Dañada', 'PRACTICA', 'PUBLICADA', $2, $3)`,
      [org.rows[0].id, 'H�brida', 'Bogot�']
    );

    await pool.query(`DELETE FROM schema_migrations WHERE nombre = '20261009_normalize_offer_modality.sql'`);
    const admin = await createAdmin();
    const rerun = await api().post('/api/init-db').set(auth(admin.token));
    assert.equal(rerun.status, 200);
    assert.deepEqual(rerun.body.applied, ['20261009_normalize_offer_modality.sql']);

    const fixed = await pool.query(`SELECT modalidad, ubicacion FROM ofertas WHERE titulo = 'Vieja'`);
    assert.deepEqual(fixed.rows[0], { modalidad: 'Híbrida', ubicacion: 'Bogotá' });
  });

  it('init-db exige un administrador', async () => {
    const anonymous = await api().post('/api/init-db');
    assert.equal(anonymous.status, 401);

    const user = await registerUser('ESTUDIANTE');
    const forbidden = await api().post('/api/init-db').set(auth(user.token));
    assert.equal(forbidden.status, 403);

    const legacyGet = await api().get('/api/init-db');
    assert.equal(legacyGet.status, 404);
  });
});
