// Regla única de contraseñas para registro, recuperación, cambio desde el perfil
// y asignación por el administrador. El frontend aplica la misma regla en sus
// formularios (frontend/src/shared/lib/password.ts); una prueba de contrato lo comprueba.

export const PASSWORD_RULE_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres, una mayúscula y un número.';

// bcrypt solo usa los primeros 72 bytes: dos claves largas con el mismo inicio
// serían la misma clave, así que las más largas se rechazan.
export const PASSWORD_MAX_BYTES = 72;

export function isStrongPassword(value) {
  if (typeof value !== 'string') return false;
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES;
}
