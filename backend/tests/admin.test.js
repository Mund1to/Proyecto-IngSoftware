import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
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

describe('administración de usuarios', () => {
  it('solo un administrador lista usuarios', async () => {
    const user = await registerUser('ESTUDIANTE');
    assert.equal((await api().get('/api/admin/users').set(auth(user.token))).status, 403);

    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    assert.equal((await api().get('/api/admin/users').set(auth(funcionario.token))).status, 403);

    const admin = await createAdmin();
    const response = await api().get('/api/admin/users').query({ q: user.email }).set(auth(admin.token));
    assert.equal(response.status, 200);
    assert.equal(response.body.users.length, 1);
    assert.equal(response.body.users[0].email, user.email);
  });

  it('asigna roles y conserva siempre USUARIO', async () => {
    const admin = await createAdmin();
    const user = await registerUser('ESTUDIANTE');

    const response = await api().put(`/api/admin/users/${user.user.id}/roles`).set(auth(admin.token)).send({ roles: ['funcionario_publico'] });
    assert.equal(response.status, 200);
    assert.deepEqual([...response.body.user.roles].sort(), ['FUNCIONARIO_PUBLICO', 'USUARIO']);

    // El nuevo rol aplica sin volver a iniciar sesión.
    assert.equal((await api().get('/api/stats/employment').set(auth(user.token))).status, 200);
  });

  it('valida la lista de roles y el usuario', async () => {
    const admin = await createAdmin();
    assert.equal((await api().put(`/api/admin/users/${admin.user.id}/roles`).set(auth(admin.token)).send({ roles: 'ADMINISTRADOR' })).status, 400);
    assert.equal((await api().put(`/api/admin/users/${admin.user.id}/roles`).set(auth(admin.token)).send({ roles: ['SUPERUSUARIO'] })).status, 400);
    assert.equal((await api().put('/api/admin/users/999999/roles').set(auth(admin.token)).send({ roles: [] })).status, 404);
  });

  it('impide dejar el sistema sin administradores', async () => {
    await resetDatabase();
    const admin = await createAdmin();
    const response = await api().put(`/api/admin/users/${admin.user.id}/roles`).set(auth(admin.token)).send({ roles: ['USUARIO'] });
    assert.equal(response.status, 409);

    const second = await createAdmin();
    const ok = await api().put(`/api/admin/users/${admin.user.id}/roles`).set(auth(second.token)).send({ roles: ['USUARIO'] });
    assert.equal(ok.status, 200);
  });

  it('activa y desactiva cuentas, pero no la propia', async () => {
    const admin = await createAdmin();
    const user = await registerUser('ESTUDIANTE');

    const off = await api().patch(`/api/admin/users/${user.user.id}/active`).set(auth(admin.token)).send({ activo: false });
    assert.equal(off.status, 200);
    assert.equal(off.body.user.activo, false);
    assert.equal((await api().get('/api/profile/me').set(auth(user.token))).status, 403);

    const on = await api().patch(`/api/admin/users/${user.user.id}/active`).set(auth(admin.token)).send({ activo: true });
    assert.equal(on.body.user.activo, true);

    assert.equal((await api().patch(`/api/admin/users/${admin.user.id}/active`).set(auth(admin.token)).send({ activo: false })).status, 409);
    assert.equal((await api().patch(`/api/admin/users/${user.user.id}/active`).set(auth(admin.token)).send({ activo: 'no' })).status, 400);
  });
});

describe('verificación de organizaciones', () => {
  it('una organización verificada ya no puede verificar a otras', async () => {
    const admin = await createAdmin();
    const verified = await registerUser('ORGANIZACION', { razonSocial: 'Verificada SAS' });
    const target = await registerUser('ORGANIZACION', { razonSocial: 'Objetivo SAS' });
    const orgId = (await api().get('/api/profile/me').set(auth(verified.token))).body.user.perfiles[0].id;
    const targetId = (await api().get('/api/profile/me').set(auth(target.token))).body.user.perfiles[0].id;

    await api().patch(`/api/verifications/organizations/${orgId}`).set(auth(admin.token)).send({ estado: 'APROBADA' });

    assert.equal((await api().get('/api/verifications/organizations').set(auth(verified.token))).status, 403);
    const attempt = await api().patch(`/api/verifications/organizations/${targetId}`).set(auth(verified.token)).send({ estado: 'RECHAZADA' });
    assert.equal(attempt.status, 403);
  });

  it('un funcionario aprueba y rechaza, y queda el historial', async () => {
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Revisada SAS' });
    const orgId = (await api().get('/api/profile/me').set(auth(company.token))).body.user.perfiles[0].id;

    const approve = await api().patch(`/api/verifications/organizations/${orgId}`).set(auth(funcionario.token)).send({ estado: 'APROBADA', observaciones: 'RUT válido' });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.organization.verificada, true);

    const offer = await createOffer(company.token);
    assert.equal((await api().get(`/api/offers/${offer.id}`)).body.offer.verificada, true);

    const reject = await api().patch(`/api/verifications/organizations/${orgId}`).set(auth(funcionario.token)).send({ estado: 'RECHAZADA' });
    assert.equal(reject.body.organization.verificada, false);

    const list = await api().get('/api/verifications/organizations').set(auth(funcionario.token));
    const row = list.body.organizations.find((org) => String(org.organizacion_id) === String(orgId));
    assert.equal(row.verificacion_estado, 'RECHAZADA');
  });

  it('valida el estado y la organización', async () => {
    const admin = await createAdmin();
    assert.equal((await api().patch('/api/verifications/organizations/1').set(auth(admin.token)).send({ estado: 'TAL VEZ' })).status, 400);
    assert.equal((await api().patch('/api/verifications/organizations/999999').set(auth(admin.token)).send({ estado: 'APROBADA' })).status, 404);
  });
});

