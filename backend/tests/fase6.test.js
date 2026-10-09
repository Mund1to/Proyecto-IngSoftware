import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { pool } from '../src/config/database.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../src/middleware/rateLimit.middleware.js';
import { sentEmails } from '../src/utils/mailer.js';
import {
  PASSWORD,
  api,
  auth,
  closeDatabase,
  createOffer,
  registerUser,
  resetDatabase,
} from './helpers.js';

before(resetDatabase);
after(closeDatabase);
beforeEach(() => {
  loginRateLimiter.reset();
  passwordResetRateLimiter.reset();
});

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20), Buffer.from('\n%%EOF')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

function upload(token, tipo, body, mime, name = 'archivo') {
  return api()
    .put(`/api/profile/files/${tipo}`)
    .set(auth(token))
    .set('Content-Type', mime)
    .set('X-File-Name', encodeURIComponent(name))
    .send(body);
}

describe('detalle del perfil en base de datos', () => {
  it('guarda y reemplaza educación, experiencia y habilidades', async () => {
    const { token } = await registerUser('ESTUDIANTE');

    const empty = await api().get('/api/profile/details').set(auth(token));
    assert.deepEqual(empty.body.details, { education: [], experience: [], skills: [] });

    const education = await api().put('/api/profile/education').set(auth(token)).send({
      items: [
        { titulo: 'Ingeniería de Sistemas', institucion: 'Unibagué', periodo: '2022 - actual' },
        { titulo: 'Bachiller', institucion: 'Colegio', periodo: '2016 - 2021' },
      ],
    });
    assert.equal(education.status, 200);
    assert.deepEqual(education.body.details.education.map((item) => item.titulo), ['Ingeniería de Sistemas', 'Bachiller']);

    const experience = await api().put('/api/profile/experience').set(auth(token)).send({
      items: [{ cargo: 'Monitor', empresa: 'Unibagué', periodo: '2024', descripcion: 'Apoyo en laboratorio' }],
    });
    assert.equal(experience.body.details.experience[0].descripcion, 'Apoyo en laboratorio');

    const skills = await api().put('/api/profile/skills').set(auth(token)).send({
      items: [{ categoria: 'Técnicas', nombre: 'SQL' }, { categoria: 'Idiomas', nombre: 'Inglés B1' }],
    });
    assert.equal(skills.body.details.skills.length, 2);

    const replaced = await api().put('/api/profile/education').set(auth(token)).send({ items: [] });
    assert.deepEqual(replaced.body.details.education, []);
    assert.equal(replaced.body.details.skills.length, 2);
  });

  it('valida los elementos y rechaza habilidades repetidas', async () => {
    const { token } = await registerUser('CANDIDATO_EXTERNO');
    assert.equal((await api().put('/api/profile/education').set(auth(token)).send({ items: 'x' })).status, 400);
    assert.equal((await api().put('/api/profile/education').set(auth(token)).send({ items: [{ titulo: 'Solo título' }] })).status, 400);
    assert.equal((await api().put('/api/profile/experience').set(auth(token)).send({ items: Array.from({ length: 31 }, () => ({ cargo: 'a', empresa: 'b', periodo: 'c' })) })).status, 400);

    const duplicated = await api().put('/api/profile/skills').set(auth(token)).send({
      items: [{ categoria: 'Backend', nombre: 'Node' }, { categoria: 'Backend', nombre: 'node' }],
    });
    assert.equal(duplicated.status, 400);
  });

  it('una organización no tiene hoja de vida', async () => {
    const { token } = await registerUser('ORGANIZACION', { razonSocial: 'Sin CV SAS' });
    assert.equal((await api().get('/api/profile/details').set(auth(token))).status, 404);
    assert.equal((await api().put('/api/profile/skills').set(auth(token)).send({ items: [] })).status, 404);
  });

  it('las habilidades guardadas mejoran las recomendaciones', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Datos SAS' });
    const target = await createOffer(company.token, { titulo: 'Analista', tipo: 'EMPLEO', requisitos: ['Python', 'Power BI'], area: 'Datos', ubicacion: 'Cali' });
    await createOffer(company.token, { titulo: 'Otra', tipo: 'EMPLEO', requisitos: ['Cocina'], area: 'Hotelería', ubicacion: 'Pasto' });

    const external = await registerUser('CANDIDATO_EXTERNO');
    await api().put('/api/profile/skills').set(auth(external.token)).send({ items: [{ categoria: 'Datos', nombre: 'Python' }, { categoria: 'Datos', nombre: 'Power BI' }] });

    const response = await api().get('/api/offers/recommended').set(auth(external.token));
    assert.equal(response.body.offers[0].id, target.id);
  });
});

