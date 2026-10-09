import { env } from '../config/env.js';

// Correos enviados durante las pruebas, para poder inspeccionarlos.
export const sentEmails = [];

// Envía un correo con la API HTTP de Resend (https://resend.com).
// Sin RESEND_API_KEY no se envía nada: en desarrollo el contenido se muestra en
// la consola y en producción se registra una advertencia.
export async function sendEmail({ to, subject, text, html }) {
  if (env.nodeEnv === 'test') {
    sentEmails.push({ to, subject, text, html });
    return { ok: true, simulated: true };
  }

  if (!env.resendApiKey) {
    if (env.nodeEnv === 'production') {
      console.warn(`RESEND_API_KEY no está configurada; no se envió el correo "${subject}" a ${to}.`);
    } else {
      console.log(`[correo simulado] Para: ${to}\nAsunto: ${subject}\n${text}`);
    }
    return { ok: false, simulated: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.mailFrom, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend respondió ${response.status}: ${detail.slice(0, 200)}`);
  }

  return { ok: true };
}
