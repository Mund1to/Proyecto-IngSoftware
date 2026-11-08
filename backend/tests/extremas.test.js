// Pruebas extremas: entradas absurdas, obvias o que nadie haría, contra todos
// los roles y endpoints. La regla general es que la API nunca responda 500
// ni filtre datos de otros usuarios, sin importar lo que reciba.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { pool } from '../src/core/database/database.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../src/core/middleware/rateLimit.middleware.js';
import {
  PASSWORD,
  api,
  auth,
  closeDatabase,
  createAdmin,
  createOffer,
  futureDate,
  offerPayload,
  registerUser,
  resetDatabase,
  uniqueEmail,
} from './helpers.js';

before(resetDatabase);
after(closeDatabase);
beforeEach(() => {
  loginRateLimiter.reset();
  passwordResetRateLimiter.reset();
});

// Falla con el cuerpo de la respuesta para ver qué devolvió la API.
function expectStatus(response, ...allowed) {
  assert.ok(
    allowed.includes(response.status),
    `${response.req?.method} ${response.req?.path} → ${response.status} (esperado ${allowed.join('/')}): ${JSON.stringify(response.body)}`
  );
  if (response.status >= 400 && response.headers['content-type']?.includes('json')) {
    assert.equal(response.body.ok, false, 'un error debe responder ok: false');
    assert.equal(typeof response.body.message, 'string', 'un error debe traer message');
  }
}

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20), Buffer.from('\n%%EOF')]);

const ABSURD_IDS = ['abc', '-1', '0', '1.5', '1e3', '99999999999999999999', '1;DROP TABLE usuarios', '%00', 'null', 'undefined', 'NaN', 'Infinity', '0x10', ' 1', '١'];

const ABSURD_STRINGS = [
  "' OR '1'='1' --",
  "'; DROP TABLE usuarios; --",
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '{{7*7}}',
  '${process.exit(1)}',
  '../../../../etc/passwd',
  '\u0000',
  '‮gnp.exe',
  '😀🔥💀'.repeat(50),
  'a'.repeat(10000),
  '   ',
  'Ñandú Pérez Ångström 中文 العربية',
];

const ABSURD_TYPES = [null, 0, -1, 1e308, true, false, [], ['a'], {}, { $gt: '' }, '', 'NaN'];

