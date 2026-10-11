// Reglas del módulo de administración, sin dependencias de base de datos.

export const ASSIGNABLE_ROLES = ['USUARIO', 'ADMINISTRADOR', 'FUNCIONARIO_PUBLICO'];

// Mismas reglas que el formulario: 8 caracteres, una mayúscula y un número.
export function isStrongPassword(value) {
  const text = String(value ?? '');
  return text.length >= 8 && /[A-Z]/.test(text) && /\d/.test(text);
}
