import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sentEmails } from '../src/core/mail/mailer.js';
import {
  api,
  auth,
  closeDatabase,
  createAdmin,
  createOffer,
  registerUser,
  resetDatabase,
} from './helpers.js';

before(resetDatabase);
after(closeDatabase);

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20), Buffer.from('\n%%EOF')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

function uploadDocument(token, tipo, body = PDF, mime = 'application/pdf', name = `${tipo}.pdf`) {
  const request = api().post('/api/verifications/me/documents').set(auth(token)).set('Content-Type', mime).set('X-File-Name', encodeURIComponent(name));
  return (tipo ? request.query({ tipo }) : request).send(body);
}

const getState = async (token) => (await api().get('/api/verifications/me').set(auth(token))).body.verification;

// Empresa con NIT y los dos documentos obligatorios, lista para enviar la solicitud.
async function readyCompany(razonSocial) {
  const company = await registerUser('ORGANIZACION', { razonSocial });
  await api().put('/api/profile/organization').set(auth(company.token)).send({ identificacionFiscal: `NIT-${Date.now()}-${Math.random()}` });
  await uploadDocument(company.token, 'RUT');
  await uploadDocument(company.token, 'CAMARA_COMERCIO', PNG, 'image/png', 'camara.png');
  return company;
}

const submit = (token, mensaje) => api().post('/api/verifications/me/request').set(auth(token)).send(mensaje ? { mensaje } : {});

async function pendingRequestFor(reviewerToken, razonSocial) {
  const list = await api().get('/api/verifications/requests').set(auth(reviewerToken));
  return list.body.requests.find((request) => request.organizacion.razonSocial === razonSocial);
}