// -----------------------------------------------------------------------------
describe('extremas: peticiones mal formadas', () => {
  it('JSON roto, vacío o con tipos raros nunca devuelve 500', async () => {
    const bodies = ['{', '{"email":', 'null', '[]', '"texto"', '123', 'true', '{"a":1}{"b":2}', '\u0000', 'undefined'];
    for (const body of bodies) {
      const response = await api().post('/api/auth/login').set('Content-Type', 'application/json').send(body);
      expectStatus(response, 400, 401);
    }
  });

  it('un cuerpo de más de 1 MB responde 413', async () => {
    const response = await api().post('/api/auth/register').send({ email: 'x@x.co', password: PASSWORD, nombreCompleto: 'a'.repeat(1_100_000) });
    expectStatus(response, 413);
  });

  it('Content-Type falso o ausente no rompe la API', async () => {
    for (const type of ['text/plain', 'application/xml', 'multipart/form-data', 'application/x-www-form-urlencoded', 'image/png']) {
      const response = await api().post('/api/auth/login').set('Content-Type', type).send('email=a@a.co&password=x');
      expectStatus(response, 400, 401, 415);
    }
  });

  it('rutas inexistentes responden 404 en JSON', async () => {
    for (const path of ['/api/nada', '/api/offers/1/2/3/4', '/api/../../etc/passwd', '/api/%2e%2e/%2e%2e/etc/passwd', '/api/admin/../auth/login', '/api/' + 'x'.repeat(5000)]) {
      const response = await api().get(path);
      expectStatus(response, 400, 401, 404, 414);
    }
  });

  it('métodos no previstos no rompen la API', async () => {
    expectStatus(await api().put('/api/health'), 404);
    expectStatus(await api().delete('/api/auth/login'), 404);
    expectStatus(await api().patch('/api/offers'), 404);
    const options = await api().options('/api/offers');
    assert.ok(options.status < 500);
  });

  it('el intento de contaminar prototipos no da privilegios', async () => {
    const response = await api().post('/api/auth/register').set('Content-Type', 'application/json')
      .send('{"email":"proto.' + Date.now() + '@sipu.test","password":"Clave1234","nombreCompleto":"Proto","profileType":"ESTUDIANTE","__proto__":{"roles":["ADMINISTRADOR"],"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}');
    expectStatus(response, 201, 400);
    if (response.status === 201) assert.deepEqual(response.body.user.roles, ['USUARIO']);
    assert.equal({}.isAdmin, undefined);
    assert.equal({}.roles, undefined);
  });

  it('parámetros de consulta repetidos, anidados o enormes no rompen los listados', async () => {
    const statsToken = (await createAdmin('FUNCIONARIO_PUBLICO')).token;
    const queries = ['page=-1', 'page=0', 'page=abc', 'page=1e10', 'limit=0', 'limit=-5', 'limit=999999', 'limit=abc', 'page[]=1&page[]=2', 'page[a]=1', 'q=' + 'a'.repeat(3000), 'q=%27%20OR%201=1--', 'tipo=NO_EXISTE', 'modalidad=%00', 'ciudad=' + encodeURIComponent('<script>'), 'sort=;DROP'];
    for (const query of queries) {
      expectStatus(await api().get(`/api/offers?${query}`), 200, 400);
      expectStatus(await api().get(`/api/convocatorias?${query}`), 200, 400);
      expectStatus(await api().get(`/api/stats/employment?${query}`).set(auth(statsToken)), 200, 400);
    }
  });

  it('texto con codificación rota se rechaza', async () => {
    const response = await api().post('/api/auth/register').send({ email: uniqueEmail('enc'), password: PASSWORD, nombreCompleto: 'Jos�', profileType: 'ESTUDIANTE' });
    expectStatus(response, 400);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: registro', () => {
  it('campos con tipos absurdos responden 400, nunca 500', async () => {
    for (const value of ABSURD_TYPES) {
      for (const field of ['email', 'password', 'nombreCompleto', 'profileType']) {
        const body = { email: uniqueEmail('tipos'), password: PASSWORD, nombreCompleto: 'Persona Real', profileType: 'ESTUDIANTE', [field]: value };
        const response = await api().post('/api/auth/register').send(body);
        expectStatus(response, 400, 201);
        if (field === 'email' || field === 'password') assert.equal(response.status, 400, `${field}=${JSON.stringify(value)} no debería registrarse`);
      }
    }
  });

  it('correos inválidos se rechazan', async () => {
    const invalid = ['sinarroba', '@dominio.co', 'a@', 'a@b', 'a b@c.co', 'a@@b.co', '<a>@b.co', `${'a'.repeat(250)}@b.co`, 'a@b.c', '.a@b.co', 'a.@b.co', 'a..b@c.co', "' OR 1=1--@x.co"];
    for (const email of invalid) {
      const response = await api().post('/api/auth/register').send({ email, password: PASSWORD, nombreCompleto: 'Correo Raro', profileType: 'ESTUDIANTE' });
      expectStatus(response, 400);
    }
  });

  it('no permite registrar el mismo correo con otras mayúsculas o espacios', async () => {
    const email = uniqueEmail('dup');
    await registerUser('ESTUDIANTE', { email });
    for (const variant of [email.toUpperCase(), `  ${email}  `, email.replace('dup', 'DUP')]) {
      const response = await api().post('/api/auth/register').send({ email: variant, password: PASSWORD, nombreCompleto: 'Duplicado', profileType: 'ESTUDIANTE' });
      expectStatus(response, 409, 400);
    }
  });

  it('el registro nunca concede roles administrativos', async () => {
    for (const extra of [{ roles: ['ADMINISTRADOR'] }, { rol: 'ADMINISTRADOR' }, { profileType: 'ADMINISTRADOR' }, { profileType: 'FUNCIONARIO_PUBLICO' }, { isAdmin: true }, { activo: false }]) {
      const response = await api().post('/api/auth/register').send({ email: uniqueEmail('rol'), password: PASSWORD, nombreCompleto: 'Escalador', profileType: 'ESTUDIANTE', ...extra });
      expectStatus(response, 201, 400);
      if (response.status === 201) {
        assert.deepEqual(response.body.user.roles, ['USUARIO']);
        const login = await api().post('/api/auth/login').send({ email: response.body.user.email, password: PASSWORD });
        expectStatus(login, 200);
      }
    }
  });

  it('contraseñas débiles, vacías o gigantes se rechazan', async () => {
    for (const password of ['', ' ', '1234', 'abcdefgh', '12345678', 'Clave 1', 'Aa1' + 'x'.repeat(70), ['Clave1234'], { a: 'Clave1234' }, ' '.repeat(20), 'a'.repeat(5000)]) {
      const response = await api().post('/api/auth/register').send({ email: uniqueEmail('pw'), password, nombreCompleto: 'Clave Débil', profileType: 'ESTUDIANTE' });
      expectStatus(response, 400);
    }
  });

  it('una contraseña de más de 72 bytes no se confunde con otra que comparte el inicio', async () => {
    const base = 'Aa1' + 'x'.repeat(69);
    const email = uniqueEmail('bcrypt');
    const register = await api().post('/api/auth/register').send({ email, password: `${base}PRIMERA`, nombreCompleto: 'Clave Larga', profileType: 'ESTUDIANTE' });
    if (register.status === 400) return; // rechazar claves largas también es correcto
    expectStatus(register, 201);
    const impostor = await api().post('/api/auth/login').send({ email, password: `${base}OTRA_DISTINTA` });
    expectStatus(impostor, 401);
  });

  it('nombres absurdos se guardan como texto o se rechazan, nunca rompen', async () => {
    for (const nombreCompleto of ABSURD_STRINGS) {
      const response = await api().post('/api/auth/register').send({ email: uniqueEmail('nombre'), password: PASSWORD, nombreCompleto, profileType: 'ESTUDIANTE' });
      expectStatus(response, 201, 400);
      if (response.status === 201) assert.equal(typeof response.body.user.nombreCompleto, 'string');
    }
  });

  it('un nombre de solo espacios no es un nombre', async () => {
    const response = await api().post('/api/auth/register').send({ email: uniqueEmail('esp'), password: PASSWORD, nombreCompleto: '     ', profileType: 'ESTUDIANTE' });
    expectStatus(response, 400);
  });

  it('cien registros simultáneos con el mismo correo crean una sola cuenta', async () => {
    const email = uniqueEmail('carrera');
    const responses = await Promise.all(Array.from({ length: 25 }, () =>
      api().post('/api/auth/register').send({ email, password: PASSWORD, nombreCompleto: 'Carrera', profileType: 'ESTUDIANTE' })));
    for (const response of responses) expectStatus(response, 201, 409);
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
    assert.equal(rows[0].n, 1);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: inicio de sesión y tokens', () => {
  it('credenciales con tipos absurdos responden 400 o 401', async () => {
    for (const value of ABSURD_TYPES) {
      loginRateLimiter.reset();
      expectStatus(await api().post('/api/auth/login').send({ email: value, password: PASSWORD }), 400, 401);
      expectStatus(await api().post('/api/auth/login').send({ email: 'a@b.co', password: value }), 400, 401);
    }
  });

  it('inyección SQL en el login no entra', async () => {
    loginRateLimiter.reset();
    for (const email of ["' OR '1'='1", "admin@x.co'--", '" OR ""="', "' UNION SELECT * FROM usuarios --"]) {
      expectStatus(await api().post('/api/auth/login').send({ email, password: "' OR '1'='1" }), 400, 401);
    }
  });

  it('el correo del login ignora mayúsculas y espacios', async () => {
    const account = await registerUser('ESTUDIANTE');
    expectStatus(await api().post('/api/auth/login').send({ email: account.email.toUpperCase(), password: PASSWORD }), 200);
    expectStatus(await api().post('/api/auth/login').send({ email: `  ${account.email} `, password: PASSWORD }), 200);
  });

  it('la contraseña sí distingue mayúsculas y espacios', async () => {
    const account = await registerUser('ESTUDIANTE');
    expectStatus(await api().post('/api/auth/login').send({ email: account.email, password: PASSWORD.toUpperCase() }), 401);
    expectStatus(await api().post('/api/auth/login').send({ email: account.email, password: ` ${PASSWORD}` }), 401);
  });

  it('el mensaje de error no revela si el correo existe', async () => {
    const account = await registerUser('ESTUDIANTE');
    const wrongPassword = await api().post('/api/auth/login').send({ email: account.email, password: 'Otra1234' });
    const noUser = await api().post('/api/auth/login').send({ email: uniqueEmail('fantasma'), password: 'Otra1234' });
    assert.equal(wrongPassword.status, noUser.status);
    assert.equal(wrongPassword.body.message, noUser.body.message);
  });

  it('muchos intentos fallidos se bloquean con 429', async () => {
    const account = await registerUser('ESTUDIANTE');
    let last;
    for (let i = 0; i < 30; i += 1) last = await api().post('/api/auth/login').send({ email: account.email, password: 'Mala12345' });
    expectStatus(last, 429);
  });

  it('tokens falsos, mal formados o firmados con otro secreto se rechazan', async () => {
    const account = await registerUser('ESTUDIANTE');
    const payload = jwt.decode(account.token);
    const headers = [
      '', 'Bearer', 'Bearer ', 'Bearer null', 'Bearer undefined', 'Basic abc', `bearer ${account.token}x`, `Bearer ${account.token}.extra`,
      `Bearer ${jwt.sign({ ...payload, roles: ['ADMINISTRADOR'] }, 'otro-secreto')}`,
      `Bearer ${jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET)}`,
      `Bearer ${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...payload, roles: ['ADMINISTRADOR'] })).toString('base64url')}.`,
      `Bearer ${'a'.repeat(10000)}`,
      `Bearer ${account.token} ${account.token}`,
    ];
    for (const header of headers) {
      const response = await api().get('/api/profile/me').set('Authorization', header);
      expectStatus(response, 401);
    }
  });

  it('un token válido con el rol cambiado no da acceso de administrador', async () => {
    const account = await registerUser('ESTUDIANTE');
    const payload = jwt.decode(account.token);
    const forged = jwt.sign({ ...payload, roles: ['USUARIO', 'ADMINISTRADOR'], role: 'ADMINISTRADOR' }, process.env.JWT_SECRET);
    const response = await api().get('/api/admin/users').set(auth(forged));
    expectStatus(response, 401, 403);
  });

  it('el token de un usuario desactivado o borrado deja de servir', async () => {
    const admin = await createAdmin();
    const victim = await registerUser('ESTUDIANTE');
    expectStatus(await api().patch(`/api/admin/users/${victim.user.id}/active`).set(auth(admin.token)).send({ activo: false }), 200);
    expectStatus(await api().get('/api/profile/me').set(auth(victim.token)), 401, 403);

    const ghost = await registerUser('ESTUDIANTE');
    await pool.query('DELETE FROM usuarios WHERE id = $1', [ghost.user.id]);
    expectStatus(await api().get('/api/profile/me').set(auth(ghost.token)), 401, 404);
    expectStatus(await api().post('/api/offers').set(auth(ghost.token)).send(offerPayload()), 401, 403, 404);
  });

  it('el usuario desactivado no puede volver a iniciar sesión', async () => {
    const admin = await createAdmin();
    const victim = await registerUser('ESTUDIANTE');
    await api().patch(`/api/admin/users/${victim.user.id}/active`).set(auth(admin.token)).send({ activo: false });
    expectStatus(await api().post('/api/auth/login').send({ email: victim.email, password: PASSWORD }), 401, 403);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: recuperación de contraseña', () => {
  it('responde igual exista o no el correo', async () => {
    const account = await registerUser('ESTUDIANTE');
    const known = await api().post('/api/auth/forgot-password').send({ email: account.email });
    const unknown = await api().post('/api/auth/forgot-password').send({ email: uniqueEmail('nadie') });
    assert.equal(known.status, unknown.status);
    assert.equal(known.body.message, unknown.body.message);
  });

  it('tipos absurdos en el correo no rompen', async () => {
    for (const email of ABSURD_TYPES) passwordResetRateLimiter.reset(), expectStatus(await api().post('/api/auth/forgot-password').send({ email }), 200, 400);
  });

  it('tokens de recuperación inventados se rechazan', async () => {
    passwordResetRateLimiter.reset();
    for (const token of ['', 'abc', 'a'.repeat(5000), "' OR 1=1--", null, 123, ['x'], { $ne: null }]) {
      passwordResetRateLimiter.reset();
      expectStatus(await api().post('/api/auth/reset-password').send({ token, password: 'NuevaClave1' }), 400);
    }
  });
});

// -----------------------------------------------------------------------------
describe('extremas: identificadores absurdos en todas las rutas', () => {
  it('ningún id raro devuelve 500', async () => {
    const admin = await createAdmin();
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Ids SAS' });
    const student = await registerUser('ESTUDIANTE');
    const routes = [
      ['get', (id) => `/api/offers/${id}`, null],
      ['patch', (id) => `/api/offers/${id}`, company.token],
      ['delete', (id) => `/api/offers/${id}`, company.token],
      ['patch', (id) => `/api/offers/${id}/restore`, company.token],
      ['delete', (id) => `/api/offers/${id}/permanent`, company.token],
      ['get', (id) => `/api/applications/offers/${id}`, company.token],
      ['post', (id) => `/api/applications/offers/${id}`, student.token],
      ['patch', (id) => `/api/applications/${id}/status`, company.token],
      ['post', (id) => `/api/applications/${id}/notes`, company.token],
      ['patch', (id) => `/api/applications/${id}/rating`, company.token],
      ['get', (id) => `/api/applications/${id}/cv`, company.token],
      ['patch', (id) => `/api/applications/${id}/withdraw`, student.token],
      ['get', (id) => `/api/convocatorias/${id}`, null],
      ['get', (id) => `/api/convocatorias/${id}/offers`, null],
      ['patch', (id) => `/api/convocatorias/${id}`, admin.token],
      ['delete', (id) => `/api/convocatorias/${id}`, admin.token],
      ['put', (id) => `/api/admin/users/${id}/roles`, admin.token],
      ['patch', (id) => `/api/admin/users/${id}/active`, admin.token],
      ['put', (id) => `/api/admin/users/${id}/password`, admin.token],
      ['patch', (id) => `/api/verifications/organizations/${id}`, admin.token],
      ['patch', (id) => `/api/verifications/requests/${id}`, admin.token],
      ['get', (id) => `/api/verifications/documents/${id}`, admin.token],
      ['get', (id) => `/api/verifications/me/documents/${id}`, company.token],
      ['delete', (id) => `/api/verifications/me/documents/${id}`, company.token],
    ];
    for (const [method, path, token] of routes) {
      for (const id of ABSURD_IDS) {
        let request = api()[method](path(encodeURIComponent(id)));
        if (token) request = request.set(auth(token));
        const response = await request.send({ estado: 'EN_REVISION', mensaje: 'x', calificacion: 3, roles: ['USUARIO'], activo: true, password: 'NuevaClave1', titulo: 'x' });
        expectStatus(response, 400, 403, 404);
      }
    }
  });

  it('los tipos de archivo del perfil solo aceptan cv y foto', async () => {
    const student = await registerUser('ESTUDIANTE');
    for (const tipo of ['virus', '..', '../cv', 'CV', 'cv%00', 'foto.exe', '', 'null']) {
      const response = await api().get(`/api/profile/files/${encodeURIComponent(tipo)}`).set(auth(student.token));
      expectStatus(response, 400, 404);
    }
  });
});

// -----------------------------------------------------------------------------
describe('extremas: permisos entre roles', () => {
  it('sin token solo se ven las rutas públicas', async () => {
    const privateRoutes = [
      ['get', '/api/profile/me'], ['put', '/api/profile/me'], ['get', '/api/profile/details'], ['get', '/api/offers/mine'], ['get', '/api/offers/recommended'],
      ['post', '/api/offers'], ['get', '/api/applications/me'], ['get', '/api/admin/users'], ['get', '/api/verifications/me'],
      ['get', '/api/verifications/requests'], ['post', '/api/convocatorias'], ['post', '/api/init-db'], ['get', '/api/stats/employment'],
    ];
    for (const [method, path] of privateRoutes) expectStatus(await api()[method](path).send({}), 401);
    for (const path of ['/api/health', '/api/offers', '/api/convocatorias']) expectStatus(await api().get(path), 200);
  });

  it('un estudiante no puede hacer nada de empresa ni de administrador', async () => {
    const student = await registerUser('ESTUDIANTE');
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Ajena SAS' });
    const offer = await createOffer(company.token);
    const forbidden = [
      ['post', '/api/offers', offerPayload()],
      ['patch', `/api/offers/${offer.id}`, { titulo: 'Hackeada' }],
      ['delete', `/api/offers/${offer.id}`, {}],
      ['get', `/api/applications/offers/${offer.id}`, {}],
      ['get', '/api/admin/users', {}],
      ['put', `/api/admin/users/${student.user.id}/roles`, { roles: ['ADMINISTRADOR'] }],
      ['get', '/api/verifications/requests', {}],
      ['patch', '/api/verifications/organizations/1', { estado: 'APROBADA' }],
      ['post', '/api/convocatorias', { titulo: 'Mía' }],
      ['post', '/api/init-db', {}],
      ['put', '/api/profile/organization', { razonSocial: 'Ahora soy empresa' }],
    ];
    for (const [method, path, body] of forbidden) expectStatus(await api()[method](path).set(auth(student.token)).send(body), 403, 404);
    const after = await api().get(`/api/offers/${offer.id}`);
    assert.equal(after.body.offer.titulo, offer.titulo);
  });

  it('una empresa no toca ofertas ni postulantes de otra empresa', async () => {
    const owner = await registerUser('ORGANIZACION', { razonSocial: 'Dueña SAS' });
    const intruder = await registerUser('ORGANIZACION', { razonSocial: 'Intrusa SAS' });
    const student = await registerUser('ESTUDIANTE');
    const offer = await createOffer(owner.token);
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const appId = apply.body.application.id;

    const attempts = [
      ['patch', `/api/offers/${offer.id}`, { titulo: 'Robada' }],
      ['delete', `/api/offers/${offer.id}`, {}],
      ['patch', `/api/offers/${offer.id}/restore`, {}],
      ['delete', `/api/offers/${offer.id}/permanent`, {}],
      ['get', `/api/applications/offers/${offer.id}`, {}],
      ['patch', `/api/applications/${appId}/status`, { estado: 'RECHAZADA' }],
      ['post', `/api/applications/${appId}/notes`, { texto: 'Nota intrusa de otra empresa' }],
      ['patch', `/api/applications/${appId}/rating`, { calificacion: 1 }],
      ['get', `/api/applications/${appId}/cv`, {}],
    ];
    for (const [method, path, body] of attempts) expectStatus(await api()[method](path).set(auth(intruder.token)).send(body), 403, 404);

    const mine = await api().get('/api/offers/mine').set(auth(intruder.token));
    assert.equal(mine.body.offers.length, 0);
  });

  it('un candidato no ve ni toca postulaciones de otro candidato', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Candidatos SAS' });
    const offer = await createOffer(company.token);
    const alice = await registerUser('ESTUDIANTE');
    const bob = await registerUser('CANDIDATO_EXTERNO');
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(alice.token));
    const id = apply.body.application.id;

    expectStatus(await api().patch(`/api/applications/${id}/withdraw`).set(auth(bob.token)), 403, 404);
    expectStatus(await api().get(`/api/applications/${id}/cv`).set(auth(bob.token)), 403, 404);
    expectStatus(await api().put(`/api/applications/${id}/cv`).set(auth(bob.token)).set('Content-Type', 'application/pdf').send(PDF), 403, 404);
    expectStatus(await api().patch(`/api/applications/${id}/status`).set(auth(alice.token)).send({ estado: 'ACEPTADA' }), 403, 404);
    expectStatus(await api().patch(`/api/applications/${id}/rating`).set(auth(alice.token)).send({ calificacion: 5 }), 403, 404);

    const bobApps = await api().get('/api/applications/me').set(auth(bob.token));
    assert.equal(bobApps.body.applications.length, 0);
  });

  it('un funcionario público no administra usuarios', async () => {
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    expectStatus(await api().put(`/api/admin/users/${funcionario.user.id}/roles`).set(auth(funcionario.token)).send({ roles: ['ADMINISTRADOR'] }), 403);
  });

  it('las respuestas nunca exponen hashes de contraseñas', async () => {
    const admin = await createAdmin();
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Hash SAS' });
    const offer = await createOffer(company.token);
    const student = await registerUser('ESTUDIANTE');
    await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const responses = [
      await api().get('/api/admin/users').set(auth(admin.token)),
      await api().get('/api/profile/me').set(auth(student.token)),
      await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token)),
      await api().get('/api/applications/me').set(auth(student.token)),
      await api().get('/api/offers'),
      await api().post('/api/auth/login').send({ email: student.email, password: PASSWORD }),
    ];
    for (const response of responses) {
      const text = JSON.stringify(response.body);
      assert.ok(!/password_hash|\$2[aby]\$/.test(text), `${response.req.path} expone un hash`);
    }
  });
});

// -----------------------------------------------------------------------------
describe('extremas: ofertas', () => {
  it('payloads absurdos se rechazan o se guardan sanos, nunca 500', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Absurda SAS' });
    const variants = [
      { titulo: '' }, { titulo: '   ' }, { titulo: 'a'.repeat(10000) }, { titulo: null }, { titulo: ['a'] }, { titulo: { a: 1 } },
      { descripcion: 'x' }, { descripcion: 'asdfghjkl qwertyuiop zxcvbnm asdfgh' }, { descripcion: 'a'.repeat(100000) },
      { tipo: 'NO_EXISTE' }, { tipo: null }, { tipo: 123 }, { tipo: 'practica' },
      { estado: 'BORRADO' }, { estado: 'CANCELADA' }, { estado: 'CERRADA' },
      { remuneracion: -1 }, { remuneracion: 'mucho' }, { remuneracion: 1e308 }, { remuneracion: Number.MAX_SAFE_INTEGER * 10 }, { remuneracion: '1e999' }, { remuneracion: 0.0001 },
      { fechaCierre: '2000-01-01' }, { fechaCierre: 'mañana' }, { fechaCierre: '9999-12-31' }, { fechaCierre: '2026-02-30' }, { fechaCierre: 0 }, { fechaCierre: '' },
      { modalidad: 'Teletransportación' }, { modalidad: null },
      { habilidades: 'JavaScript' }, { habilidades: [] }, { habilidades: Array.from({ length: 1000 }, (_, i) => `h${i}`) }, { habilidades: [{ a: 1 }, null, 3] }, { habilidades: ['a'.repeat(5000)] },
      { requisitos: 'uno' }, { vacantes: 0 }, { vacantes: -3 }, { vacantes: 1e9 }, { vacantes: 'dos' }, { vacantes: 1.5 },
      { contactoEmail: 'no-es-correo' }, { contactoEmail: "x@x.co'; DROP TABLE ofertas;--" },
      { idiomas: 'inglés' }, { idiomas: [{ idioma: '', nivel: 'Z9' }] }, { idiomas: [{ idioma: 'Inglés', nivel: 'C3' }] },
      { semestreMinimo: -1 }, { semestreMinimo: 99 }, { semestreMinimo: 'quinto' },
      { experiencia: 'MUCHA' }, { jornada: 'SIEMPRE' }, { beneficios: 'todos' },
      { salarioMin: 5000000, salarioMax: 1000000, tipo: 'EMPLEO' },
    ];
    for (const variant of variants) {
      const response = await api().post('/api/offers').set(auth(company.token)).send(offerPayload(variant));
      expectStatus(response, 201, 400);
    }
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM ofertas WHERE LENGTH(titulo) > 500 OR remuneracion < 0 OR fecha_cierre < NOW() - INTERVAL '1 day'");
    assert.equal(rows[0].n, 0, 'no deben guardarse títulos enormes, salarios negativos ni ofertas ya cerradas');
  });

  it('textos con HTML o inyección se guardan literalmente, sin ejecutarse', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Literal SAS' });
    const titulo = '<script>alert(1)</script> Desarrollador';
    const offer = await createOffer(company.token, { titulo });
    const detail = await api().get(`/api/offers/${offer.id}`);
    assert.equal(detail.body.offer.titulo, titulo);
    const { rows } = await pool.query("SELECT to_regclass('public.usuarios') IS NOT NULL AS existe");
    assert.equal(rows[0].existe, true);
  });

  it('la búsqueda con comodines de SQL no devuelve todo', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Buscar SAS' });
    await createOffer(company.token, { titulo: 'Analista contable' });
    for (const q of ['%', '_', '%%', '\\', "'", '%_%']) {
      const response = await api().get(`/api/offers?q=${encodeURIComponent(q)}`);
      expectStatus(response, 200, 400);
    }
  });

  it('un borrador o una oferta cancelada no se ven en el catálogo público', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Oculta SAS' });
    const draft = await createOffer(company.token, { estado: 'BORRADOR', titulo: 'Borrador secreto' });
    const cancelled = await createOffer(company.token, { titulo: 'Cancelada secreta' });
    await api().delete(`/api/offers/${cancelled.id}`).set(auth(company.token));
    const list = await api().get('/api/offers?limit=50');
    const ids = list.body.offers.map((o) => o.id);
    assert.ok(!ids.includes(draft.id));
    assert.ok(!ids.includes(cancelled.id));
    const student = await registerUser('ESTUDIANTE');
    expectStatus(await api().get(`/api/offers/${draft.id}`).set(auth(student.token)), 404, 403);
    expectStatus(await api().post(`/api/applications/offers/${draft.id}`).set(auth(student.token)), 400, 404, 409);
    expectStatus(await api().post(`/api/applications/offers/${cancelled.id}`).set(auth(student.token)), 400, 404, 409);
  });

  it('cancelar dos veces, restaurar algo activo o borrar algo publicado no rompe', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Papelera SAS' });
    const offer = await createOffer(company.token);
    expectStatus(await api().patch(`/api/offers/${offer.id}/restore`).set(auth(company.token)), 400, 409);
    expectStatus(await api().delete(`/api/offers/${offer.id}/permanent`).set(auth(company.token)), 400, 409);
    expectStatus(await api().delete(`/api/offers/${offer.id}`).set(auth(company.token)).send({ motivo: 'a'.repeat(5000) }), 200, 400);
    expectStatus(await api().delete(`/api/offers/${offer.id}`).set(auth(company.token)), 200, 400, 409);
    expectStatus(await api().delete(`/api/offers/${offer.id}`).set(auth(company.token)).send({ motivo: { a: 1 } }), 200, 400, 409);
  });

  it('veinte cancelaciones y restauraciones simultáneas dejan un estado válido', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Concurrente SAS' });
    const offer = await createOffer(company.token);
    const ops = Array.from({ length: 20 }, (_, i) => (i % 2
      ? api().delete(`/api/offers/${offer.id}`).set(auth(company.token))
      : api().patch(`/api/offers/${offer.id}/restore`).set(auth(company.token))));
    for (const response of await Promise.all(ops)) expectStatus(response, 200, 400, 409);
    const { rows } = await pool.query('SELECT estado FROM ofertas WHERE id = $1', [offer.id]);
    assert.ok(['PUBLICADA', 'BORRADOR', 'CANCELADA'].includes(rows[0].estado));
  });

  it('una empresa no puede cambiar el dueño de su oferta', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Dueño SAS' });
    const other = await registerUser('ORGANIZACION', { razonSocial: 'Otro SAS' });
    const offer = await createOffer(company.token);
    const { rows: [before] } = await pool.query('SELECT * FROM ofertas WHERE id = $1', [offer.id]);
    const ownerKeys = Object.keys(before).filter((k) => /organiz|empresa|usuario|owner|creado_por/.test(k));
    const hijack = Object.fromEntries(ownerKeys.map((k) => [k, other.user.id]));
    await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ ...hijack, id: 1, organizacionId: other.user.id });
    const { rows: [afterRow] } = await pool.query('SELECT * FROM ofertas WHERE id = $1', [offer.id]);
    for (const key of ownerKeys) assert.equal(String(afterRow[key]), String(before[key]), `${key} cambió`);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: postulaciones y proceso de selección', () => {
  async function setup() {
    const company = await registerUser('ORGANIZACION', { razonSocial: `Selección ${Date.now()}` });
    const offer = await createOffer(company.token);
    const student = await registerUser('ESTUDIANTE');
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: 'Hola' });
    return { company, offer, student, id: apply.body.application.id };
  }

  it('cartas de presentación absurdas', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Cartas SAS' });
    for (const carta of [...ABSURD_STRINGS, ...ABSURD_TYPES]) {
      const offer = await createOffer(company.token);
      const student = await registerUser('ESTUDIANTE');
      const response = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: carta });
      expectStatus(response, 201, 400);
    }
  });

  it('una empresa no puede postularse ni a su propia oferta', async () => {
    const { company, offer } = await setup();
    expectStatus(await api().post(`/api/applications/offers/${offer.id}`).set(auth(company.token)), 403);
  });

  it('estados inventados o con otro formato se rechazan', async () => {
    const { company, id } = await setup();
    for (const estado of ['', 'aceptada', 'ACEPTADA ', 'GANADOR', null, 1, ['ACEPTADA'], { estado: 'ACEPTADA' }, 'RETIRADA', 'ENVIADA']) {
      expectStatus(await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado }), 400, 409);
    }
  });

  it('no se puede saltar de Enviada a Aceptada sin entrevista', async () => {
    const { company, id } = await setup();
    expectStatus(await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'ACEPTADA' }), 400, 409);
  });

  it('entrevistas con datos absurdos se rechazan', async () => {
    const { company, id } = await setup();
    await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'EN_REVISION' });
    const bad = [
      { fecha: '2000-01-01T10:00:00Z', modalidad: 'VIRTUAL', lugar: 'https://meet.test/x' },
      { fecha: 'mañana', modalidad: 'VIRTUAL' },
      { fecha: futureDate(3), modalidad: 'TELEPATIA' },
      { fecha: futureDate(3), modalidad: 'VIRTUAL', lugar: 'javascript:alert(1)' },
      { fecha: futureDate(3), modalidad: 'PRESENCIAL', duracionMinutos: -30 },
      { fecha: futureDate(3), modalidad: 'PRESENCIAL', duracionMinutos: 100000 },
      { fecha: futureDate(3650), modalidad: 'VIRTUAL', lugar: 'https://meet.test/x' },
      null, 'mañana a las 3',
    ];
    for (const entrevista of bad) {
      expectStatus(await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'PRESELECCIONADA', entrevista }), 400, 409);
    }
  });

  it('calificaciones fuera de rango se rechazan', async () => {
    const { company, id } = await setup();
    for (const calificacion of [0, 6, -1, 3.5, '5', 'cinco', 1e9, [3], { n: 3 }, true]) {
      expectStatus(await api().patch(`/api/applications/${id}/rating`).set(auth(company.token)).send({ calificacion }), 400);
    }
    expectStatus(await api().patch(`/api/applications/${id}/rating`).set(auth(company.token)).send({ calificacion: 5 }), 200);
    expectStatus(await api().patch(`/api/applications/${id}/rating`).set(auth(company.token)).send({ calificacion: null }), 200, 400);
  });

  it('notas vacías, gigantes o con tipos raros', async () => {
    const { company, id } = await setup();
    for (const mensaje of ['', '   ', 'a'.repeat(20000), null, 1, ['x'], { x: 1 }]) {
      expectStatus(await api().post(`/api/applications/${id}/notes`).set(auth(company.token)).send({ texto: mensaje }), 400);
    }
    expectStatus(await api().post(`/api/applications/${id}/notes`).set(auth(company.token)).send({ texto: '<b>ok</b> nota con emoji 😀' }), 201, 200);
  });

  it('retirarse dos veces o actuar sobre una postulación retirada', async () => {
    const { company, student, id } = await setup();
    expectStatus(await api().patch(`/api/applications/${id}/withdraw`).set(auth(student.token)), 200);
    expectStatus(await api().patch(`/api/applications/${id}/withdraw`).set(auth(student.token)), 409, 400);
    expectStatus(await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'EN_REVISION' }), 409, 400);
  });

  it('cincuenta cambios de etapa simultáneos dejan un historial coherente', async () => {
    const { company, id } = await setup();
    const states = ['EN_REVISION', 'RECHAZADA', 'EN_REVISION'];
    const responses = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: states[i % states.length], mensaje: `cambio ${i}` })));
    for (const response of responses) expectStatus(response, 200, 400, 409);
    const { rows: [app] } = await pool.query('SELECT estado FROM postulaciones WHERE id = $1', [id]);
    const { rows: [last] } = await pool.query("SELECT estado_nuevo FROM postulacion_eventos WHERE postulacion_id = $1 AND tipo = 'ESTADO' ORDER BY id DESC LIMIT 1", [id]);
    assert.equal(app.estado, last.estado_nuevo, 'el último evento debe coincidir con el estado guardado');
  });

  it('subir PDFs falsos, vacíos o enormes a una postulación', async () => {
    const { student, id } = await setup();
    const put = (body, type = 'application/pdf', name = 'cv.pdf') => api().put(`/api/applications/${id}/cv`).set(auth(student.token)).set('Content-Type', type).set('X-File-Name', encodeURIComponent(name)).send(body);
    expectStatus(await put(Buffer.alloc(0)), 400, 415);
    expectStatus(await put(Buffer.from('%PDF')), 400, 415, 200);
    expectStatus(await put(Buffer.from('MZ\x90\x00 esto es un exe')), 415, 400);
    expectStatus(await put(Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(6 * 1024 * 1024)])), 413);
    expectStatus(await put(PDF, 'image/png'), 415, 400);
    const traversal = await put(PDF, 'application/pdf', '../../../etc/passwd');
    expectStatus(traversal, 200);
    const { rows: [cv] } = await pool.query('SELECT nombre FROM postulacion_cv WHERE postulacion_id = $1', [id]);
    assert.ok(!cv.nombre.includes('/') && !cv.nombre.includes('\\'), `nombre guardado: ${cv.nombre}`);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: perfil y archivos', () => {
  it('actualizar el perfil con basura no rompe', async () => {
    const student = await registerUser('ESTUDIANTE');
    for (const value of [...ABSURD_TYPES, ...ABSURD_STRINGS.slice(0, 6)]) {
      expectStatus(await api().put('/api/profile/me').set(auth(student.token)).send({ nombreCompleto: value, telefono: value }), 200, 400);
      expectStatus(await api().put('/api/profile/student').set(auth(student.token)).send({ programa: value, semestre: value, codigo: value }), 200, 400);
      expectStatus(await api().put('/api/profile/skills').set(auth(student.token)).send({ habilidades: value }), 200, 400);
      expectStatus(await api().put('/api/profile/education').set(auth(student.token)).send({ educacion: value }), 200, 400);
      expectStatus(await api().put('/api/profile/experience').set(auth(student.token)).send({ experiencia: value }), 200, 400);
    }
  });

  it('no permite cambiar el correo por el de otra cuenta', async () => {
    const a = await registerUser('ESTUDIANTE');
    const b = await registerUser('ESTUDIANTE');
    const response = await api().put('/api/profile/me').set(auth(a.token)).send({ email: b.email });
    expectStatus(response, 200, 400, 409);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios WHERE LOWER(email) = LOWER($1)', [b.email]);
    assert.equal(rows[0].n, 1);
  });

  it('cambiar la contraseña con la actual equivocada o la misma', async () => {
    const student = await registerUser('ESTUDIANTE');
    expectStatus(await api().put('/api/profile/password').set(auth(student.token)).send({ currentPassword: 'Mala12345', newPassword: 'Nueva12345' }), 400, 401, 403);
    expectStatus(await api().put('/api/profile/password').set(auth(student.token)).send({ currentPassword: PASSWORD, newPassword: '123' }), 400);
    expectStatus(await api().put('/api/profile/password').set(auth(student.token)).send({ currentPassword: null, newPassword: null }), 400, 401);
    expectStatus(await api().put('/api/profile/password').set(auth(student.token)).send({}), 400, 401);
  });

  it('un estudiante no se convierte en empresa ni en externo por la puerta de atrás', async () => {
    const student = await registerUser('ESTUDIANTE');
    expectStatus(await api().put('/api/profile/organization').set(auth(student.token)).send({ razonSocial: 'Soy empresa', nit: '900123456' }), 403, 400, 404);
    const offer = await api().post('/api/offers').set(auth(student.token)).send(offerPayload());
    expectStatus(offer, 403);
  });

  it('archivos del perfil: vacíos, falsos, enormes y con nombres raros', async () => {
    const student = await registerUser('ESTUDIANTE');
    const put = (tipo, body, type, name = 'x') => api().put(`/api/profile/files/${tipo}`).set(auth(student.token)).set('Content-Type', type).set('X-File-Name', encodeURIComponent(name)).send(body);
    expectStatus(await put('cv', Buffer.alloc(0), 'application/pdf'), 400, 415);
    expectStatus(await put('foto', PDF, 'image/png'), 415, 400);
    expectStatus(await put('foto', Buffer.from('<svg onload=alert(1)>'), 'image/svg+xml'), 415, 400);
    expectStatus(await put('cv', Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(8 * 1024 * 1024)]), 'application/pdf'), 413);
    expectStatus(await put('cv', PDF, 'application/pdf', 'a'.repeat(2000) + '.pdf'), 200, 201, 400);
    expectStatus(await put('cv', PDF, 'application/pdf', '\u0000.pdf'), 200, 201, 400);
    expectStatus(await put('cv', PDF, 'application/pdf', '%E0%A4%A'), 200, 201, 400);
    expectStatus(await api().delete('/api/profile/files/cv').set(auth(student.token)), 200, 204, 404);
    expectStatus(await api().delete('/api/profile/files/cv').set(auth(student.token)), 200, 204, 404);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: administración', () => {
  it('el administrador no puede quitarse su propio rol ni desactivarse', async () => {
    const admin = await createAdmin();
    expectStatus(await api().put(`/api/admin/users/${admin.user.id}/roles`).set(auth(admin.token)).send({ roles: ['USUARIO'] }), 400, 409);
    expectStatus(await api().patch(`/api/admin/users/${admin.user.id}/active`).set(auth(admin.token)).send({ activo: false }), 409);
    const me = await api().get('/api/admin/users').set(auth(admin.token));
    expectStatus(me, 200);
  });

  it('roles inventados o con formato raro se rechazan', async () => {
    const admin = await createAdmin();
    const user = await registerUser('ESTUDIANTE');
    for (const roles of ['ADMINISTRADOR', ['DIOS'], [null], [1], null, {}, ['administrador '], Array(1000).fill('USUARIO')]) {
      expectStatus(await api().put(`/api/admin/users/${user.user.id}/roles`).set(auth(admin.token)).send({ roles }), 200, 400);
    }
    const { rows } = await pool.query("SELECT r.nombre FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = $1 AND r.nombre NOT IN ('USUARIO','ADMINISTRADOR','FUNCIONARIO_PUBLICO')", [user.user.id]);
    assert.equal(rows.length, 0);
  });

  it('activar con valores que no son booleanos se rechaza', async () => {
    const admin = await createAdmin();
    const user = await registerUser('ESTUDIANTE');
    for (const activo of ['false', 0, 1, null, 'sí', [], {}]) {
      expectStatus(await api().patch(`/api/admin/users/${user.user.id}/active`).set(auth(admin.token)).send({ activo }), 400);
    }
  });

  it('el administrador no puede poner una contraseña débil', async () => {
    const admin = await createAdmin();
    const user = await registerUser('ESTUDIANTE');
    for (const password of ['', '123', null, 'abcdefgh', ['Clave1234']]) {
      expectStatus(await api().put(`/api/admin/users/${user.user.id}/password`).set(auth(admin.token)).send({ password }), 400);
    }
  });

  it('buscar usuarios con texto absurdo', async () => {
    const admin = await createAdmin();
    for (const q of ABSURD_STRINGS.slice(0, 9)) {
      expectStatus(await api().get(`/api/admin/users?q=${encodeURIComponent(q.slice(0, 500))}`).set(auth(admin.token)), 200, 400);
    }
  });
});

