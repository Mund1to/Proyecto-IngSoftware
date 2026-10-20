// Regla de contraseñas de todos los formularios. Debe coincidir con
// backend/src/core/security/password.js; test/contracts.test.ts lo comprueba.
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (value) => value.length >= 8 },
  { label: "Una mayúscula", test: (value) => /[A-Z]/.test(value) },
  { label: "Un número", test: (value) => /\d/.test(value) },
];

export const isStrongPassword = (value: string) => PASSWORD_RULES.every((rule) => rule.test(value));
