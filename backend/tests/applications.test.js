import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/core/database/database.js';
import { api, auth, closeDatabase, createOffer, registerUser, resetDatabase } from './helpers.js';

before(resetDatabase);
after(closeDatabase);

async function setup() {
  const company = await registerUser('ORGANIZACION', { razonSocial: `Empresa ${Date.now()}` });
  const offer = await createOffer(company.token);
  const student = await registerUser('ESTUDIANTE');
  return { company, offer, student };
}

// PDF mínimo válido; `label` cambia el contenido para distinguir versiones.
const pdf = (label) => Buffer.concat([Buffer.from(`%PDF-1.4\n% ${label}\n`), Buffer.alloc(64, 0x20), Buffer.from('\n%%EOF')]);

function uploadProfileCv(token, body, name) {
  return api().put('/api/profile/files/cv').set(auth(token)).set('Content-Type', 'application/pdf')
    .set('X-File-Name', encodeURIComponent(name)).send(body);
}

function uploadApplicationCv(token, id, body, name = 'para-esta-oferta.pdf', mime = 'application/pdf') {
  return api().put(`/api/applications/${id}/cv`).set(auth(token)).set('Content-Type', mime)
    .set('X-File-Name', encodeURIComponent(name)).send(body);
}

// Descarga un archivo protegido como Buffer.
function download(token, path) {
  return api().get(path).set(auth(token)).buffer(true).parse((res, done) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
}

describe('postulaciones del candidato', () => {
  it('un estudiante se postula y ve su postulación', async () => {
    const { offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: 'Hola' });
    assert.equal(apply.status, 201);
    assert.equal(apply.body.application.estado, 'ENVIADA');

    const mine = await api().get('/api/applications/me').set(auth(student.token));
    assert.equal(mine.body.applications.length, 1);
    assert.equal(mine.body.applications[0].oferta_titulo, offer.titulo);
  });

  it('un candidato externo también puede postularse a un empleo', async () => {
    const { company } = await setup();
    // Las prácticas son solo para estudiantes; el externo se postula a empleos y formación.
    const offer = await createOffer(company.token, { tipo: 'EMPLEO', remuneracion: 2000000, remuneracionMaxima: 2500000 });
    const external = await registerUser('CANDIDATO_EXTERNO');
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(external.token));
    assert.equal(apply.status, 201);
  });

  it('no permite postular dos veces, incluso en paralelo', async () => {
    const { offer, student } = await setup();
    const [first, second] = await Promise.all([
      api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)),
      api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  });

  it('rechaza ofertas inexistentes, no publicadas o vencidas', async () => {
    const { company, student } = await setup();
    const draft = await createOffer(company.token, { estado: 'BORRADOR' });
    const expired = await createOffer(company.token);
    await pool.query(
      `UPDATE ofertas SET fecha_publicacion = NOW() - INTERVAL '10 days', fecha_cierre = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [expired.id]
    );

    assert.equal((await api().post('/api/applications/offers/999999').set(auth(student.token))).status, 404);
    assert.equal((await api().post(`/api/applications/offers/${draft.id}`).set(auth(student.token))).status, 400);
    assert.equal((await api().post(`/api/applications/offers/${expired.id}`).set(auth(student.token))).status, 400);
  });

  it('una organización no puede postularse', async () => {
    const { company, offer } = await setup();
    assert.equal((await api().post(`/api/applications/offers/${offer.id}`).set(auth(company.token))).status, 403);
  });

  it('el candidato puede retirar una postulación pendiente, no una resuelta', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    const other = await registerUser('ESTUDIANTE');
    assert.equal((await api().patch(`/api/applications/${id}/withdraw`).set(auth(other.token))).status, 404);

    const withdrawn = await api().patch(`/api/applications/${id}/withdraw`).set(auth(student.token));
    assert.equal(withdrawn.status, 200);
    assert.equal(withdrawn.body.application.estado, 'RETIRADA');
    assert.equal((await api().patch(`/api/applications/${id}/withdraw`).set(auth(student.token))).status, 409);

    const change = await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'ACEPTADA' });
    assert.equal(change.status, 409);
  });
});

describe('hoja de vida enviada con cada postulación', () => {
  it('cambiar la hoja de vida del perfil no altera la de postulaciones anteriores', async () => {
    const { company, offer, student } = await setup();
    const dataOffer = await createOffer(company.token, { titulo: 'Practicante de datos' });
    const software = pdf('software');
    const datos = pdf('datos');

    await uploadProfileCv(student.token, software, 'cv-software.pdf');
    const first = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    assert.equal(first.status, 201);
    assert.equal(first.body.application.cv.nombre, 'cv-software.pdf');

    await uploadProfileCv(student.token, datos, 'cv-datos.pdf');
    const second = await api().post(`/api/applications/offers/${dataOffer.id}`).set(auth(student.token));

    const firstCv = await download(company.token, `/api/applications/${first.body.application.id}/cv`);
    const secondCv = await download(company.token, `/api/applications/${second.body.application.id}/cv`);
    assert.equal(firstCv.status, 200);
    assert.ok(Buffer.compare(firstCv.body, software) === 0, 'la primera postulación conserva el CV de software');
    assert.ok(Buffer.compare(secondCv.body, datos) === 0, 'la segunda postulación usa el CV de datos');

    // Borrar la hoja de vida del perfil tampoco afecta lo ya enviado.
    await api().delete('/api/profile/files/cv').set(auth(student.token));
    assert.equal((await download(company.token, `/api/applications/${first.body.application.id}/cv`)).status, 200);

    const listed = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    assert.equal(listed.body.applications[0].tiene_cv, true);
    assert.equal(listed.body.applications[0].cv_nombre, 'cv-software.pdf');
    assert.equal(listed.body.applications[0].cv_origen, 'PERFIL');
  });

  it('la empresa ve la formación y las habilidades con que se postuló el candidato', async () => {
    const { company, offer, student } = await setup();
    await api().put('/api/profile/skills').set(auth(student.token)).send({ items: [{ categoria: 'Backend', nombre: 'Node.js' }] });
    await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));

    await api().put('/api/profile/skills').set(auth(student.token)).send({ items: [{ categoria: 'Datos', nombre: 'Python' }] });

    const listed = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    assert.deepEqual(listed.body.applications[0].habilidades, ['Node.js']);
    // El contacto sí es el vigente, para que la empresa pueda comunicarse.
    assert.equal(listed.body.applications[0].postulante_email, student.email);
  });

  it('el candidato sube una hoja de vida solo para una postulación mientras sigue Enviada', async () => {
    const { company, offer, student } = await setup();
    await uploadProfileCv(student.token, pdf('perfil'), 'perfil.pdf');
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cvPerfil: false, cartaPresentacion: '  Me interesa mucho.  ' });
    const id = apply.body.application.id;
    assert.equal(apply.body.application.cv, null);
    assert.equal(apply.body.application.carta_presentacion, 'Me interesa mucho.');
    assert.equal((await download(company.token, `/api/applications/${id}/cv`)).status, 404);

    const own = pdf('a la medida');
    const uploaded = await uploadApplicationCv(student.token, id, own, 'cv-a-la-medida.pdf');
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.body.cv.origen, 'PROPIO');

    const companyCopy = await download(company.token, `/api/applications/${id}/cv`);
    assert.ok(Buffer.compare(companyCopy.body, own) === 0);
    // El candidato también ve lo que envió; el perfil conserva su propio archivo.
    assert.ok(Buffer.compare((await download(student.token, `/api/applications/${id}/cv`)).body, own) === 0);
    assert.ok(Buffer.compare((await download(student.token, '/api/profile/files/cv')).body, pdf('perfil')) === 0);

    const mine = await api().get('/api/applications/me').set(auth(student.token));
    assert.equal(mine.body.applications[0].cv_nombre, 'cv-a-la-medida.pdf');

    assert.equal((await uploadApplicationCv(student.token, id, Buffer.from('no es pdf'))).status, 415);
    const intruder = await registerUser('ESTUDIANTE');
    assert.equal((await uploadApplicationCv(intruder.token, id, own)).status, 404);
    assert.equal((await download(intruder.token, `/api/applications/${id}/cv`)).status, 403);

    await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'EN_REVISION' });
    assert.equal((await uploadApplicationCv(student.token, id, own)).status, 409);
  });

  it('la migración copia la hoja de vida de las postulaciones anteriores', async () => {
    const { company, offer, student } = await setup();
    await uploadProfileCv(student.token, pdf('antiguo'), 'antiguo.pdf');
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;
    // Simula una postulación creada antes de la migración.
    await pool.query('UPDATE postulaciones SET hoja_vida = NULL WHERE id = $1', [id]);
    await pool.query('DELETE FROM postulacion_cv WHERE postulacion_id = $1', [id]);

    const file = new URL('../database/migrations/20261102_application_resume_snapshot.sql', import.meta.url);
    await pool.query(fs.readFileSync(file, 'utf8'));

    const row = await pool.query('SELECT hoja_vida FROM postulaciones WHERE id = $1', [id]);
    assert.equal(row.rows[0].hoja_vida.perfilTipo, 'ESTUDIANTE');
    assert.ok(Buffer.compare((await download(company.token, `/api/applications/${id}/cv`)).body, pdf('antiguo')) === 0);
  });

  it('limita el mensaje para la empresa', async () => {
    const { offer, student } = await setup();
    const long = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: 'x'.repeat(1501) });
    assert.equal(long.status, 400);
  });
});

describe('gestión por la organización', () => {
  it('lista los postulantes con sus datos de perfil', async () => {
    const { company, offer, student } = await setup();
    await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));

    const response = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    assert.equal(response.status, 200);
    assert.equal(response.body.applications.length, 1);
    assert.equal(response.body.applications[0].postulante_email, student.email);
    assert.equal(response.body.applications[0].perfil_tipo, 'ESTUDIANTE');
  });

  it('otra organización no ve ni modifica postulaciones ajenas', async () => {
    const { offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const other = await registerUser('ORGANIZACION', { razonSocial: 'Intrusa SAS' });

    assert.equal((await api().get(`/api/applications/offers/${offer.id}`).set(auth(other.token))).status, 403);
    const change = await api().patch(`/api/applications/${apply.body.application.id}/status`).set(auth(other.token)).send({ estado: 'ACEPTADA' });
    assert.equal(change.status, 403);
  });

  it('cambia el estado y valida los valores permitidos', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    const accepted = await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'aceptada' });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.application.estado, 'ACEPTADA');

    assert.equal((await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'RETIRADA' })).status, 400);
    assert.equal((await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'X' })).status, 400);
    assert.equal((await api().patch('/api/applications/999999/status').set(auth(company.token)).send({ estado: 'ACEPTADA' })).status, 404);
  });
});
