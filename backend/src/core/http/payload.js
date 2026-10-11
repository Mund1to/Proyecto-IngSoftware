// Utilidades compartidas para interpretar los cuerpos de las peticiones.
// Acepta variantes en español e inglés para los mismos campos.

export function getBodyValue(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined && payload[key] !== null) {
      return payload[key];
    }
  }

  return undefined;
}

export function hasBodyValue(payload, keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

export function toNullableString(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return String(value).trim();
}

export function normalizeString(value) {
  return toNullableString(value);
}

export function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return typeof value === 'string'
    ? value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
    : [];
}
