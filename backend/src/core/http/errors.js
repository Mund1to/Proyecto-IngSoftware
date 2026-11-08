// Errores HTTP con mensaje para el cliente. Los servicios los lanzan y
// asyncHandler los convierte en la respuesta { ok: false, message }.
// `details` (opcional) lleva los errores por campo de un formulario, por ejemplo
// { titulo: 'El título...' }; la respuesta los incluye como `errors`.
export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const forbidden = (message) => new HttpError(403, message);
export const notFound = (message) => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

// Errores de PostgreSQL causados por el dato recibido, no por el servidor: texto
// más largo que la columna, número fuera de rango, formato o fecha inválidos.
// Son una red de seguridad; cada servicio debería validar antes.
const INVALID_DATA_CODES = new Set(['22001', '22003', '22007', '22008', '22021', '22P02', '22P05']);

// Envuelve un controlador async. Un HttpError responde con su estado y mensaje;
// un dato que la base no acepta responde 400; cualquier otro error se registra
// y responde 500 con `fallbackMessage`.
export function asyncHandler(handler, fallbackMessage) {
  return async function handle(request, response, next) {
    try {
      await handler(request, response, next);
    } catch (error) {
      if (error instanceof HttpError) {
        return response.status(error.status).json({ ok: false, message: error.message, ...(error.details ? { errors: error.details } : {}) });
      }
      if (INVALID_DATA_CODES.has(error?.code)) {
        return response.status(400).json({ ok: false, message: 'Algún dato es demasiado largo o no tiene el formato esperado.' });
      }
      console.error(`${handler.name || 'controller'} error:`, error);
      return response.status(500).json({ ok: false, message: fallbackMessage });
    }
  };
}
