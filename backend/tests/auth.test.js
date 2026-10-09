import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/database.js';
import { loginRateLimiter } from '../src/middleware/rateLimit.middleware.js';
import {
  PASSWORD,
  api,
  auth,
  closeDatabase,
  createAdmin,
  registerUser,
  resetDatabase,
  uniqueEmail,
} from './helpers.js';

before(resetDatabase);
after(closeDatabase);
beforeEach(() => loginRateLimiter.reset());

describe('registro', () => {
  for (const profileType of ['ESTUDIANTE', 'ORGANIZACION', 'CANDIDATO_EXTERNO']) {
    it(`crea una cuenta ${profileType} con rol USUARIO y token`, async () => {
      const { token, user } = await registerUser(profileType, { razonSocial: 'Empresa Prueba' });
      assert.ok(token);
      assert.deepEqual(user.roles, ['USUARIO']);
      assert.deepEqual(user.profileTypes, [profileType]);
    });
  }

  it('acepta alias en inglés del tipo de perfil', async () => {
    const { user } = await registerUser('company', { razonSocial: 'Alias SAS' });
    assert.deepEqual(user.profileTypes, ['ORGANIZACION']);
  });

  it('rechaza un email repetido sin importar mayúsculas', async () => {
    const email = uniqueEmail('dup');
    await registerUser('ESTUDIANTE', { email });
    const response = await api().post('/api/auth/register').send({
      email: email.toUpperCase(), password: PASSWORD, nombreCompleto: 'Otro', profileType: 'ESTUDIANTE',
    });
    assert.equal(response.status, 409);
  });

  it('valida campos obligatorios, formato de email, longitud de contraseña y tipo', async () => {
    const cases = [
      { email: 'a@b.co', password: PASSWORD },
      { email: 'no-es-email', password: PASSWORD, nombreCompleto: 'X' },
      { email: 'c@d.co', password: 'corta', nombreCompleto: 'X' },
      { email: 'e@f.co', password: PASSWORD, nombreCompleto: 'X', profileType: 'ADMINISTRADOR' },
    ];

    for (const body of cases) {
      const response = await api().post('/api/auth/register').send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  it('no permite registrarse directamente como administrador', async () => {
    const response = await api().post('/api/auth/register').send({
      email: uniqueEmail('hack'), password: PASSWORD, nombreCompleto: 'Hack', profileType: 'ESTUDIANTE', roles: ['ADMINISTRADOR'],
    });
    assert.equal(response.status, 201);
    assert.deepEqual(response.body.user.roles, ['USUARIO']);
  });
});

describe('inicio de sesión', () => {
  it('devuelve token y perfil con credenciales correctas', async () => {
    const { email } = await registerUser('CANDIDATO_EXTERNO');
    const response = await api().post('/api/auth/login').send({ email: `  ${email.toUpperCase()} `, password: PASSWORD });
    assert.equal(response.status, 200);
    assert.ok(response.body.token);
    assert.deepEqual(response.body.user.profileTypes, ['CANDIDATO_EXTERNO']);
  });

  it('responde 401 genérico con contraseña o email incorrectos', async () => {
    const { email } = await registerUser('ESTUDIANTE');
    const wrongPassword = await api().post('/api/auth/login').send({ email, password: 'Incorrecta1' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'nadie@sipu.test', password: PASSWORD });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  it('exige email y contraseña', async () => {
    const response = await api().post('/api/auth/login').send({ email: 'x@y.co' });
    assert.equal(response.status, 400);
  });

  it('bloquea a una cuenta inactiva', async () => {
    const { email, user } = await registerUser('ESTUDIANTE');
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [user.id]);
    const response = await api().post('/api/auth/login').send({ email, password: PASSWORD });
    assert.equal(response.status, 403);
  });

  it('limita los intentos fallidos repetidos', async () => {
    const { email } = await registerUser('ESTUDIANTE');
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await api().post('/api/auth/login').send({ email, password: 'Incorrecta1' });
      statuses.push(response.status);
    }
    assert.equal(statuses.at(-1), 429);
    assert.ok(statuses.slice(0, 10).every((status) => status === 401));
  });
});

describe('token y sesión', () => {
  it('rechaza peticiones sin token o con token inválido', async () => {
    assert.equal((await api().get('/api/profile/me')).status, 401);
    assert.equal((await api().get('/api/profile/me').set('Authorization', 'Bearer basura')).status, 401);
    assert.equal((await api().get('/api/profile/me').set('Authorization', 'Basic abc')).status, 401);
  });

  it('rechaza tokens firmados con otro secreto', async () => {
    const { user } = await registerUser('ESTUDIANTE');
    const forged = jwt.sign({ sub: String(user.id), roles: ['ADMINISTRADOR'] }, 'change-me-in-production');
    const response = await api().get('/api/profile/me').set(auth(forged));
    assert.equal(response.status, 401);
  });

  it('ignora roles inventados dentro de un token válido', async () => {
    const { user } = await registerUser('ESTUDIANTE');
    const token = jwt.sign({ sub: String(user.id), roles: ['ADMINISTRADOR'] }, process.env.JWT_SECRET);
    const response = await api().get('/api/stats/employment').set(auth(token));
    assert.equal(response.status, 403);
  });

  it('invalida el token de una cuenta desactivada o eliminada', async () => {
    const disabled = await registerUser('ESTUDIANTE');
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [disabled.user.id]);
    assert.equal((await api().get('/api/profile/me').set(auth(disabled.token))).status, 403);

    const removed = await registerUser('ESTUDIANTE');
    await pool.query('DELETE FROM usuarios WHERE id = $1', [removed.user.id]);
    assert.equal((await api().get('/api/profile/me').set(auth(removed.token))).status, 401);
  });

  it('aplica de inmediato la retirada de un rol', async () => {
    const admin = await createAdmin();
    assert.equal((await api().get('/api/stats/employment').set(auth(admin.token))).status, 200);

    await pool.query(
      `DELETE FROM usuario_roles WHERE usuario_id = $1 AND rol_id = (SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR')`,
      [admin.user.id]
    );
    assert.equal((await api().get('/api/stats/employment').set(auth(admin.token))).status, 403);
  });
});

describe('perfil', () => {
  it('devuelve el usuario con sus perfiles', async () => {
    const { token } = await registerUser('ESTUDIANTE', { universidad: 'Unibagué', semestre: 6 });
    const response = await api().get('/api/profile/me').set(auth(token));
    assert.equal(response.status, 200);
    assert.equal(response.body.user.perfiles[0].universidad, 'Unibagué');
    assert.equal(response.body.user.perfiles[0].semestre, 6);
  });

  it('actualiza nombre y teléfono y rechaza nombre vacío', async () => {
    const { token } = await registerUser('ESTUDIANTE');
    const ok = await api().put('/api/profile/me').set(auth(token)).send({ nombreCompleto: 'Ana Pérez', telefono: '3001234567' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.nombreCompleto, 'Ana Pérez');
    assert.equal(ok.body.user.telefono, '3001234567');

    const cleared = await api().put('/api/profile/me').set(auth(token)).send({ telefono: '' });
    assert.equal(cleared.body.user.telefono, null);

    const bad = await api().put('/api/profile/me').set(auth(token)).send({ nombreCompleto: '   ' });
    assert.equal(bad.status, 400);
  });

  it('actualiza el perfil de estudiante y valida el semestre', async () => {
    const { token } = await registerUser('ESTUDIANTE');
    const ok = await api().put('/api/profile/student').set(auth(token)).send({ programaAcademico: 'Ingeniería', semestre: 7 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.perfiles[0].programaAcademico, 'Ingeniería');

    const bad = await api().put('/api/profile/student').set(auth(token)).send({ semestre: 0 });
    assert.equal(bad.status, 400);
  });

  it('actualiza y vacía campos del candidato externo, incluidos nombre y teléfono', async () => {
    const { token } = await registerUser('CANDIDATO_EXTERNO', { ubicacion: 'Cali', resumen: 'Node' });
    const response = await api().put('/api/profile/external').set(auth(token)).send({
      ubicacion: '', resumen: 'React, Node', nombreCompleto: 'Luis Gómez', telefono: '3110000000', cvUrl: 'https://cv.test/luis.pdf',
    });
    assert.equal(response.status, 200);
    const profile = response.body.user.perfiles[0];
    assert.equal(profile.ubicacion, null);
    assert.equal(profile.resumen, 'React, Node');
    assert.equal(profile.cvUrl, 'https://cv.test/luis.pdf');
    assert.equal(response.body.user.nombreCompleto, 'Luis Gómez');
    assert.equal(response.body.user.telefono, '3110000000');
  });

  it('rechaza un enlace de hoja de vida que no es http(s)', async () => {
    const { token } = await registerUser('CANDIDATO_EXTERNO');
    const response = await api().put('/api/profile/external').set(auth(token)).send({ cvUrl: 'javascript:alert(1)' });
    assert.equal(response.status, 400);
  });

  it('actualiza la organización, protege la razón social y detecta NIT duplicado', async () => {
    await registerUser('ORGANIZACION', { razonSocial: 'Primera SAS', identificacionFiscal: '900-1' });
    const { token } = await registerUser('ORGANIZACION', { razonSocial: 'Segunda SAS' });

    const ok = await api().put('/api/profile/organization').set(auth(token)).send({ sitioWeb: 'https://segunda.test', descripcion: '' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.perfiles[0].sitioWeb, 'https://segunda.test');
    assert.equal(ok.body.user.perfiles[0].descripcion, null);

    assert.equal((await api().put('/api/profile/organization').set(auth(token)).send({ razonSocial: '' })).status, 400);
    assert.equal((await api().put('/api/profile/organization').set(auth(token)).send({ identificacionFiscal: '900-1' })).status, 409);
  });

  it('responde 404 si el perfil no corresponde al tipo de cuenta', async () => {
    const { token } = await registerUser('ESTUDIANTE');
    assert.equal((await api().put('/api/profile/external').set(auth(token)).send({ resumen: 'x' })).status, 404);
    assert.equal((await api().put('/api/profile/organization').set(auth(token)).send({ descripcion: 'x' })).status, 404);
  });

  it('cambia la contraseña verificando la actual', async () => {
    const { email, token } = await registerUser('ESTUDIANTE');

    const wrong = await api().put('/api/profile/password').set(auth(token)).send({ currentPassword: 'Mala12345', newPassword: 'Nueva12345' });
    assert.equal(wrong.status, 400);

    const short = await api().put('/api/profile/password').set(auth(token)).send({ currentPassword: PASSWORD, newPassword: 'corta' });
    assert.equal(short.status, 400);

    const ok = await api().put('/api/profile/password').set(auth(token)).send({ currentPassword: PASSWORD, newPassword: 'Nueva12345' });
    assert.equal(ok.status, 200);

    assert.equal((await api().post('/api/auth/login').send({ email, password: PASSWORD })).status, 401);
    assert.equal((await api().post('/api/auth/login').send({ email, password: 'Nueva12345' })).status, 200);
  });
});
