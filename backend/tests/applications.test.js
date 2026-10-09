import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/config/database.js';
import { api, auth, closeDatabase, createOffer, registerUser, resetDatabase } from './helpers.js';

before(resetDatabase);
after(closeDatabase);

async function setup() {
  const company = await registerUser('ORGANIZACION', { razonSocial: `Empresa ${Date.now()}` });
  const offer = await createOffer(company.token);
  const student = await registerUser('ESTUDIANTE');
  return { company, offer, student };
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

  it('un candidato externo también puede postularse', async () => {
    const { offer } = await setup();
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
