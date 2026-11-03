// Avisos por correo al candidato cuando la empresa avanza su proceso. Se envían
// después de confirmar la transacción; un fallo del proveedor se registra y no
// cambia la respuesta.
import { env } from '../../core/config/env.js';
import { escapeHtml, sendEmail } from '../../core/mail/mailer.js';
import * as applicationsRepository from './applications.repository.js';

const MODE_LABELS = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', TELEFONICA: 'Telefónica' };

// Fecha de la entrevista en hora de Colombia: "martes, 10 de noviembre de 2026, 3:00 p. m.".
export function formatInterviewDate(iso) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso));
}

function interviewLines(interview) {
  if (!interview) return [];
  return [
    `Fecha: ${formatInterviewDate(interview.fecha)} (hora de Colombia)`,
    `Modalidad: ${MODE_LABELS[interview.modalidad] ?? interview.modalidad}`,
    ...(interview.lugar ? [`${interview.modalidad === 'VIRTUAL' ? 'Enlace' : 'Lugar'}: ${interview.lugar}`] : []),
    ...(interview.duracionMinutos ? [`Duración estimada: ${interview.duracionMinutos} minutos`] : []),
  ];
}

// Asunto y resumen por etapa. Las etapas sin aviso devuelven null.
function summaryFor(status, { oferta, empresa, rescheduled }) {
  switch (status) {
    case 'PRESELECCIONADA':
      return rescheduled
        ? { subject: `${empresa} reprogramó tu entrevista para ${oferta}`, intro: `${empresa} cambió la fecha de tu entrevista para "${oferta}".` }
        : { subject: `${empresa} te citó a entrevista para ${oferta}`, intro: `¡Buenas noticias! ${empresa} quiere conocerte para "${oferta}".` };
    case 'ACEPTADA':
      return { subject: `¡Fuiste seleccionado para ${oferta}!`, intro: `${empresa} aceptó tu postulación a "${oferta}".` };
    case 'RECHAZADA':
      return { subject: `Novedades de tu postulación a ${oferta}`, intro: `${empresa} decidió no continuar con tu postulación a "${oferta}" en esta ocasión.` };
    default:
      return null;
  }
}

export async function notifyCandidateOfStage(applicationId, { status, message, interview, rescheduled = false }) {
  const context = await applicationsRepository.findNotificationContext(applicationId);
  if (!context) return;

  const summary = summaryFor(status, { oferta: context.oferta_titulo, empresa: context.empresa, rescheduled });
  if (!summary) return;

  const details = status === 'PRESELECCIONADA' ? interviewLines(interview) : [];
  const link = `${env.appUrl}/`;
  const text = [
    `Hola ${context.nombre_completo}:`,
    '',
    summary.intro,
    ...(details.length ? ['', ...details] : []),
    ...(message ? ['', `Mensaje de ${context.empresa}: ${message}`] : []),
    '',
    `Consulta el detalle en SIPU, sección Mis postulaciones: ${link}`,
  ].join('\n');

  const html = [
    `<p>Hola ${escapeHtml(context.nombre_completo)}:</p>`,
    `<p>${escapeHtml(summary.intro)}</p>`,
    details.length ? `<ul>${details.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : '',
    message ? `<p><strong>Mensaje de ${escapeHtml(context.empresa)}:</strong> ${escapeHtml(message)}</p>` : '',
    `<p>Consulta el detalle en SIPU, sección <strong>Mis postulaciones</strong>.</p>`,
    `<p><a href="${link}">Abrir SIPU</a></p>`,
  ].join('');

  await sendEmail({ to: context.email, subject: summary.subject, text, html });
}
