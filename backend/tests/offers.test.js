import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  api,
  auth,
  closeDatabase,
  createOffer,
  futureDate,
  offerPayload,
  registerUser,
  resetDatabase,
} from './helpers.js';

before(resetDatabase);
after(closeDatabase);

describe('creación de ofertas', () => {
  it('solo una organización puede publicar', async () => {
    const student = await registerUser('ESTUDIANTE');
    const response = await api().post('/api/offers').set(auth(student.token)).send(offerPayload());
    assert.equal(response.status, 403);
    assert.equal((await api().post('/api/offers').send(offerPayload())).status, 401);
  });

  it('crea la oferta con fecha de publicación automática', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Tech SAS' });
    const offer = await createOffer(company.token);
    assert.equal(offer.estado, 'PUBLICADA');
    assert.ok(offer.fecha_publicacion);
    assert.deepEqual(offer.requisitos, ['JavaScript', 'SQL']);
  });

  it('usa BORRADOR y área General por defecto', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Borrador SAS' });
    const offer = await createOffer(company.token, { estado: undefined, area: undefined });
    assert.equal(offer.estado, 'BORRADOR');
    assert.equal(offer.area, 'General');
    assert.equal(offer.fecha_publicacion, null);
  });

  it('normaliza la modalidad y rechaza valores desconocidos', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Modal SAS' });
    const offer = await createOffer(company.token, { modalidad: 'remoto' });
    assert.equal(offer.modalidad, 'Remota');

    const bad = await api().post('/api/offers').set(auth(company.token)).send(offerPayload({ modalidad: 'nocturna' }));
    assert.equal(bad.status, 400);
  });

  it('valida campos, tipo, estado, salario, correo y fechas', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Valida SAS' });
    const invalid = [
      { titulo: '' },
      { tipo: 'VOLUNTARIADO' },
      { estado: 'ARCHIVADA' },
      { remuneracion: -5 },
      { remuneracion: 'mucho' },
      { remuneracion: 2000000, remuneracionMaxima: 1000000 },
      { contactoEmail: 'no-es-correo' },
      { fechaCierre: '2000-01-01' },
      { fechaCierre: 'mañana' },
    ];

    for (const override of invalid) {
      const response = await api().post('/api/offers').set(auth(company.token)).send(offerPayload(override));
      assert.equal(response.status, 400, JSON.stringify(override));
    }
  });
});

describe('consulta de ofertas', () => {
  it('el catálogo público solo muestra ofertas publicadas', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Catálogo SAS' });
    const published = await createOffer(company.token, { titulo: 'Visible' });
    const draft = await createOffer(company.token, { titulo: 'Oculta', estado: 'BORRADOR' });

    const list = await api().get('/api/offers');
    const ids = list.body.offers.map((offer) => offer.id);
    assert.ok(ids.includes(published.id));
    assert.ok(!ids.includes(draft.id));

    assert.equal((await api().get(`/api/offers/${published.id}`)).body.offer.empresa, 'Catálogo SAS');
    assert.equal((await api().get(`/api/offers/${draft.id}`)).status, 404);
  });

  it('la organización ve todas sus ofertas en /mine', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Mine SAS' });
    await createOffer(company.token);
    await createOffer(company.token, { estado: 'BORRADOR' });
    const response = await api().get('/api/offers/mine').set(auth(company.token));
    assert.equal(response.status, 200);
    assert.equal(response.body.offers.length, 2);

    const student = await registerUser('ESTUDIANTE');
    assert.equal((await api().get('/api/offers/mine').set(auth(student.token))).status, 403);
  });

  it('las recomendaciones priorizan la afinidad con el perfil', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Reco SAS' });
    const practice = await createOffer(company.token, { titulo: 'Práctica afín', area: 'Ingeniería', tipo: 'PRACTICA' });
    await createOffer(company.token, { titulo: 'Empleo lejano', area: 'Cocina', tipo: 'EMPLEO', ubicacion: 'Pasto' });

    const student = await registerUser('ESTUDIANTE', { programaAcademico: 'Ingeniería' });
    const response = await api().get('/api/offers/recommended').set(auth(student.token));
    assert.equal(response.status, 200);
    assert.equal(response.body.offers[0].id, practice.id);
    assert.ok(response.body.offers[0].recommendationScore > response.body.offers.at(-1).recommendationScore);

    assert.equal((await api().get('/api/offers/recommended').set(auth(company.token))).status, 403);
  });
});

describe('edición y cancelación', () => {
  it('actualiza solo los campos enviados y permite vaciar opcionales', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Edita SAS' });
    const offer = await createOffer(company.token, { horario: 'Mañanas' });

    const response = await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ titulo: 'Nuevo título', horario: '' });
    assert.equal(response.status, 200);
    assert.equal(response.body.offer.titulo, 'Nuevo título');
    assert.equal(response.body.offer.horario, null);
    assert.equal(response.body.offer.descripcion, offer.descripcion);
  });

  it('no permite vaciar campos obligatorios ni romper el rango salarial', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Rango SAS' });
    const offer = await createOffer(company.token, { tipo: 'EMPLEO', remuneracion: 2000000, remuneracionMaxima: 3000000 });

    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ titulo: '' })).status, 400);
    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ remuneracionMaxima: 100 })).status, 400);
  });

  it('registra la fecha de publicación al publicar un borrador', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Publica SAS' });
    const draft = await createOffer(company.token, { estado: 'BORRADOR' });
    const response = await api().patch(`/api/offers/${draft.id}`).set(auth(company.token)).send({ estado: 'PUBLICADA' });
    assert.equal(response.body.offer.estado, 'PUBLICADA');
    assert.ok(response.body.offer.fecha_publicacion);
  });

  it('una organización no puede editar ni cancelar ofertas ajenas', async () => {
    const owner = await registerUser('ORGANIZACION', { razonSocial: 'Dueña SAS' });
    const other = await registerUser('ORGANIZACION', { razonSocial: 'Ajena SAS' });
    const offer = await createOffer(owner.token);

    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(other.token)).send({ titulo: 'X' })).status, 404);
    assert.equal((await api().delete(`/api/offers/${offer.id}`).set(auth(other.token))).status, 404);
  });

  it('cancelar marca la oferta como CANCELADA y la saca del catálogo', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Cancela SAS' });
    const offer = await createOffer(company.token);

    const response = await api().delete(`/api/offers/${offer.id}`).set(auth(company.token));
    assert.equal(response.status, 200);
    assert.equal(response.body.deletedOfferId, Number(offer.id));
    assert.equal((await api().get(`/api/offers/${offer.id}`)).status, 404);
  });

  it('acepta una fecha de cierre futura al editar', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Fecha SAS' });
    const offer = await createOffer(company.token);
    const newDate = futureDate(60);
    const response = await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ fechaCierre: newDate });
    assert.equal(response.status, 200);
    assert.equal(new Date(response.body.offer.fecha_cierre).toISOString(), newDate);
  });
});
