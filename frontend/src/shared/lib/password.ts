// Regla de contraseñas de todos los formularios. Debe coincidir con
// backend/src/core/security/password.js; test/contracts.test.ts lo comprueba.
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (value) => value.length >= 8 },
  { label: "Una mayúscula", test: (value) => /[A-Z]/.test(value) },
  { label: "Un número", test: (value) => /\d/.test(value) },
];

// bcrypt solo usa los primeros 72 bytes. No se muestra en la lista de reglas
// porque casi nadie llega a ese largo; el formulario avisa si se supera.
export const PASSWORD_MAX_BYTES = 72;
export const passwordTooLong = (value: string) => new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES;

export const isStrongPassword = (value: string) => PASSWORD_RULES.every((rule) => rule.test(value)) && !passwordTooLong(value);
