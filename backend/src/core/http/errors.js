// Errores HTTP con mensaje para el cliente. Los servicios los lanzan y
// asyncHandler los convierte en la respuesta { ok: false, message }.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const forbidden = (message) => new HttpError(403, message);
export const notFound = (message) => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

// Envuelve un controlador async. Un HttpError responde con su estado y mensaje;
// cualquier otro error se registra y responde 500 con `fallbackMessage`.
export function asyncHandler(handler, fallbackMessage) {
  return async function handle(request, response, next) {
    try {
      await handler(request, response, next);
    } catch (error) {
      if (error instanceof HttpError) {
        return response.status(error.status).json({ ok: false, message: error.message });
      }
      console.error(`${handler.name || 'controller'} error:`, error);
      return response.status(500).json({ ok: false, message: fallbackMessage });
    }
  };
}
