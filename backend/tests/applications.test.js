import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/core/database/database.js';
import { sentEmails } from '../src/core/mail/mailer.js';
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

    const review = await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'en_revision' });
    assert.equal(review.status, 200);
    assert.equal(review.body.application.estado, 'EN_REVISION');

    assert.equal((await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'RETIRADA' })).status, 400);
    assert.equal((await api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send({ estado: 'X' })).status, 400);
    assert.equal((await api().patch('/api/applications/999999/status').set(auth(company.token)).send({ estado: 'EN_REVISION' })).status, 404);
  });
});

// Entrevista válida dentro de `days` días.
const interview = (overrides = {}, days = 3) => ({
  fecha: new Date(Date.now() + days * 86400000).toISOString(),
  modalidad: 'VIRTUAL',
  lugar: 'https://meet.sipu.test/entrevista',
  duracionMinutos: 45,
  ...overrides,
});

const move = (company, id, body) => api().patch(`/api/applications/${id}/status`).set(auth(company.token)).send(body);

describe('proceso de selección', () => {
  it('recorre revisión, entrevista, reprogramación y aceptación con historial y avisos', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: 'Hola, me interesa.' });
    const id = apply.body.application.id;

    assert.equal((await move(company, id, { estado: 'EN_REVISION', mensaje: 'Estamos revisando tu perfil.' })).status, 200);

    sentEmails.length = 0;
    const cited = await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview(), mensaje: 'Prepárate para una prueba técnica.' });
    assert.equal(cited.status, 200);
    assert.equal(cited.body.application.estado, 'PRESELECCIONADA');
    assert.equal(cited.body.application.entrevista.modalidad, 'VIRTUAL');
    const invitation = sentEmails.find((mail) => mail.to === student.email);
    assert.ok(invitation?.subject.includes('te citó a entrevista'), 'avisa la entrevista por correo');
    assert.ok(invitation.text.includes('https://meet.sipu.test/entrevista'));
    assert.ok(invitation.text.includes('Prepárate para una prueba técnica.'));

    const moved = await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({ modalidad: 'presencial', lugar: 'Calle 67 # 22-31, Ibagué' }, 5) });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.application.entrevista.modalidad, 'PRESENCIAL');
    assert.ok(sentEmails.some((mail) => mail.to === student.email && mail.subject.includes('reprogramó')));

    const accepted = await move(company, id, { estado: 'ACEPTADA', mensaje: 'Te escribiremos para firmar el convenio.' });
    assert.equal(accepted.status, 200);
    // La decisión conserva la última entrevista como registro.
    assert.equal(accepted.body.application.entrevista.modalidad, 'PRESENCIAL');
    assert.ok(sentEmails.some((mail) => mail.to === student.email && mail.subject.includes('Fuiste seleccionado')));

    const mine = await api().get('/api/applications/me').set(auth(student.token));
    const events = mine.body.applications[0].eventos;
    assert.deepEqual(events.map((event) => event.tipo), ['POSTULACION', 'ESTADO', 'ENTREVISTA', 'ENTREVISTA', 'ESTADO']);
    assert.equal(events[0].mensaje, 'Hola, me interesa.');
    assert.equal(events[0].autorRol, 'CANDIDATO');
    assert.equal(events[4].autorRol, 'EMPRESA');
    assert.equal(events[4].mensaje, 'Te escribiremos para firmar el convenio.');
    assert.equal(events[1].autor, undefined, 'el candidato no ve nombres de usuarios de la empresa');
  });

  it('aplica las reglas de cada etapa', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    const skip = await move(company, id, { estado: 'ACEPTADA' });
    assert.equal(skip.status, 409);
    assert.match(skip.body.message, /citarlo a entrevista/);

    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA' })).status, 400, 'citar exige la entrevista');
    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({ lugar: 'meet.sipu.test' }) })).status, 400, 'el enlace virtual debe ser https');
    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({}, -1) })).status, 400, 'fecha pasada');
    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({ modalidad: 'PRESENCIAL', lugar: '' }) })).status, 400, 'presencial sin lugar');
    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({ duracionMinutos: 5 }) })).status, 400, 'duración mínima');
    assert.equal((await move(company, id, { estado: 'EN_REVISION', mensaje: 'x'.repeat(1001) })).status, 400, 'mensaje largo');

    // Citar directamente desde recibida está permitido (la empresa puede saltarse la revisión).
    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview({ modalidad: 'Telefónica', lugar: '' }) })).status, 200);
    assert.equal((await move(company, id, { estado: 'RECHAZADA', mensaje: 'Buscamos otro perfil.' })).status, 200);
    assert.equal((await move(company, id, { estado: 'ACEPTADA' })).status, 409, 'una decisión se reabre antes de cambiarla');

    const reopened = await move(company, id, { estado: 'EN_REVISION' });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.application.entrevista, null, 'volver a revisión borra la entrevista vigente');
    assert.equal((await move(company, id, { estado: 'ENVIADA' })).status, 409);
  });

  it('la formación no tiene entrevista: la inscripción se acepta directamente', async () => {
    const { company, student } = await setup();
    const course = await createOffer(company.token, { tipo: 'FORMACION', titulo: 'Curso de analítica de datos', remuneracion: null });
    const apply = await api().post(`/api/applications/offers/${course.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    assert.equal((await move(company, id, { estado: 'PRESELECCIONADA', entrevista: interview() })).status, 409);
    assert.equal((await move(company, id, { estado: 'ACEPTADA' })).status, 200);
  });

  it('las notas internas solo las ve la empresa', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    const note = await api().post(`/api/applications/${id}/notes`).set(auth(company.token)).send({ texto: '  Buen nivel de inglés.  ' });
    assert.equal(note.status, 201);
    assert.equal(note.body.event.privado, true);
    assert.equal(note.body.event.mensaje, 'Buen nivel de inglés.');
    assert.equal((await api().post(`/api/applications/${id}/notes`).set(auth(company.token)).send({ texto: ' ' })).status, 400);

    const other = await registerUser('ORGANIZACION', { razonSocial: 'Fisgona SAS' });
    assert.equal((await api().post(`/api/applications/${id}/notes`).set(auth(other.token)).send({ texto: 'Hola' })).status, 403);
    assert.equal((await api().post(`/api/applications/${id}/notes`).set(auth(student.token)).send({ texto: 'Hola' })).status, 403);

    const listed = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    const companyNote = listed.body.applications[0].eventos.find((event) => event.tipo === 'NOTA');
    assert.equal(companyNote.autor, 'Usuario ORGANIZACION');

    const mine = await api().get('/api/applications/me').set(auth(student.token));
    assert.ok(!mine.body.applications[0].eventos.some((event) => event.tipo === 'NOTA'));
  });

  it('califica de 1 a 5 y la calificación no llega al candidato', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;
    const rate = (token, calificacion) => api().patch(`/api/applications/${id}/rating`).set(auth(token)).send({ calificacion });

    assert.equal((await rate(company.token, 4)).body.application.calificacion, 4);
    assert.equal((await rate(company.token, 6)).status, 400);
    assert.equal((await rate(company.token, 2.5)).status, 400);
    assert.equal((await rate(student.token, 5)).status, 403);

    const listed = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    assert.equal(listed.body.applications[0].calificacion, 4);
    const mine = await api().get('/api/applications/me').set(auth(student.token));
    assert.equal(mine.body.applications[0].calificacion, undefined);

    assert.equal((await rate(company.token, null)).body.application.calificacion, null);
  });

  it('el retiro guarda el motivo en el historial', async () => {
    const { company, offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token));
    const id = apply.body.application.id;

    await api().patch(`/api/applications/${id}/withdraw`).set(auth(student.token)).send({ motivo: 'Acepté otra oferta.' });
    const listed = await api().get(`/api/applications/offers/${offer.id}`).set(auth(company.token));
    const withdrawal = listed.body.applications[0].eventos.find((event) => event.tipo === 'RETIRO');
    assert.equal(withdrawal.mensaje, 'Acepté otra oferta.');
    assert.equal(withdrawal.autorRol, 'CANDIDATO');
  });

  it('la migración reconstruye el historial de las postulaciones anteriores', async () => {
    const { offer, student } = await setup();
    const apply = await api().post(`/api/applications/offers/${offer.id}`).set(auth(student.token)).send({ cartaPresentacion: 'Postulación a Practicante' });
    const id = apply.body.application.id;
    await pool.query(`UPDATE postulaciones SET estado = 'ACEPTADA' WHERE id = $1`, [id]);
    await pool.query('DELETE FROM postulacion_eventos WHERE postulacion_id = $1', [id]);

    const file = new URL('../database/migrations/20261102_application_pipeline.sql', import.meta.url);
    await pool.query(fs.readFileSync(file, 'utf8'));
    await pool.query(fs.readFileSync(file, 'utf8'));

    const events = await pool.query('SELECT tipo, estado_nuevo, mensaje FROM postulacion_eventos WHERE postulacion_id = $1 ORDER BY id', [id]);
    assert.deepEqual(events.rows.map((row) => [row.tipo, row.estado_nuevo]), [['POSTULACION', 'ENVIADA'], ['ESTADO', 'ACEPTADA']]);
    assert.equal(events.rows[0].mensaje, null, 'el texto automático anterior no se muestra como mensaje');
  });
});
