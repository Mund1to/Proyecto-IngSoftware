// Normalización compartida de las ofertas que devuelve la API.
// La API entrega las claves en español (titulo, descripcion, ...), pero las
// pantallas toleran también nombres alternativos en inglés.

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
