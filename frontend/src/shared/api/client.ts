// Cliente HTTP común a todas las funcionalidades. Cada funcionalidad declara sus
// llamadas en features/<funcionalidad>/<funcionalidad>.api.ts usando `request`.
// Cambiar fetch por otra librería, o agregar reintentos o cabeceras, solo toca este archivo.

// URL de la API desplegada en Render. Se usa si el build de producción no recibe
// VITE_API_URL, para que el frontend publicado nunca apunte a localhost.
export const PRODUCTION_API_URL = 'https://proyecto-ingsoftware.onrender.com/api';

export function resolveApiBaseUrl(configured: string | undefined, isProduction: boolean): string {
  const value = configured?.trim();
  if (value) return value.replace(/\/+$/, '');
  return isProduction ? PRODUCTION_API_URL : 'http://localhost:3000/api';
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);

// Render (plan gratuito) puede tardar cerca de un minuto en despertar.
export const REQUEST_TIMEOUT_MS = 70000;

export const SESSION_EXPIRED_EVENT = 'sipu:session-expired';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'El servidor tardó demasiado en responder. Puede estar iniciándose; inténtalo de nuevo en unos segundos.'
        : 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    // Un token vencido o una cuenta eliminada cierran la sesión en toda la app.
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(payload?.message ?? 'La solicitud falló.', response.status);
  }

  return (payload ?? ({} as T)) as T;
}

// Descarga un archivo protegido (requiere el token) y devuelve un Blob.
export async function requestBlob(path: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0);
  }

  if (!response.ok) {
    const payload = (response.headers.get('content-type') ?? '').includes('application/json') ? await response.json() : null;
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw new ApiError(payload?.message ?? 'No se pudo descargar el archivo.', response.status);
  }

  return response.blob();
}

// Abre un archivo protegido en una pestaña nueva.
export async function openProtectedFile(path: string, token: string) {
  // La pestaña se abre antes de la descarga para que el navegador no la bloquee.
  const tab = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await requestBlob(path, token));
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

// Opciones de una petición con cuerpo JSON (o sin cuerpo).
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// Opciones para subir un archivo como cuerpo binario; el nombre viaja en X-File-Name.
export const binary = (method: string, file: File): RequestInit => ({
  method,
  body: file,
  headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
});