describe('archivos del perfil', () => {
  it('sube, consulta, reemplaza y elimina la hoja de vida', async () => {
    const { token } = await registerUser('CANDIDATO_EXTERNO');

    const uploaded = await upload(token, 'cv', PDF, 'application/pdf', 'Hoja de vida ñ.pdf');
    assert.equal(uploaded.status, 201);
    assert.equal(uploaded.body.file.nombre, 'Hoja de vida ñ.pdf');
    assert.equal(uploaded.body.file.tamano, PDF.length);

    const me = await api().get('/api/profile/me').set(auth(token));
    assert.equal(me.body.user.archivos[0].tipo, 'CV');

    const file = await api().get('/api/profile/files/cv').set(auth(token)).buffer(true).parse((res, done) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'application/pdf');
    assert.ok(Buffer.compare(file.body, PDF) === 0);

    const replaced = await upload(token, 'cv', PDF, 'application/pdf', 'nuevo.pdf');
    assert.equal(replaced.body.file.nombre, 'nuevo.pdf');
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM archivos WHERE tipo = 'CV' AND nombre IN ('nuevo.pdf', 'Hoja de vida ñ.pdf')`);
    assert.equal(count.rows[0].total, 1);

    assert.equal((await api().delete('/api/profile/files/cv').set(auth(token))).status, 200);
    assert.equal((await api().get('/api/profile/files/cv').set(auth(token))).status, 404);
  });

  it('valida tipo, contenido real y tamaño', async () => {
    const { token } = await registerUser('ESTUDIANTE');

    assert.equal((await upload(token, 'cv', Buffer.from('no soy un pdf'), 'application/pdf')).status, 415);
    assert.equal((await upload(token, 'cv', PNG, 'image/png')).status, 415);
    assert.equal((await upload(token, 'foto', PDF, 'application/pdf')).status, 415);
    assert.equal((await upload(token, 'otro', PDF, 'application/pdf')).status, 404);
    assert.equal((await upload(token, 'cv', Buffer.alloc(0), 'application/pdf')).status, 400);

    const bigPhoto = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    assert.equal((await upload(token, 'foto', bigPhoto, 'image/png')).status, 413);

    const tooBig = Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024)]);
    assert.equal((await upload(token, 'cv', tooBig, 'application/pdf')).status, 413);
  });

  it('una organización puede subir foto pero no hoja de vida', async () => {
    const { token } = await registerUser('ORGANIZACION', { razonSocial: 'Logo SAS' });
    assert.equal((await upload(token, 'foto', PNG, 'image/png', 'logo.png')).status, 201);
    assert.equal((await upload(token, 'cv', PDF, 'application/pdf')).status, 404);
  });

  it('la empresa ve la hoja de vida estructurada y descarga el CV del postulante', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Recluta SAS' });
    const offer = await createOffer(company.token);
    const student = await registerUser('ESTUDIANTE');
    await upload(student.token, 'cv', PDF, 'application/pdf', 'cv.pdf');
    await api().put('/api/profile/skills').set(auth(student.token)).send({ items: [{ categoria: 'Técnicas', nombre: 'Java' }] });
    await api().put('/api/profile/education').set(auth(student.token)).send({ items: [{ titulo: 'Ingeniería', institucion: 'Unibagué', periodo: '2023' }] });
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));

    const list = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    const candidate = list.body.applications[0];
    assert.equal(candidate.tiene_cv, true);
    assert.deepEqual(candidate.habilidades, ['Java']);
    assert.equal(candidate.educacion[0].institucion, 'Unibagué');

    const cv = await api().get(`/api/applications/${apply.body.application.id}/cv`).set(auth(company.token));
    assert.equal(cv.status, 200);
    assert.equal(cv.headers['content-type'], 'application/pdf');

    const other = await registerUser('ORGANIZACION', { razonSocial: 'Curiosa SAS' });
    assert.equal((await api().get(`/api/applications/${apply.body.application.id}/cv`).set(auth(other.token))).status, 403);
    assert.equal((await api().get(`/api/applications/${apply.body.application.id}/cv`).set(auth(student.token))).status, 403);
  });
});

describe('recuperación de contraseña', () => {
  function lastResetToken(email) {
    const message = [...sentEmails].reverse().find((item) => item.to === email);
    return message?.text.match(/reset=([a-f0-9]{64})/)?.[1];
  }

  it('envía un enlace y permite restablecer la contraseña una sola vez', async () => {
    const { email, token: oldToken } = await registerUser('ESTUDIANTE');

    const forgot = await api().post('/api/auth/forgot-password').send({ email });
    assert.equal(forgot.status, 200);
    const resetToken = lastResetToken(email);
    assert.ok(resetToken, 'se esperaba un correo con el enlace');

    const reset = await api().post('/api/auth/reset-password').send({ token: resetToken, password: 'Recuperada123' });
    assert.equal(reset.status, 200);

    assert.equal((await api().post('/api/auth/login').send({ email, password: PASSWORD })).status, 401);
    assert.equal((await api().post('/api/auth/login').send({ email, password: 'Recuperada123' })).status, 200);

    // El enlace no se reutiliza y la sesión anterior se cierra.
    assert.equal((await api().post('/api/auth/reset-password').send({ token: resetToken, password: 'Otra12345' })).status, 400);
    assert.equal((await api().get('/api/profile/me').set(auth(oldToken))).status, 401);
  });

  it('responde igual si el correo no existe y no envía nada', async () => {
    const before = sentEmails.length;
    const response = await api().post('/api/auth/forgot-password').send({ email: 'nadie@sipu.test' });
    assert.equal(response.status, 200);
    assert.equal(sentEmails.length, before);
    assert.equal((await api().post('/api/auth/forgot-password').send({ email: 'mal' })).status, 400);
  });

  it('solo el último enlace es válido y los vencidos se rechazan', async () => {
    const { email } = await registerUser('CANDIDATO_EXTERNO');
    await api().post('/api/auth/forgot-password').send({ email });
    const first = lastResetToken(email);
    await api().post('/api/auth/forgot-password').send({ email });
    const second = lastResetToken(email);
    assert.notEqual(first, second);

    assert.equal((await api().post('/api/auth/reset-password').send({ token: first, password: 'Nueva12345' })).status, 400);

    await pool.query(`UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute' WHERE used_at IS NULL`);
    assert.equal((await api().post('/api/auth/reset-password').send({ token: second, password: 'Nueva12345' })).status, 400);
  });

  it('valida token y contraseña', async () => {
    assert.equal((await api().post('/api/auth/reset-password').send({ token: 'abc', password: 'Nueva12345' })).status, 400);
    assert.equal((await api().post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'corta' })).status, 400);
  });

  it('cambiar la contraseña cierra las demás sesiones pero devuelve un token nuevo', async () => {
    const { email, token } = await registerUser('ESTUDIANTE');
    const otherSession = (await api().post('/api/auth/login').send({ email, password: PASSWORD })).body.token;

    const change = await api().put('/api/profile/password').set(auth(token)).send({ currentPassword: PASSWORD, newPassword: 'Cambiada123' });
    assert.equal(change.status, 200);
    assert.ok(change.body.token);

    assert.equal((await api().get('/api/profile/me').set(auth(change.body.token))).status, 200);
    assert.equal((await api().get('/api/profile/me').set(auth(otherSession))).status, 401);
  });
});

