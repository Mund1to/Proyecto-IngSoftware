// Formato de valores para mostrar en pantalla. Toleran datos vacíos o inválidos
// de la API y devuelven un texto en lugar de lanzar errores.

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
