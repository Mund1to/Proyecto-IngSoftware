import { useEffect, useRef, useState } from "react";
import { AppState, Role, Screen } from "../App";
import { api } from "../lib/api";
import ArdyMark from "../components/ArdyMark";
import UniversityLogo from "../components/UniversityLogo";

type Props = {
  state?: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  login?: (email: string, password: string) => Promise<void>;
  register?: (payload: Record<string, unknown>) => Promise<void>;
};
type View = "login" | "register" | "forgot";

type AccountType = Exclude<Role, "admin">;

const roles: { id: AccountType; title: string; description: string }[] = [
  { id: "student", title: "Estudiante", description: "Encuentra y gestiona tus prácticas universitarias." },
  { id: "company", title: "Empresa", description: "Publica ofertas y acompaña tu proceso de selección." },
  { id: "external", title: "Profesional", description: "Consulta las vacantes disponibles de la bolsa general." },
];

export default function AuthScreen({ state, login, register }: Props) {
  const [view, setView] = useState<View>("login");
  const [role, setRole] = useState<AccountType>("student");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const slowTimer = useRef<number>();

  // Despierta la API (Render en plan gratuito se suspende) mientras el usuario escribe.
  useEffect(() => {
    api.health().catch(() => undefined);
    return () => window.clearTimeout(slowTimer.current);
  }, []);

  const reset = (next: View) => {
    setView(next);
    setError("");
  };

  // Ejecuta la petición mostrando un aviso si el servidor tarda en responder.
  const runRequest = async (action: () => Promise<void>, fallback: string) => {
    setSubmitting(true);
    setSlowServer(false);
    slowTimer.current = window.setTimeout(() => setSlowServer(true), 5000);
    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : fallback);
    } finally {
      window.clearTimeout(slowTimer.current);
      setSubmitting(false);
      setSlowServer(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Ingresa un correo válido.");
    if (view === "forgot") return;
    if (view === "register") {
      if (!name.trim()) return setError("Ingresa tu nombre completo.");
      if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password))
        return setError("La contraseña debe cumplir todos los requisitos.");
      if (password !== confirm) return setError("Las contraseñas no coinciden.");

      if (!register) return;
      await runRequest(() => register({
        email: email.trim(),
        password,
        nombreCompleto: name.trim(),
        profileType: role === "student" ? "ESTUDIANTE" : role === "company" ? "ORGANIZACION" : "CANDIDATO_EXTERNO",
        ...(role === "company" ? { razonSocial: name.trim() } : {}),
      }), "No se pudo crear la cuenta.");
      return;
    }
    if (!password) return setError("Ingresa tu contraseña.");

    if (!login) return;
    await runRequest(() => login(email.trim(), password), "No se pudo iniciar sesión.");
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Presentación de SIPU">
        <div>
          <Logo inverse />
          <ArdyMark className="auth-squirrel" />
          <p className="eyebrow inverse">Universidad de Ibagué</p>
          <h1>Tu talento encuentra oportunidades reales.</h1>
          <p className="auth-intro">
            Prácticas universitarias y oportunidades laborales en una plataforma segura, clara y cercana.
          </p>
        </div>
        <div className="trust-note">
          <span aria-hidden="true">✓</span>
          Empresas y perfiles verificados por la Universidad de Ibagué
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-logo"><Logo /></div>
        <div className="auth-card">
          <p className="eyebrow">{view === "login" ? "Acceso seguro" : view === "register" ? "Nueva cuenta" : "Recupera tu acceso"}</p>
          <h2>{view === "login" ? "Bienvenido de nuevo" : view === "register" ? "Crea tu cuenta" : "Restablece tu contraseña"}</h2>
          <p className="muted">
            {view === "login"
              ? "Ingresa con el correo asociado a tu cuenta."
              : view === "register"
                ? "Selecciona el tipo de cuenta y completa tus datos."
                : "SIPU aún no envía correos de recuperación."}
          </p>

          {state?.notice && view === "login" && <div className="form-error" role="status">{state.notice}</div>}

          {view === "forgot" ? (
            <div className="success-panel" role="status">
              <strong>¿Cómo recuperar el acceso?</strong>
              <p>Escribe a la oficina de prácticas o al administrador de SIPU desde el correo registrado y solicita el restablecimiento. Si recuerdas tu contraseña actual, puedes cambiarla desde tu perfil después de iniciar sesión.</p>
              <button className="button primary" onClick={() => reset("login")}>Volver a iniciar sesión</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-busy={submitting}>
              {view === "register" && (
                <>
                  <fieldset className="role-picker">
                    <legend>Tipo de cuenta</legend>
                    {roles.map((item) => (
                      <label key={item.id} className={role === item.id ? "selected" : ""}>
                        <input type="radio" name="role" value={item.id} checked={role === item.id} onChange={() => setRole(item.id)} />
                        <span><strong>{item.title}</strong><small>{item.description}</small></span>
                      </label>
                    ))}
                  </fieldset>
                  <Field label={role === "company" ? "Nombre de la organización" : "Nombre completo"} value={name} onChange={setName} autoComplete={role === "company" ? "organization" : "name"} />
                </>
              )}
              <Field
                label={view === "register" && role === "student" ? "Correo institucional" : view === "register" && role === "company" ? "Correo corporativo" : "Correo"}
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                hint={view === "register" ? role === "student" ? "Verificaremos tu vínculo con Unibagué mediante este correo." : role === "company" ? "La organización debe verificarse antes de publicar ofertas." : "Usa un correo que consultes con frecuencia." : undefined}
              />
              <Field label="Contraseña" value={password} onChange={setPassword} type={showPassword ? "text" : "password"} autoComplete={view === "login" ? "current-password" : "new-password"} />
              <label className="check-row"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Mostrar contraseña</label>
              {view === "register" && (
                <>
                  <Field label="Confirmar contraseña" value={confirm} onChange={setConfirm} type={showPassword ? "text" : "password"} autoComplete="new-password" />
                  <ul className="password-rules" aria-label="Requisitos de contraseña">
                    <li className={password.length >= 8 ? "valid" : ""}>Mínimo 8 caracteres</li>
                    <li className={/[A-Z]/.test(password) ? "valid" : ""}>Una mayúscula</li>
                    <li className={/\d/.test(password) ? "valid" : ""}>Un número</li>
                  </ul>
                </>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              {slowServer && <p className="muted" role="status">El servidor se está activando. Esto puede tardar hasta un minuto la primera vez.</p>}
              <button className="button primary full" type="submit" disabled={submitting}>
                {submitting
                  ? view === "login" ? "Iniciando sesión..." : "Creando cuenta..."
                  : view === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            </form>
          )}

          <div className="auth-actions">
            {view === "login" ? (
              <>
                <button className="text-button" onClick={() => reset("forgot")}>¿Olvidaste tu contraseña?</button>
                <p>¿Aún no tienes cuenta? <button className="text-button" onClick={() => reset("register")}>Crear cuenta</button></p>
              </>
            ) : view === "register" ? (
              <p>¿Ya tienes una cuenta? <button className="text-button" onClick={() => reset("login")}>Iniciar sesión</button></p>
            ) : null}
          </div>
          <p className="legal">Al continuar confirmas que tus datos se usarán para gestionar tu cuenta y tus postulaciones.</p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", hint, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; hint?: string; autoComplete?: string }) {
  const id = label.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <div className={`brand-logo ${inverse ? "inverse" : ""}`}><UniversityLogo /><small>Prácticas y empleo</small></div>;
}
