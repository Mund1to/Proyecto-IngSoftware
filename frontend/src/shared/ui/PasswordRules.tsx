import { PASSWORD_RULES } from "../lib/password";

// Lista de requisitos que se marcan como cumplidos mientras se escribe.
export default function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="password-rules" aria-label="Requisitos de contraseña">
      {PASSWORD_RULES.map((rule) => (
        <li key={rule.label} className={rule.test(password) ? "valid" : ""}>{rule.label}</li>
      ))}
    </ul>
  );
}
