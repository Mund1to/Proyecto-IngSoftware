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