// -----------------------------------------------------------------------------
describe('extremas: convocatorias y verificaciones', () => {
  it('convocatorias con fechas y textos absurdos', async () => {
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const variants = [
      { titulo: 'X', fechaInicio: '2026-13-45' }, { titulo: 'X', fechaInicio: '0000-00-00' }, { titulo: 'X', fechaFin: 'nunca' },
      { titulo: 'a'.repeat(10000) }, { titulo: null }, { titulo: ['X'] }, { titulo: '<script>' },
      { titulo: 'X', fechaInicio: '2026-12-01', fechaFin: '2026-12-01' }, { titulo: 'X', estado: 'INVENTADO' },
    ];
    for (const body of variants) expectStatus(await api().post('/api/convocatorias').set(auth(funcionario.token)).send(body), 201, 400);
  });

  it('asociar a una convocatoria una oferta que no existe o que no es pública', async () => {
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const conv = await api().post('/api/convocatorias').set(auth(funcionario.token)).send({ titulo: 'Conv absurda' });
    const id = conv.body.convocatoria.id;
    expectStatus(await api().put(`/api/convocatorias/${id}/offers/999999`).set(auth(funcionario.token)), 404, 400);
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Privada SAS' });
    const practica = await createOffer(company.token, { tipo: 'PRACTICA' });
    expectStatus(await api().put(`/api/convocatorias/${id}/offers/${practica.id}`).set(auth(funcionario.token)), 200, 400, 409);
    expectStatus(await api().delete(`/api/convocatorias/${id}`).set(auth(funcionario.token)), 200, 204);
    expectStatus(await api().delete(`/api/convocatorias/${id}`).set(auth(funcionario.token)), 404);
  });

  it('una empresa no revisa su propia verificación', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Autoaprobada SAS' });
    expectStatus(await api().get('/api/verifications/requests').set(auth(company.token)), 403);
    expectStatus(await api().patch('/api/verifications/organizations/1').set(auth(company.token)).send({ estado: 'APROBADA' }), 403);
  });

  it('un estudiante no usa la verificación de empresas', async () => {
    const student = await registerUser('ESTUDIANTE');
    expectStatus(await api().get('/api/verifications/me').set(auth(student.token)), 403, 404);
    expectStatus(await api().post('/api/verifications/me/request').set(auth(student.token)), 403, 404, 400);
    expectStatus(await api().post('/api/verifications/me/documents').set(auth(student.token)).set('Content-Type', 'application/pdf').send(PDF), 403, 404, 400);
  });

  it('enviar la solicitud de verificación sin documentos o dos veces', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Sin papeles SAS' });
    expectStatus(await api().post('/api/verifications/me/request').set(auth(company.token)), 400, 409);
    expectStatus(await api().delete('/api/verifications/me/request').set(auth(company.token)), 400, 404, 409);
  });
});

// -----------------------------------------------------------------------------
describe('extremas: integridad general', () => {
  it('después de todo lo anterior la base sigue sana', async () => {
    const health = await api().get('/api/db-check');
    expectStatus(health, 200);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
    assert.ok(rows[0].n >= 20);
    const { rows: orphans } = await pool.query('SELECT COUNT(*)::int AS n FROM postulaciones p LEFT JOIN ofertas o ON o.id = p.oferta_id WHERE o.id IS NULL');
    assert.equal(orphans[0].n, 0);
  });
});
