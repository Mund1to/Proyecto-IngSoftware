import express from 'express';

// Firmas binarias de los formatos admitidos. Se comprueba el contenido real del
// archivo y no solo la cabecera Content-Type, que el cliente puede falsear.
export const FILE_SIGNATURES = {
  'application/pdf': (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/webp': (buffer) => buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP',
};

// 'Application/PDF; charset=x' -> 'application/pdf'
export function normalizeMime(contentType) {
  return String(contentType ?? '').split(';')[0].trim().toLowerCase();
}

// true si `mime` está permitido y el contenido tiene la firma de ese formato.
export function hasValidSignature(mime, buffer, allowedMimes) {
  return allowedMimes.includes(mime) && Boolean(FILE_SIGNATURES[mime]?.(buffer));
}

// Nombre recibido en la cabecera X-File-Name (codificado con encodeURIComponent),
// sin separadores de ruta, saltos de línea ni comillas que rompan Content-Disposition.
export function cleanFileName(rawName, fallback) {
  let fileName;
  try {
    fileName = decodeURIComponent(rawName ?? '').trim().slice(0, 200);
  } catch {
    fileName = '';
  }
  return fileName.replace(/[\\/\r\n"]/g, '_') || fallback;
}

// Lee el cuerpo de la petición como binario: el archivo llega sin multipart.
export const rawFileBody = (limit) => express.raw({ type: () => true, limit });

// Envía un archivo guardado en la base de datos ({ nombre, mime, tamano, contenido })
// para verlo en el navegador, sin caché compartida ni detección de tipo.
export function sendStoredFile(response, file) {
  const encodedName = encodeURIComponent(file.nombre);
  response.set('Content-Type', file.mime);
  response.set('Content-Length', String(file.tamano));
  response.set('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
  response.set('Cache-Control', 'private, no-store');
  response.set('X-Content-Type-Options', 'nosniff');
  return response.send(file.contenido);
}