describe('ofertas de formación', () => {
  it('crea y lista ofertas FORMACION sin remuneración', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Academia SAS' });
    const course = await createOffer(company.token, { titulo: 'Curso de SQL', tipo: 'FORMACION', remuneracion: null });
    assert.equal(course.tipo, 'FORMACION');

    const student = await registerUser('ESTUDIANTE');
    const apply = await api().post(`/api/applications/offers/${course.id}`).set(auth(student.token));
    assert.equal(apply.status, 201);

    const stats = await api().get('/api/offers');
    assert.ok(stats.body.offers.some((offer) => offer.tipo === 'FORMACION'));
  });
});

describe('Perfil sin fila de detalle', () => {
  it('el candidato externo guarda su nombre aunque falte la fila en perfiles_candidato', async () => {
    const { token, user } = await registerUser('CANDIDATO_EXTERNO');
    await pool.query(
      `DELETE FROM perfiles_candidato pc USING perfiles p
       WHERE pc.perfil_id = p.id AND p.usuario_id = $1`,
      [user.id]
    );

    const response = await api()
      .put('/api/profile/external')
      .set(auth(token))
      .send({ nombreCompleto: 'Nombre Corregido', resumen: 'Analista' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user.nombreCompleto ?? response.body.user.nombre_completo, 'Nombre Corregido');
  });

  it('el estudiante guarda su perfil aunque falte la fila en perfiles_estudiante', async () => {
    const { token, user } = await registerUser('ESTUDIANTE');
    await pool.query(
      `DELETE FROM perfiles_estudiante pe USING perfiles p
       WHERE pe.perfil_id = p.id AND p.usuario_id = $1`,
      [user.id]
    );

    const response = await api().put('/api/profile/student').set(auth(token)).send({ semestre: 5 });

    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});