describe('verificación documental: la empresa', () => {
  it('muestra el estado inicial con los requisitos pendientes', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Inicial SAS' });
    const response = await api().get('/api/verifications/me').set(auth(company.token));

    assert.equal(response.status, 200);
    const state = response.body.verification;
    assert.equal(state.estado, 'SIN_SOLICITUD');
    assert.equal(state.verificada, false);
    assert.equal(state.solicitud, null);
    assert.deepEqual(state.documentos, []);
    assert.deepEqual(state.faltantes, ['NIT', 'RUT', 'CAMARA_COMERCIO']);
    assert.equal(state.puedeEnviar, false);
    assert.equal(state.bloqueada, false);
    assert.deepEqual(state.requisitos.tipos.filter((tipo) => tipo.obligatorio).map((tipo) => tipo.tipo), ['RUT', 'CAMARA_COMERCIO']);
  });

  it('solo una organización usa la verificación', async () => {
    const student = await registerUser('ESTUDIANTE');
    assert.equal((await api().get('/api/verifications/me').set(auth(student.token))).status, 403);
    assert.equal((await uploadDocument(student.token, 'RUT')).status, 403);
    assert.equal((await submit(student.token)).status, 403);
    assert.equal((await api().get('/api/verifications/me')).status, 401);
  });

  it('valida tipo, contenido y tamaño de cada documento', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Validación SAS' });

    assert.equal((await uploadDocument(company.token, null)).status, 400);
    assert.equal((await uploadDocument(company.token, 'PASAPORTE')).status, 400);
    assert.equal((await uploadDocument(company.token, 'RUT', Buffer.alloc(0))).status, 400);
    // Texto renombrado como PDF: la firma no coincide.
    assert.equal((await uploadDocument(company.token, 'RUT', Buffer.from('hola mundo'), 'application/pdf')).status, 415);
    assert.equal((await uploadDocument(company.token, 'RUT', PNG, 'image/gif')).status, 415);
    const tooBig = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)]);
    assert.equal((await uploadDocument(company.token, 'RUT', tooBig)).status, 413);

    const ok = await uploadDocument(company.token, 'rut', PDF, 'application/pdf', 'RUT 2026.pdf');
    assert.equal(ok.status, 201);
    assert.equal(ok.body.document.tipo, 'RUT');
    assert.equal(ok.body.document.nombre, 'RUT 2026.pdf');
    assert.deepEqual(ok.body.verification.faltantes, ['NIT', 'CAMARA_COMERCIO']);
  });

  it('descarga y elimina sus documentos, pero no los de otra empresa', async () => {
    const owner = await registerUser('ORGANIZACION', { razonSocial: 'Dueña SAS' });
    const other = await registerUser('ORGANIZACION', { razonSocial: 'Otra SAS' });
    const { document } = (await uploadDocument(owner.token, 'OTRO', PNG, 'image/png', 'logo.png')).body;

    const download = await api().get(`/api/verifications/me/documents/${document.id}`).set(auth(owner.token)).buffer(true);
    assert.equal(download.status, 200);
    assert.equal(download.headers['content-type'], 'image/png');
    assert.equal(download.headers['x-content-type-options'], 'nosniff');
    assert.equal((await api().get(`/api/verifications/me/documents/${document.id}`).set(auth(other.token))).status, 404);
    assert.equal((await api().delete(`/api/verifications/me/documents/${document.id}`).set(auth(other.token))).status, 404);
    assert.equal((await api().get('/api/verifications/me/documents/abc').set(auth(owner.token))).status, 400);

    const removed = await api().delete(`/api/verifications/me/documents/${document.id}`).set(auth(owner.token));
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.verification.documentos, []);
  });

  it('limita la cantidad de documentos', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Muchos SAS' });
    for (let index = 0; index < 10; index += 1) {
      assert.equal((await uploadDocument(company.token, 'OTRO')).status, 201);
    }
    assert.equal((await uploadDocument(company.token, 'OTRO')).status, 409);
  });

  it('exige NIT y documentos obligatorios para enviar la solicitud', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Requisitos SAS' });
    await uploadDocument(company.token, 'RUT');

    const withoutNit = await submit(company.token);
    assert.equal(withoutNit.status, 400);
    assert.match(withoutNit.body.message, /NIT/);

    await api().put('/api/profile/organization').set(auth(company.token)).send({ identificacionFiscal: '900123456-1' });
    const withoutCamara = await submit(company.token);
    assert.equal(withoutCamara.status, 400);
    assert.match(withoutCamara.body.message, /Cámara de Comercio/);

    assert.equal((await submit(company.token, 'x'.repeat(1001))).status, 400);
  });

  it('envía la solicitud, bloquea los documentos y avisa a los revisores', async () => {
    const admin = await createAdmin();
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const company = await readyCompany('Envío SAS');
    const before = await getState(company.token);
    assert.equal(before.puedeEnviar, true);

    const sent = await submit(company.token, 'Adjuntamos RUT y Cámara de Comercio vigentes.');
    assert.equal(sent.status, 201);
    const state = sent.body.verification;
    assert.equal(state.estado, 'PENDIENTE');
    assert.equal(state.bloqueada, true);
    assert.equal(state.puedeEnviar, false);
    assert.equal(state.solicitud.mensaje, 'Adjuntamos RUT y Cámara de Comercio vigentes.');
    assert.equal(state.solicitud.enviadaPorEmpresa, true);

    const notices = sentEmails.filter((email) => email.subject === 'Nueva solicitud de verificación: Envío SAS');
    assert.deepEqual(notices.map((email) => email.to).sort(), [admin.email, funcionario.email].sort());

    assert.equal((await submit(company.token)).status, 409);
    assert.equal((await uploadDocument(company.token, 'OTRO')).status, 409);
    const documentId = state.documentos[0].id;
    assert.equal((await api().delete(`/api/verifications/me/documents/${documentId}`).set(auth(company.token))).status, 409);
  });

  it('retira la solicitud pendiente para corregir los documentos', async () => {
    const admin = await createAdmin();
    const company = await readyCompany('Retiro SAS');
    await submit(company.token);

    const withdrawn = await api().delete('/api/verifications/me/request').set(auth(company.token));
    assert.equal(withdrawn.status, 200);
    assert.equal(withdrawn.body.verification.estado, 'SIN_SOLICITUD');
    assert.equal(withdrawn.body.verification.bloqueada, false);
    assert.equal(await pendingRequestFor(admin.token, 'Retiro SAS'), undefined);
    assert.equal((await api().delete('/api/verifications/me/request').set(auth(company.token))).status, 404);
  });
});

