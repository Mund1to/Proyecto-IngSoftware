// Regla única de contraseñas para registro, recuperación, cambio desde el perfil
// y asignación por el administrador. El frontend aplica la misma regla en sus
// formularios (frontend/src/shared/lib/password.ts); una prueba de contrato lo comprueba.

export const PASSWORD_RULE_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.';

export function isStrongPassword(value) {
  const text = String(value ?? '');
  return text.length >= 8 && /[A-Z]/.test(text) && /\d/.test(text);
}
