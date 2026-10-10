import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { AppState, Role, Screen } from "../App";
import { api } from "../lib/api";
import ArdyMark from "../components/ArdyMark";
import UniversityLogo from "../components/UniversityLogo";
import { IconArrowRight, IconBriefcase, IconBuilding, IconCheck, IconEye, IconEyeOff, IconGraduation, IconLock, IconMail, IconUser } from "../components/icons";

type Props = {
  state?: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  login?: (email: string, password: string) => Promise<void>;
  register?: (payload: Record<string, unknown>) => Promise<void>;
  clearResetToken?: () => void;
};
type View = "login" | "register" | "forgot" | "reset";

type AccountType = Exclude<Role, "admin">;

const roles: { id: AccountType; title: string; description: string; icon: typeof IconGraduation }[] = [
  { id: "student", title: "Estudiante", description: "Encuentra y gestiona tus prácticas universitarias.", icon: IconGraduation },
  { id: "external", title: "Profesional", description: "Consulta las vacantes disponibles de la bolsa general.", icon: IconBriefcase },
  { id: "company", title: "Empresa", description: "Publica ofertas y acompaña tu proceso de selección.", icon: IconBuilding },
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
  const tabbed = view === "login" || view === "register";
  const passwordType = showPassword ? "text" : "password";
  const eye = <EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />;

  // Control segmentado: las flechas mueven entre "Iniciar sesión" y "Crear cuenta".
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = view === "login" ? "register" : "login";
    changeView(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Presentación de SIPU">
        <div className="dots auth-brand-dots" aria-hidden="true" />
        <div className="auth-brand-top">
          <UniversityLogo className="auth-brand-logo" />
          <span className="auth-brand-tag">Universidad de Ibagué</span>
        </div>
        <div>
          <h1 className="display">Tu talento encuentra <span className="highlight">oportunidades reales.</span></h1>
          <p className="auth-intro">Prácticas, empleo y formación en un solo lugar, con empresas verificadas por la universidad.</p>
        </div>
        <div className="auth-orbit">
          <span className="auth-orbit-ring" aria-hidden="true" />
          <span className="auth-orbit-glow" aria-hidden="true" />
          <ArdyMark className="auth-orbit-ardy" />
          <div className="auth-float auth-float-a" aria-hidden="true">
            <span className="auth-float-logo">TS</span>
            <span><strong>Practicante web</strong><small>Ibagué · Híbrida</small></span>
          </div>
          <div className="auth-float auth-float-b" aria-hidden="true"><IconCheck size={18} />Empresa verificada</div>
          <div className="auth-float auth-float-c" aria-hidden="true">
            <span className="auth-float-dot" />
            <span><strong>Tu postulación</strong> pasó a entrevista</span>
          </div>
        </div>
        <ul className="auth-audiences" aria-label="Para quién es SIPU">
          <li>Estudiantes</li>
          <li>Profesionales</li>
          <li>Empresas</li>
        </ul>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-logo"><UniversityLogo /></div>
        <div className="auth-card">
          <p className="eyebrow">{copy[view].eyebrow}</p>
          <h2>{copy[view].title}</h2>
          <p className="auth-lead">{copy[view].intro}</p>

          {tabbed && (
            <div className="auth-tabs" role="tablist" aria-label="Acceso" onKeyDown={onTabKey}>
              {(["login", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`auth-tab-${tab}`}
                  type="button"
                  role="tab"
                  aria-selected={view === tab}
                  aria-controls="auth-form"
                  tabIndex={view === tab ? 0 : -1}
                  className={view === tab ? "auth-tab is-active" : "auth-tab"}
                  onClick={() => { if (view !== tab) changeView(tab); }}
                >
                  {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              ))}
            </div>
          )}

          {state?.notice && view === "login" && !info && <div className="form-error" role="status">{state.notice}</div>}
          {info && <div className="success-panel" role="status"><p>{info}</p></div>}

          {!(view === "forgot" && info) && (
            <form
              key={view}
              id="auth-form"
              className="auth-form"
              onSubmit={submit}
              noValidate
              aria-busy={submitting}
              role={tabbed ? "tabpanel" : undefined}
              aria-labelledby={tabbed ? `auth-tab-${view}` : undefined}
            >
              {view === "register" && (
                <>
                  <fieldset className="role-picker">
                    <legend>Tipo de cuenta</legend>
                    {roles.map((item) => {
                      const Icon = item.icon;
                      return (
                        <label key={item.id} className={role === item.id ? "role-card is-selected" : "role-card"}>
                          <input type="radio" name="role" value={item.id} checked={role === item.id} onChange={() => setRole(item.id)} />
                          <span className={`role-card-icon role-card-icon-${item.id}`} aria-hidden="true"><Icon size={22} /></span>
                          <span className="role-card-text"><strong>{item.title}</strong><small>{item.description}</small></span>
                          <span className="role-card-radio" aria-hidden="true" />
                        </label>
                      );
                    })}
                  </fieldset>
                  <Field
                    label={role === "company" ? "Nombre de la organización" : "Nombre completo"}
                    icon={role === "company" ? <IconBuilding /> : <IconUser />}
                    value={name}
                    onChange={setName}
                    autoComplete={role === "company" ? "organization" : "name"}
                  />
                </>
              )}
              {view !== "reset" && (
                <Field
                  label={view === "register" && role === "student" ? "Correo institucional" : view === "register" && role === "company" ? "Correo corporativo" : "Correo"}
                  icon={<IconMail />}
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                  hint={view === "register" ? role === "student" ? "Verificaremos tu vínculo con Unibagué mediante este correo." : role === "company" ? "La organización debe verificarse antes de publicar ofertas." : "Usa un correo que consultes con frecuencia." : undefined}
                />
              )}
              {needsPassword && (
                <Field
                  label={view === "reset" ? "Nueva contraseña" : "Contraseña"}
                  icon={<IconLock />}
                  value={password}
                  onChange={setPassword}
                  type={passwordType}
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                  trailing={eye}
                  aside={view === "login" && <button type="button" className="text-button auth-forgot" onClick={() => changeView("forgot")}>¿Olvidaste tu contraseña?</button>}
                />
              )}
              {needsConfirm && (
                <>
                  <Field label="Confirmar contraseña" icon={<IconLock />} value={confirm} onChange={setConfirm} type={passwordType} autoComplete="new-password" />
                  <ul className="password-rules" aria-label="Requisitos de contraseña">
                    <li className={password.length >= 8 ? "valid" : ""}>Mínimo 8 caracteres</li>
                    <li className={/[A-Z]/.test(password) ? "valid" : ""}>Una mayúscula</li>
                    <li className={/\d/.test(password) ? "valid" : ""}>Un número</li>
                  </ul>
                </>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              {slowServer && <p className="muted" role="status">El servidor se está activando. Esto puede tardar hasta un minuto la primera vez.</p>}
              <button className="button primary full auth-cta" type="submit" disabled={submitting}>
                {submitLabel}
                {!submitting && <IconArrowRight className="auth-cta-arrow" />}
              </button>

              {view === "login" && (
                <>
                  <p className="auth-divider"><span>¿Eres nuevo? Elige tu perfil</span></p>
                  <div className="role-tiles">
                    {roles.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.id} type="button" className="role-tile" aria-label={`Crear cuenta de ${item.title.toLowerCase()}`} onClick={() => { setRole(item.id); changeView("register"); }}>
                          <span className={`role-card-icon role-card-icon-${item.id}`} aria-hidden="true"><Icon size={22} /></span>
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </form>
          )}

          {!tabbed && (
            <div className="auth-actions">
              <button className="text-button" onClick={() => { if (view === "reset") clearResetToken?.(); changeView("login"); }}>
                Volver a iniciar sesión
              </button>
            </div>
          )}
          <p className="legal">Al continuar confirmas que tus datos se usarán para gestionar tu cuenta y tus postulaciones.</p>
        </div>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  autoComplete?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  aside?: ReactNode;
};

function Field({ label, value, onChange, type = "text", hint, autoComplete, icon, trailing, aside }: FieldProps) {
  const id = label.toLowerCase().replace(/\s/g, "-");
  return (
    <div className="field auth-field">
      <div className="auth-field-head">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className={trailing ? "auth-input has-trailing" : "auth-input"}>
        {icon && <span className="auth-input-icon" aria-hidden="true">{icon}</span>}
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-describedby={hint ? `${id}-hint` : undefined} />
        {trailing}
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="auth-eye" aria-label="Mostrar contraseña" aria-pressed={shown} title={shown ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={onToggle}>
      {shown ? <IconEyeOff /> : <IconEye />}
    </button>
  );
}
