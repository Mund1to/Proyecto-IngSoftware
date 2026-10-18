// Avisos por correo del proceso de verificación. Se envían después de confirmar
// la transacción; un fallo del proveedor se registra y no cambia la respuesta.
import { env } from '../../core/config/env.js';
import { escapeHtml, sendEmail } from '../../core/mail/mailer.js';
import * as verificationsRepository from './verifications.repository.js';

// Avisa a administradores y funcionarios de una solicitud nueva.
export async function notifyReviewersOfRequest({ razonSocial, nit, requesterEmail, documentCount }) {
  const reviewers = await verificationsRepository.listReviewerEmails();
  const link = `${env.appUrl}/`;
  await Promise.all(reviewers.map((to) => sendEmail({
    to,
    subject: `Nueva solicitud de verificación: ${razonSocial}`,
    text: `${razonSocial} (NIT ${nit}) envió una solicitud de verificación con ${documentCount} documento(s).\nContacto: ${requesterEmail}\n\nRevísala en SIPU, sección Solicitudes:\n${link}`,
    html: `<p><strong>${escapeHtml(razonSocial)}</strong> (NIT ${escapeHtml(nit)}) envió una solicitud de verificación con ${documentCount} documento(s).</p><p>Contacto: ${escapeHtml(requesterEmail)}</p><p>Revísala en SIPU, sección <strong>Solicitudes</strong>.</p><p><a href="${link}">Abrir SIPU</a></p>`,
  })));
}

// Avisa a la empresa de la decisión sobre su verificación.
export async function notifyOrganizationOfDecision(organizationId, { status, observations }) {
  const contact = await verificationsRepository.findOrganizationContact(organizationId);
  if (!contact) return;

  const approved = status === 'APROBADA';
  const subject = approved
    ? `${contact.razon_social} ya está verificada en SIPU`
    : `Revisa la verificación de ${contact.razon_social} en SIPU`;
  const summary = approved
    ? 'Tu organización fue verificada. Tus ofertas muestran ahora el sello de organización verificada.'
    : 'Tu solicitud de verificación no fue aprobada. Corrige los documentos desde "Mi empresa" y envíala de nuevo.';
  const note = observations ? `\n\nObservaciones del revisor: ${observations}` : '';

  await sendEmail({
    to: contact.email,
    subject,
    text: `Hola ${contact.nombre_completo}:\n\n${summary}${note}\n\n${env.appUrl}/`,
    html: `<p>Hola ${escapeHtml(contact.nombre_completo)}:</p><p>${summary}</p>${observations ? `<p><strong>Observaciones del revisor:</strong> ${escapeHtml(observations)}</p>` : ''}<p><a href="${env.appUrl}/">Abrir SIPU</a></p>`,
  });
}
