// Reglas de verificación de organizaciones.
// El acceso se restringe en la ruta a ADMINISTRADOR y FUNCIONARIO_PUBLICO.
import { withTransaction } from '../../core/database/database.js';
import { badRequest, notFound } from '../../core/http/errors.js';
import { getBodyValue, toNullableString } from '../../core/http/payload.js';
import * as verificationsRepository from './verifications.repository.js';

const VERIFICATION_STATUSES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

export function listOrganizations() {
  return verificationsRepository.listOrganizationsWithLatestVerification();
}

// Registra la decisión de verificación de una organización.
// Aprobar activa organizaciones.verificada; rechazar la desactiva.
export async function updateOrganizationVerification(reviewerId, organizationId, payload = {}) {
  const status = String(getBodyValue(payload, ['estado', 'status']) ?? '').trim().toUpperCase();

  if (!VERIFICATION_STATUSES.includes(status)) {
    throw badRequest('El estado de verificación debe ser PENDIENTE, APROBADA o RECHAZADA.');
  }

  const observations = toNullableString(getBodyValue(payload, ['observaciones', 'observations']));

  const organization = await withTransaction(async (db) => {
    if (!(await verificationsRepository.organizationExists(db, organizationId))) {
      throw notFound('Organización no encontrada.');
    }

    await verificationsRepository.insertVerification(db, { organizationId, reviewerId, status, observations });
    return verificationsRepository.setOrganizationVerified(db, organizationId, status);
  });

  return { organization, verificationStatus: status };
}
