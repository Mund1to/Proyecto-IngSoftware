import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pool } from '../src/core/database/database.js';
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
      // El rango salarial aplica al empleo; la práctica usa un solo valor.
      { tipo: 'EMPLEO', remuneracion: 2000000, remuneracionMaxima: 1000000 },
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

  it('las prácticas son solo para estudiantes: el externo no las recibe ni puede postularse', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Audiencia SAS' });
    const practice = await createOffer(company.token, { titulo: 'Práctica solo estudiantes', tipo: 'PRACTICA' });
    const job = await createOffer(company.token, { titulo: 'Empleo para todos', tipo: 'EMPLEO', remuneracion: 2000000, remuneracionMaxima: 2500000 });

    const external = await registerUser('CANDIDATO_EXTERNO');
    const recommended = await api().get('/api/offers/recommended').set(auth(external.token));
    const ids = recommended.body.offers.map((offer) => String(offer.id));
    assert.ok(!ids.includes(String(practice.id)));
    assert.ok(ids.includes(String(job.id)));
    assert.ok(recommended.body.offers.every((offer) => offer.tipo !== 'PRACTICA'));

    const blocked = await api().post(`/api/applications/offers/${practice.id}`).set(auth(external.token));
    assert.equal(blocked.status, 403);
    assert.equal((await api().post(`/api/applications/offers/${job.id}`).set(auth(external.token))).status, 201);

    const student = await registerUser('ESTUDIANTE');
    assert.equal((await api().post(`/api/applications/offers/${practice.id}`).set(auth(student.token))).status, 201);
  });

  it('mis ofertas incluyen el conteo de postulaciones por estado y los nuevos de la semana', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Conteo SAS' });
    const offer = await createOffer(company.token, { titulo: 'Oferta con postulantes' });
    const empty = await createOffer(company.token, { titulo: 'Oferta sin postulantes' });

    const first = await registerUser('ESTUDIANTE');
    const second = await registerUser('ESTUDIANTE');
    const applied = await api().post(`/api/applications/offers/${offer.id}`).set(auth(first.token));
    await api().post(`/api/applications/offers/${offer.id}`).set(auth(second.token));
    // Fase 8: citar a entrevista exige fecha, modalidad y lugar o enlace.
    const cited = await api().patch(`/api/applications/${applied.body.application.id}/status`).set(auth(company.token)).send({
      estado: 'PRESELECCIONADA',
      entrevista: { fecha: futureDate(2), modalidad: 'VIRTUAL', lugar: 'https://meet.conteo.test/sala' },
    });
    assert.equal(cited.status, 200);

    const response = await api().get('/api/offers/mine').set(auth(company.token));
    assert.equal(response.status, 200);
    const withApplicants = response.body.offers.find((item) => String(item.id) === String(offer.id));
    assert.deepEqual(withApplicants.conteo_estados, { ENVIADA: 1, PRESELECCIONADA: 1 });
    assert.equal(withApplicants.nuevos_semana, 2);

    const withoutApplicants = response.body.offers.find((item) => String(item.id) === String(empty.id));
    assert.deepEqual(withoutApplicants.conteo_estados, {});
    assert.equal(withoutApplicants.nuevos_semana, 0);
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
    for (const offer of response.body.offers) {
      assert.ok(Number.isInteger(offer.affinity) && offer.affinity >= 0 && offer.affinity <= 100, `affinity fuera de rango: ${offer.affinity}`);
    }
    assert.ok(response.body.offers[0].affinity > response.body.offers.at(-1).affinity);

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

describe('requisitos estructurados y reglas de publicación (Fase 8)', () => {
  const post = (token, overrides) => api().post('/api/offers').set(auth(token)).send(offerPayload(overrides));

  it('guarda programas, habilidades, experiencia, idiomas, jornada, beneficios y vacantes', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Estructura SAS' });
    const offer = await createOffer(company.token, {
      programas: ['Ingeniería de Sistemas', 'ingeniería de sistemas', 'Ingeniería Electrónica'],
      semestreMinimo: 7,
      habilidades: [' React ', 'react', 'SQL'],
      experiencia: 'ninguna',
      idiomas: [{ idioma: 'Inglés', nivel: 'b1' }],
      jornada: 'medio_tiempo',
      beneficios: ['Horario flexible', 'Capacitación'],
      vacantes: 2,
      requisitos: [],
    });

    assert.deepEqual(offer.programas, ['Ingeniería de Sistemas', 'Ingeniería Electrónica']);
    assert.deepEqual(offer.habilidades, ['React', 'SQL']);
    assert.equal(offer.semestre_minimo, 7);
    assert.equal(offer.experiencia, 'NINGUNA');
    assert.deepEqual(offer.idiomas, [{ idioma: 'Inglés', nivel: 'B1' }]);
    assert.equal(offer.jornada, 'MEDIO_TIEMPO');
    assert.deepEqual(offer.beneficios, ['Horario flexible', 'Capacitación']);
    assert.equal(offer.vacantes, 2);

    const published = await api().get(`/api/offers/${offer.id}`);
    assert.deepEqual(published.body.offer.habilidades, ['React', 'SQL']);
  });

  it('no publica ofertas con texto sin sentido o incompletas e informa cada campo', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Calidad SAS' });

    const gibberish = await post(company.token, { descripcion: 'sasadasd' });
    assert.equal(gibberish.status, 400);
    assert.ok(gibberish.body.errors.descripcion);

    const several = await post(company.token, { titulo: 'X1', descripcion: 'corta', habilidades: [] });
    assert.equal(several.status, 400);
    assert.deepEqual(Object.keys(several.body.errors).sort(), ['descripcion', 'habilidades', 'titulo']);
    assert.match(several.body.message, /Completa la oferta/);

    const cases = [
      [{ experiencia: 'DE_3_A_5' }, 'experiencia'],
      [{ remuneracion: 0 }, 'remuneracion'],
      [{ tipo: 'EMPLEO', remuneracion: null }, 'remuneracion'],
      [{ ubicacion: '' }, 'ubicacion'],
      [{ contactoEmail: '' }, 'contacto_email'],
      [{ fechaCierre: null }, 'fecha_cierre'],
    ];
    for (const [override, field] of cases) {
      const response = await post(company.token, override);
      assert.equal(response.status, 400, JSON.stringify(override));
      assert.ok(response.body.errors?.[field], `${field}: ${JSON.stringify(response.body)}`);
    }

    const invalid = [
      { experiencia: 'MUCHA' },
      { jornada: 'NOCTURNA' },
      { idiomas: [{ idioma: 'Inglés', nivel: 'Avanzado' }] },
      { idiomas: 'Inglés' },
      { habilidades: Array.from({ length: 16 }, (_, index) => `Habilidad ${index}`) },
      { habilidades: ['x'] },
      { vacantes: 0 },
      { semestreMinimo: 15 },
      { fechaCierre: futureDate(400) },
      { remuneracion: 1e10 },
    ];
    for (const override of invalid) {
      assert.equal((await post(company.token, override)).status, 400, JSON.stringify(override));
    }
  });

  it('una práctica puede no tener apoyo económico; la formación nunca lleva salario', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Tipos SAS' });
    const unpaid = await createOffer(company.token, { remuneracion: null, remuneracionMaxima: 2000000 });
    assert.equal(unpaid.remuneracion, null);
    assert.equal(unpaid.remuneracion_maxima, null, 'la práctica usa un solo valor');

    const course = await createOffer(company.token, { tipo: 'FORMACION', remuneracion: 900000, experiencia: 'MAS_5', semestreMinimo: 4 });
    assert.equal(course.remuneracion, null);
    assert.equal(course.experiencia, null);
    assert.equal(course.semestre_minimo, null);

    const job = await createOffer(company.token, { tipo: 'EMPLEO', remuneracion: 2500000, semestreMinimo: 6, experiencia: 'DE_1_A_2' });
    assert.equal(job.semestre_minimo, null, 'solo la práctica pide semestre');
    assert.equal(job.experiencia, 'DE_1_A_2');
  });

  it('un borrador puede estar incompleto, pero se revisa completo al publicarlo', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Borrador Fase 8 SAS' });
    const draft = await createOffer(company.token, { estado: 'BORRADOR', descripcion: 'Pendiente de redactar.', habilidades: [] });
    assert.equal(draft.estado, 'BORRADOR');

    const publish = await api().patch(`/api/offers/${draft.id}`).set(auth(company.token)).send({ estado: 'PUBLICADA' });
    assert.equal(publish.status, 400);
    assert.deepEqual(Object.keys(publish.body.errors).sort(), ['descripcion', 'habilidades']);
  });

  it('una oferta publicada antes de las reglas puede editar otros campos', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Antigua SAS' });
    const offer = await createOffer(company.token);
    await pool.query(`UPDATE ofertas SET habilidades = '{}', descripcion = 'Texto antiguo' WHERE id = $1`, [offer.id]);

    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ fechaCierre: futureDate(45) })).status, 200);
    assert.equal((await api().patch(`/api/offers/${offer.id}`).set(auth(company.token)).send({ descripcion: 'Sigue corta' })).status, 400);
  });

  it('las habilidades y los programas estructurados cuentan en la afinidad', async () => {
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Afinidad Fase 8 SAS' });
    const match = await createOffer(company.token, { titulo: 'Analista de datos', tipo: 'EMPLEO', area: 'Finanzas', programas: ['Ingeniería Industrial'], habilidades: ['Python', 'Power BI'], requisitos: [] });
    await createOffer(company.token, { titulo: 'Auxiliar de cocina', tipo: 'EMPLEO', area: 'Hotelería', habilidades: ['Cocina'], requisitos: [] });

    const student = await registerUser('ESTUDIANTE', { programaAcademico: 'Ingeniería Industrial' });
    await api().put('/api/profile/skills').set(auth(student.token)).send({ items: [{ categoria: 'Datos', nombre: 'Python' }] });

    const response = await api().get('/api/offers/recommended').set(auth(student.token));
    assert.equal(response.body.offers[0].id, match.id);
    assert.ok(response.body.offers[0].affinity > response.body.offers[1].affinity);
  });
});
