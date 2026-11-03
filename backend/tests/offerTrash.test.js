// Papelera de ofertas: cancelar con motivo, aviso a candidatos, restaurar como
// borrador y borrado definitivo solo sin postulaciones.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/core/database/database.js';
import { sentEmails } from '../src/core/mail/mailer.js';
import { api, auth, closeDatabase, createOffer, futureDate, registerUser, resetDatabase } from './helpers.js';

before(resetDatabase);
after(closeDatabase);

const cancel = (token, id, body) => api().delete(`/api/offers/${id}`).set(auth(token)).send(body ?? {});
const restore = (token, id) => api().patch(`/api/offers/${id}/restore`).set(auth(token));
const purge = (token, id) => api().delete(`/api/offers/${id}/permanent`).set(auth(token));
const mine = async (token, id) => (await api().get('/api/offers/mine').set(auth(token))).body.offers.find((offer) => String(offer.id) === String(id));

describe('papelera de ofertas', () => {
  it('cancelar guarda fecha y motivo, avisa a las postulaciones abiertas y detiene el proceso', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Papelera SAS' });
    const offer = await createOffer(company.token);
    const open = await registerUser('ESTUDIANTE');
    const closed = await registerUser('ESTUDIANTE');
    const openApp = (await api().post(`/api/applications/offers/${offer.id}`).set(auth(open.token))).body.application;
    const closedApp = (await api().post(`/api/applications/offers/${offer.id}`).set(auth(closed.token))).body.application;
    await api().patch(`/api/applications/${closedApp.id}/withdraw`).set(auth(closed.token));

    assert.equal((await cancel(company.token, offer.id, { motivo: 'x'.repeat(301) })).status, 400, 'motivo demasiado largo');

    sentEmails.length = 0;
    const response = await cancel(company.token, offer.id, { motivo: 'La vacante ya se cubrió.' });
    assert.equal(response.status, 200);
    assert.equal(response.body.deletedOfferId, Number(offer.id));
    assert.equal(response.body.offer.estado, 'CANCELADA');
    assert.ok(response.body.offer.cancelada_at);
    assert.equal(response.body.offer.motivo_cancelacion, 'La vacante ya se cubrió.');
    assert.equal(response.body.notifiedApplications, 1, 'solo la postulación abierta');

    assert.equal((await api().get(`/api/offers/${offer.id}`)).status, 404, 'sale del catálogo');
    assert.equal((await mine(company.token, offer.id)).estado, 'CANCELADA', 'sigue en el panel de la empresa');

    const candidate = (await api().get('/api/applications/me').set(auth(open.token))).body.applications[0];
    assert.equal(candidate.oferta_estado, 'CANCELADA');
    assert.equal(candidate.estado, 'ENVIADA', 'la postulación no cambia de etapa');
    const event = candidate.eventos.find((item) => item.tipo === 'OFERTA');
    assert.equal(event.mensaje, 'La vacante ya se cubrió.');
    assert.equal(event.autorRol, 'EMPRESA');
    assert.ok(sentEmails.some((mail) => mail.to === open.email && mail.subject.includes('canceló la oferta')));
    assert.ok(!sentEmails.some((mail) => mail.to === closed.email), 'no avisa a quien ya retiró su postulación');

    const move = await api().patch(`/api/applications/${openApp.id}/status`).set(auth(company.token)).send({ estado: 'EN_REVISION' });
    assert.equal(move.status, 409);
    assert.match(move.body.message, /Restáurala/);

    assert.equal((await cancel(company.token, offer.id)).status, 409, 'ya está en la papelera');
    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ titulo: 'Otra cosa' })).status, 409, 'no se edita en la papelera');
  });

  it('restaurar la devuelve como borrador sin fecha ni motivo de cancelación', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Restaura SAS' });
    const offer = await createOffer(company.token);
    await cancel(company.token, offer.id, { motivo: 'Error al publicar' });

    const restored = await restore(company.token, offer.id);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.offer.estado, 'BORRADOR');
    assert.equal(restored.body.offer.cancelada_at, null);
    assert.equal(restored.body.offer.motivo_cancelacion, null);
    assert.equal((await restore(company.token, offer.id)).status, 409, 'solo se restauran canceladas');

    const republished = await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ estado: 'PUBLICADA', fechaCierre: futureDate(20) });
    assert.equal(republished.status, 200);
    assert.equal((await api().get(`/api/offers/${offer.id}`)).status, 200);
  });

  it('borra definitivamente solo ofertas canceladas sin postulaciones', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Definitiva SAS' });
    const empty = await createOffer(company.token, { titulo: 'Sin postulantes' });
    const withApplicants = await createOffer(company.token, { titulo: 'Con postulantes' });
    const student = await registerUser('ESTUDIANTE');
    await api().post(`/api/applications/offers/${withApplicants.id}`).set(auth(student.token));

    assert.equal((await purge(company.token, empty.id)).status, 409, 'primero va a la papelera');
    await cancel(company.token, empty.id);
    await cancel(company.token, withApplicants.id);

    const other = await registerUser('ORGANIZACION', { razonSocial: 'Ajena Papelera SAS' });
    assert.equal((await purge(other.token, empty.id)).status, 404);
    assert.equal((await restore(other.token, empty.id)).status, 404);

    const blocked = await purge(company.token, withApplicants.id);
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /1 postulación/);

    const deleted = await purge(company.token, empty.id);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deletedOfferId, Number(empty.id));
    assert.equal(await mine(company.token, empty.id), undefined);
    assert.ok(await mine(company.token, withApplicants.id), 'la oferta con postulaciones se conserva');
    // El candidato conserva su historial.
    assert.equal((await api().get('/api/applications/me').set(auth(student.token))).body.applications.length, 1);
  });

  it('no permite cancelar por PATCH, saltándose la papelera', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Atajo SAS' });
    const offer = await createOffer(company.token);
    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ estado: 'CANCELADA' })).status, 400);
  });

  it('la migración fecha las ofertas canceladas antes y admite el evento OFERTA', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Antigua Papelera SAS' });
    const offer = await createOffer(company.token);
    await pool.query(`UPDATE ofertas SET estado = 'CANCELADA', cancelada_at = NULL WHERE id = $1`, [offer.id]);

    const file = new URL('../database/migrations/20261103_offer_trash.sql', import.meta.url);
    await pool.query(fs.readFileSync(file, 'utf8'));
    await pool.query(fs.readFileSync(file, 'utf8'));

    const row = await pool.query('SELECT cancelada_at FROM ofertas WHERE id = $1', [offer.id]);
    assert.ok(row.rows[0].cancelada_at);
  });
});