describe('verificación documental: la revisión', () => {
  it('solo administradores y funcionarios ven la bandeja y los documentos', async () => {
    const company = await readyCompany('Privada SAS');
    await submit(company.token);
    const documentId = (await getState(company.token)).documentos[0].id;

    for (const path of ['/api/verifications/requests', '/api/verifications/requests/summary', `/api/verifications/documents/${documentId}`]) {
      assert.equal((await api().get(path).set(auth(company.token))).status, 403, path);
    }
    assert.equal((await api().patch('/api/verifications/requests/1').set(auth(company.token)).send({ estado: 'APROBADA' })).status, 403);
  });

  it('lista la solicitud con la empresa, el contacto y los documentos enviados', async () => {
    const admin = await createAdmin();
    const company = await readyCompany('Bandeja SAS');
    await submit(company.token, 'Por favor revisar.');

    const summary = await api().get('/api/verifications/requests/summary').set(auth(admin.token));
    assert.equal(summary.status, 200);
    assert.ok(summary.body.pendientes >= 1);

    const request = await pendingRequestFor(admin.token, 'Bandeja SAS');
    assert.equal(request.estado, 'PENDIENTE');
    assert.equal(request.mensaje, 'Por favor revisar.');
    assert.equal(request.solicitante.email, company.email);
    assert.ok(request.organizacion.identificacionFiscal);
    assert.deepEqual(request.documentos.map((document) => document.tipo), ['RUT', 'CAMARA_COMERCIO']);

    const download = await api().get(`/api/verifications/documents/${request.documentos[0].id}`).set(auth(admin.token)).buffer(true);
    assert.equal(download.status, 200);
    assert.equal(download.headers['content-type'], 'application/pdf');
    assert.equal(download.headers['cache-control'], 'private, no-store');
    assert.equal((await api().get('/api/verifications/documents/999999').set(auth(admin.token))).status, 404);
  });

  it('rechaza con motivo, la empresa corrige y un funcionario aprueba', async () => {
    const admin = await createAdmin();
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const company = await readyCompany('Ciclo SAS');
    await submit(company.token);
    const first = await pendingRequestFor(admin.token, 'Ciclo SAS');

    assert.equal((await api().patch(`/api/verifications/requests/${first.id}`).set(auth(admin.token)).send({ estado: 'RECHAZADA' })).status, 400);
    assert.equal((await api().patch(`/api/verifications/requests/${first.id}`).set(auth(admin.token)).send({ estado: 'PENDIENTE' })).status, 400);

    const rejected = await api().patch(`/api/verifications/requests/${first.id}`).set(auth(admin.token)).send({
      estado: 'RECHAZADA',
      observaciones: 'El certificado de Cámara de Comercio está vencido.',
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.organization.verificada, false);
    assert.equal(rejected.body.request.estado, 'RECHAZADA');
    assert.equal((await api().patch(`/api/verifications/requests/${first.id}`).set(auth(admin.token)).send({ estado: 'APROBADA' })).status, 409);

    const rejectionEmail = sentEmails.findLast((email) => email.to === company.email);
    assert.match(rejectionEmail.subject, /Revisa la verificación de Ciclo SAS/);
    assert.match(rejectionEmail.text, /vencido/);

    const afterReject = await getState(company.token);
    assert.equal(afterReject.estado, 'RECHAZADA');
    assert.equal(afterReject.solicitud.observaciones, 'El certificado de Cámara de Comercio está vencido.');
    assert.equal(afterReject.bloqueada, false);
    assert.equal(afterReject.puedeEnviar, true);

    // La empresa reemplaza el certificado y vuelve a enviar.
    const camara = afterReject.documentos.find((document) => document.tipo === 'CAMARA_COMERCIO');
    await api().delete(`/api/verifications/me/documents/${camara.id}`).set(auth(company.token));
    await uploadDocument(company.token, 'CAMARA_COMERCIO', PDF, 'application/pdf', 'camara-2026.pdf');
    assert.equal((await submit(company.token, 'Certificado actualizado.')).status, 201);

    const second = await pendingRequestFor(funcionario.token, 'Ciclo SAS');
    assert.notEqual(second.id, first.id);
    const approved = await api().patch(`/api/verifications/requests/${second.id}`).set(auth(funcionario.token)).send({ estado: 'APROBADA' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.organization.verificada, true);
    assert.match(sentEmails.findLast((email) => email.to === company.email).subject, /ya está verificada/);

    const afterApprove = await getState(company.token);
    assert.equal(afterApprove.estado, 'APROBADA');
    assert.equal(afterApprove.bloqueada, true);
    assert.equal(afterApprove.solicitud.revisor, 'Admin FUNCIONARIO_PUBLICO');
    assert.equal((await uploadDocument(company.token, 'OTRO')).status, 409);
    assert.equal((await submit(company.token)).status, 409);

    const offer = await createOffer(company.token);
    assert.equal((await api().get(`/api/offers/${offer.id}`)).body.offer.verificada, true);

    // El historial conserva las dos solicitudes con los documentos de cada envío.
    const history = await api().get('/api/verifications/requests').query({ estado: 'TODAS' }).set(auth(admin.token));
    const own = history.body.requests.filter((request) => request.organizacion.razonSocial === 'Ciclo SAS');
    assert.deepEqual(own.map((request) => request.estado), ['APROBADA', 'RECHAZADA']);
    assert.deepEqual(own[1].documentos.map((document) => document.nombre), ['RUT.pdf', 'camara.png']);
    assert.deepEqual(own[0].documentos.map((document) => document.nombre), ['RUT.pdf', 'camara-2026.pdf']);
  });

  it('la decisión directa sobre la organización resuelve su solicitud pendiente', async () => {
    const admin = await createAdmin();
    const company = await readyCompany('Directa SAS');
    await submit(company.token);
    const request = await pendingRequestFor(admin.token, 'Directa SAS');

    const response = await api().patch(`/api/verifications/organizations/${request.organizacion.id}`).set(auth(admin.token)).send({ estado: 'APROBADA' });
    assert.equal(response.status, 200);
    assert.equal(await pendingRequestFor(admin.token, 'Directa SAS'), undefined);

    const approved = await api().get('/api/verifications/requests').query({ estado: 'APROBADA' }).set(auth(admin.token));
    assert.ok(approved.body.requests.some((item) => item.id === request.id));
  });

  it('valida filtros, paginación e identificadores', async () => {
    const admin = await createAdmin();
    assert.equal((await api().get('/api/verifications/requests').query({ estado: 'QUIZAS' }).set(auth(admin.token))).status, 400);
    assert.equal((await api().patch('/api/verifications/requests/abc').set(auth(admin.token)).send({ estado: 'APROBADA' })).status, 400);
    assert.equal((await api().patch('/api/verifications/requests/999999').set(auth(admin.token)).send({ estado: 'APROBADA' })).status, 404);

    const page = await api().get('/api/verifications/requests').query({ estado: 'TODAS', limit: 1, page: 2 }).set(auth(admin.token));
    assert.equal(page.status, 200);
    assert.equal(page.body.limit, 1);
    assert.equal(page.body.page, 2);
    assert.equal(page.body.requests.length, 1);
    assert.ok(page.body.total >= 2);

    const capped = await api().get('/api/verifications/requests').query({ limit: 500, page: -3 }).set(auth(admin.token));
    assert.equal(capped.body.limit, 50);
    assert.equal(capped.body.page, 1);
  });
});