describe('convocatorias', () => {
  it('la lectura es pública y la gestión exige rol', async () => {
    assert.equal((await api().get('/api/convocatorias')).status, 200);
    const user = await registerUser('ESTUDIANTE');
    assert.equal((await api().post('/api/convocatorias').set(auth(user.token)).send({ titulo: 'X' })).status, 403);
  });

  it('crea, edita, asocia ofertas y elimina una convocatoria', async () => {
    const funcionario = await createAdmin('FUNCIONARIO_PUBLICO');
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Pública SAS' });
    const offer = await createOffer(company.token, { tipo: 'EMPLEO_PUBLICO' });

    const created = await api().post('/api/convocatorias').set(auth(funcionario.token)).send({
      titulo: 'Convocatoria 2026', fechaInicio: '2026-11-01', fechaFin: '2026-12-01',
    });
    assert.equal(created.status, 201);
    const id = created.body.convocatoria.id;

    const edited = await api().patch(`/api/convocatorias/${id}`).set(auth(funcionario.token)).send({ descripcion: 'Empleo público', fechaFin: null });
    assert.equal(edited.body.convocatoria.descripcion, 'Empleo público');
    assert.equal(edited.body.convocatoria.fecha_fin, null);

    const assigned = await api().put(`/api/convocatorias/${id}/offers/${offer.id}`).set(auth(funcionario.token));
    assert.equal(assigned.status, 200);
    assert.equal(String(assigned.body.offer.convocatoria_id), String(id));

    const detail = await api().get(`/api/convocatorias/${id}`);
    assert.equal(detail.body.convocatoria.total_ofertas, 1);
    const offers = await api().get(`/api/convocatorias/${id}/offers`);
    assert.equal(offers.body.offers[0].id, offer.id);

    const unassigned = await api().delete(`/api/convocatorias/${id}/offers/${offer.id}`).set(auth(funcionario.token));
    assert.equal(unassigned.status, 200);
    assert.equal((await api().delete(`/api/convocatorias/${id}/offers/${offer.id}`).set(auth(funcionario.token))).status, 404);

    assert.equal((await api().delete(`/api/convocatorias/${id}`).set(auth(funcionario.token))).status, 200);
    assert.equal((await api().get(`/api/convocatorias/${id}`)).status, 404);
  });

  it('valida título y fechas', async () => {
    const admin = await createAdmin();
    assert.equal((await api().post('/api/convocatorias').set(auth(admin.token)).send({ titulo: '' })).status, 400);
    assert.equal((await api().post('/api/convocatorias').set(auth(admin.token)).send({ titulo: 'X', fechaInicio: '2026-12-01', fechaFin: '2026-11-01' })).status, 400);
    assert.equal((await api().post('/api/convocatorias').set(auth(admin.token)).send({ titulo: 'X', fechaInicio: 'ayer' })).status, 400);
    assert.equal((await api().put('/api/convocatorias/999999/offers/1').set(auth(admin.token))).status, 404);
  });
});

describe('estadísticas', () => {
  it('devuelve totales numéricos y organizaciones con su conteo', async () => {
    await resetDatabase();
    const admin = await createAdmin();
    const company = await registerUser('ORGANIZACION', { razonSocial: 'Top SAS' });
    await createOffer(company.token);
    await createOffer(company.token, { estado: 'BORRADOR' });
    const student = await registerUser('ESTUDIANTE');
    const offers = await api().get('/api/offers');
    await api().post(`/api/applications/offers/${offers.body.offers[0].id}`).set(auth(student.token));

    const response = await api().get('/api/stats/employment').set(auth(admin.token));
    assert.equal(response.status, 200);
    const { totals, topOrganizations, applicationsByMonth, offersByType } = response.body.stats;
    assert.equal(totals.total_ofertas, 2);
    assert.equal(totals.ofertas_publicadas, 1);
    assert.equal(totals.total_postulaciones, 1);
    assert.deepEqual(topOrganizations[0], { razon_social: 'Top SAS', total: 2 });
    assert.equal(applicationsByMonth[0].total, 1);
    assert.equal(offersByType[0].total, 2);
  });

  it('exige rol de administrador o funcionario', async () => {
    const user = await registerUser('ORGANIZACION', { razonSocial: 'Curiosa SAS' });
    assert.equal((await api().get('/api/stats/employment').set(auth(user.token))).status, 403);
  });
});
