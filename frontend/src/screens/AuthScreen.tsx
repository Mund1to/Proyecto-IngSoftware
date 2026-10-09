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
  clearResetToken?: () => void;
};
type View = "login" | "register" | "forgot" | "reset";

type AccountType = Exclude<Role, "admin">;

const roles: { id: AccountType; title: string; description: string }[] = [
  { id: "student", title: "Estudiante", description: "Encuentra y gestiona tus prácticas universitarias." },
  { id: "company", title: "Empresa", description: "Publica ofertas y acompaña tu proceso de selección." },
  { id: "external", title: "Profesional", description: "Consulta las vacantes disponibles de la bolsa general." },
];

const copy: Record<View, { eyebrow: string; title: string; intro: string }> = {
  login: { eyebrow: "Acceso seguro", title: "Bienvenido de nuevo", intro: "Ingresa con el correo asociado a tu cuenta." },
  register: { eyebrow: "Nueva cuenta", title: "Crea tu cuenta", intro: "Selecciona el tipo de cuenta y completa tus datos." },
  forgot: { eyebrow: "Recupera tu acceso", title: "Restablece tu contraseña", intro: "Te enviaremos un enlace si el correo está registrado." },
  reset: { eyebrow: "Recupera tu acceso", title: "Crea una nueva contraseña", intro: "El enlace es válido durante 60 minutos y se usa una sola vez." },
};

const isStrongPassword = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value);

export default function AuthScreen({ state, login, register, clearResetToken }: Props) {
  const [view, setView] = useState<View>(state?.resetToken ? "reset" : "login");
  const [role, setRole] = useState<AccountType>("student");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const slowTimer = useRef<number>();

  // Despierta la API (Render en plan gratuito se suspende) mientras el usuario escribe.
  useEffect(() => {
    api.health().catch(() => undefined);
    return () => window.clearTimeout(slowTimer.current);
  }, []);

  const changeView = (next: View) => {
    setView(next);
    setError("");
    setInfo("");
    setPassword("");
    setConfirm("");
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

    if (view === "reset") {
      if (!isStrongPassword(password)) return setError("La contraseña debe cumplir todos los requisitos.");
      if (password !== confirm) return setError("Las contraseñas no coinciden.");
      const token = state?.resetToken;
      if (!token) return setError("El enlace de recuperación no es válido. Solicita uno nuevo.");
      await runRequest(async () => {
        const response = await api.resetPassword(token, password);
        clearResetToken?.();
        changeView("login");
        setInfo(response.message);
      }, "No se pudo restablecer la contraseña.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Ingresa un correo válido.");

    if (view === "forgot") {
      await runRequest(async () => {
        const response = await api.forgotPassword(email.trim());
        setInfo(response.message);
      }, "No se pudo enviar el enlace.");
      return;
    }

    if (view === "register") {
      if (!name.trim()) return setError("Ingresa tu nombre completo.");
      if (!isStrongPassword(password)) return setError("La contraseña debe cumplir todos los requisitos.");
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

  const submitLabel = submitting
    ? { login: "Iniciando sesión...", register: "Creando cuenta...", forgot: "Enviando...", reset: "Guardando..." }[view]
    : { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Enviar enlace", reset: "Guardar nueva contraseña" }[view];

  const needsPassword = view !== "forgot";
  const needsConfirm = view === "register" || view === "reset";

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
          <p className="eyebrow">{copy[view].eyebrow}</p>
          <h2>{copy[view].title}</h2>
          <p className="muted">{copy[view].intro}</p>

          {state?.notice && view === "login" && !info && <div className="form-error" role="status">{state.notice}</div>}
          {info && <div className="success-panel" role="status"><p>{info}</p></div>}

          {!(view === "forgot" && info) && (
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
              {view !== "reset" && (
                <Field
                  label={view === "register" && role === "student" ? "Correo institucional" : view === "register" && role === "company" ? "Correo corporativo" : "Correo"}
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                  hint={view === "register" ? role === "student" ? "Verificaremos tu vínculo con Unibagué mediante este correo." : role === "company" ? "La organización debe verificarse antes de publicar ofertas." : "Usa un correo que consultes con frecuencia." : undefined}
                />
              )}
              {needsPassword && (
                <>
                  <Field label={view === "reset" ? "Nueva contraseña" : "Contraseña"} value={password} onChange={setPassword} type={showPassword ? "text" : "password"} autoComplete={view === "login" ? "current-password" : "new-password"} />
                  <label className="check-row"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Mostrar contraseña</label>
                </>
              )}
              {needsConfirm && (
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
              <button className="button primary full" type="submit" disabled={submitting}>{submitLabel}</button>
            </form>
          )}

          <div className="auth-actions">
            {view === "login" ? (
              <>
                <button className="text-button" onClick={() => changeView("forgot")}>¿Olvidaste tu contraseña?</button>
                <p>¿Aún no tienes cuenta? <button className="text-button" onClick={() => changeView("register")}>Crear cuenta</button></p>
              </>
            ) : (
              <p>
                {view === "register" ? "¿Ya tienes una cuenta? " : ""}
                <button className="text-button" onClick={() => { if (view === "reset") clearResetToken?.(); changeView("login"); }}>
                  {view === "register" ? "Iniciar sesión" : "Volver a iniciar sesión"}
                </button>
              </p>
            )}
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
