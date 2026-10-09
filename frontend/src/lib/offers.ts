// Normalización compartida de las ofertas que devuelve la API.
// La API entrega las claves en español (titulo, descripcion, ...), pero las
// pantallas toleran también nombres alternativos en inglés.

export type Modality = "Presencial" | "Remota" | "Híbrida";

export function companyInitials(value: unknown): string {
  return String(value ?? "E").slice(0, 2).toUpperCase();
}

export function formatSalary(value: unknown): string {
  return value ? `$${Number(value).toLocaleString("es-CO")}/mes` : "A convenir";
}

export function toNumberOrZero(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Convierte cualquier variante ("hibrido", "REMOTO", "H�brida") a una de las tres
// modalidades conocidas. Un valor desconocido rompía las tarjetas del catálogo.
export function normalizeModality(value: unknown): Modality {
  const simple = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (simple.startsWith("presencial")) return "Presencial";
  if (simple.startsWith("remot") || simple === "virtual") return "Remota";
  return "Híbrida";
}

export function isValidDate(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(new Date(String(value)).getTime());
}

// Intl.DateTimeFormat lanza RangeError con fechas inválidas; aquí se muestra un texto.
export function formatDate(value: unknown, fallback = "Sin fecha"): string {
  if (!isValidDate(value)) return fallback;
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(String(value)))
    .replace(".", "");
}

export function daysUntil(value: unknown): number {
  if (!isValidDate(value)) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(String(value)).getTime() - Date.now()) / 86400000);
}

export type ApplicationStatus = "Enviada" | "En revisión" | "Aceptada" | "Rechazada" | "Retirada";

export function mapApplicationStatus(status?: string): ApplicationStatus {
  switch (status) {
    case "EN_REVISION":
    case "PRESELECCIONADA":
      return "En revisión";
    case "ACEPTADA":
      return "Aceptada";
    case "RECHAZADA":
      return "Rechazada";
    case "RETIRADA":
      return "Retirada";
    default:
      return "Enviada";
  }
}
