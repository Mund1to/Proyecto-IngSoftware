import { useEffect, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import DueBadge from "../components/DueBadge";
import TypeBadge from "../components/TypeBadge";
import { IconArrowRight, IconBookmark, IconCalendar, IconCheck, IconClock, IconMail, IconMonitor, IconPin, IconPlus, IconVerified } from "../components/icons";
import { api, ProfileDetails } from "../lib/api";
import { daysUntil, formatDate, isValidDate } from "../lib/offers";
import { useSavedOffers } from "../lib/useStoredList";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void; applyToOffer: (offer: Offer) => Promise<void> };

const STEPS = [
  { title: "Enviada", text: "La empresa recibe tu perfil" },
  { title: "En revisión", text: "Revisan tu hoja de vida" },
  { title: "Entrevista", text: "Te contactan para conocerte" },
  { title: "Resultado", text: "Te avisamos por SIPU" },
];
// Paso alcanzado según el estado de la postulación (0 = sin postular).
const STEP_BY_STATUS: Record<string, number> = { Enviada: 1, "En revisión": 2, Entrevista: 3, Aceptada: 4, Rechazada: 4 };

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Habilidades de la oferta: el formulario de la empresa las guarda dentro de `requisitos`
// como texto separado por comas; se toman las partes cortas de cada requisito.
// El área de la oferta (que suele repetir el programa) no cuenta como habilidad.
function offerSkills(requirements: string[], area = ""): string[] {
  const seen = new Set<string>([normalize(area)]);
  return requirements
    .flatMap((item) => item.split(/[,;]/))
    .map((item) => item.trim())
    .filter((item) => item && item.length <= 40 && !seen.has(normalize(item)) && seen.add(normalize(item)));
}

export default function OfferDetail({ state, navigate, applyToOffer }: Props) {
  const offer = state.selectedOffer as (Offer & { affinity?: number }) | null;
  const application = offer ? state.applications.find((item) => item.offerId === offer.id) : undefined;
  const [applied, setApplied] = useState(Boolean(application));
  const [savedOffers, setSavedOffers] = useSavedOffers(state.currentUser?.id);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Detalle del perfil para comparar habilidades y calcular el avance; null si no se pudo cargar.
  const [details, setDetails] = useState<ProfileDetails | null>(null);

  useEffect(() => {
    if (!state.token) return;
    let active = true;
    api.getProfileDetails(state.token)
      .then((response) => { if (active) setDetails(response.details); })
      .catch(() => { if (active) setDetails(null); });
    return () => { active = false; };
  }, [state.token]);

  if (!offer) return null;

  const saved = savedOffers.includes(offer.id);
  const toggleSaved = () => setSavedOffers((current) => saved ? current.filter((id) => id !== offer.id) : [...current, offer.id]);
  const days = daysUntil(offer.closeDate);
  const closed = days < 0;
  const isTraining = offer.offerType === "FORMACION";
  const submit = async () => {
    setApplyError("");
    setSubmitting(true);
    try {
      await applyToOffer(offer);
      setApplied(true);
      setConfirming(false);
      setSuccess(true);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "No se pudo enviar la postulación.");
    } finally {
      setSubmitting(false);
    }
  };

  const skills = offerSkills(offer.requirements, offer.area);
  const mySkills = new Set((details?.skills ?? []).map((skill) => normalize(skill.nombre)));
  const hasSkill = (skill: string) => {
    const target = normalize(skill);
    return [...mySkills].some((mine) => mine && (target === mine || target.includes(mine) || mine.includes(target)));
  };
  const matchedSkills = details ? skills.filter(hasSkill).length : 0;

  const currentStep = applied ? STEP_BY_STATUS[application?.status ?? "Enviada"] ?? 1 : 0;
  const hasAffinity = typeof offer.affinity === "number" && Number.isFinite(offer.affinity);
  const affinity = hasAffinity ? Math.max(0, Math.min(100, Math.round(offer.affinity!))) : 0;
  // Barra de cuenta regresiva: avance dentro de los últimos 30 días antes del cierre.
  const showCountdown = isValidDate(offer.closeDate) && !closed;
  const countdown = showCountdown ? Math.max(4, Math.min(100, Math.round((1 - Math.min(days, 30) / 30) * 100))) : 0;
  const daysText = days === 0 ? "Cierra hoy" : days === 1 ? "1 día" : `${days} días`;
  const hasSalary = offer.salary !== "A convenir";

  // Avance del perfil: foto, educación, experiencia, habilidades y hoja de vida.
  const files = state.currentUser?.archivos ?? [];
  const profileSections = details ? [
    { done: files.some((file) => file.tipo === "FOTO"), tip: "Agrega una foto para que te reconozcan." },
    { done: details.education.length > 0, tip: "Registra tu educación en tu perfil." },
    { done: details.experience.length > 0, tip: "Cuenta tu experiencia, aunque sea académica." },
    { done: details.skills.length > 0, tip: "Agrega tus habilidades para mejorar tu afinidad." },
    { done: files.some((file) => file.tipo === "CV"), tip: "Sube tu hoja de vida en PDF" },
  ] : null;
  const profilePercent = profileSections ? Math.round((profileSections.filter((item) => item.done).length / profileSections.length) * 100) : 0;
  const nextTip = profileSections?.find((item) => !item.done)?.tip;

  return (
    <div className="app-shell">
      <NavBar role="student" navigate={navigate} activeScreen="student-dashboard" userName={state.currentUser?.nombreCompleto ?? "Estudiante"} />
      <main className="container detail-vivo">
        <button className="back-link" onClick={() => navigate("student-dashboard")}>
          <IconArrowRight className="back-link-icon" size={18} />
          Volver a ofertas
        </button>

        <section className="detail-hero">
          <span className="detail-mark" aria-hidden="true">{offer.logo}</span>
          <div className="detail-hero-main">
            <div className="detail-badges">
              <TypeBadge type={offer.offerType} />
              <DueBadge closeDate={offer.closeDate} />
            </div>
            <h1 className="display">{offer.title}</h1>
            <p className="detail-company">
              {offer.company}
              {offer.verified && <span className="detail-verified"><IconVerified label="" />Organización verificada</span>}
            </p>
            <div className="detail-chips">
              <span><IconPin size={15} />{offer.city}</span>
              <span><IconMonitor size={15} />{offer.modality}</span>
              <span>{offer.area}</span>
            </div>
          </div>
          {hasAffinity && (
            <div className="affinity-ring-wrap">
              <div className="affinity-ring" role="img" aria-label={`Afinidad con tu perfil: ${affinity}%`} style={{ background: `conic-gradient(var(--primary) 0 ${affinity}%, var(--primary-soft) ${affinity}% 100%)` }}>
                <div aria-hidden="true"><strong>{affinity}%</strong><small>afinidad</small></div>
              </div>
              <span aria-hidden="true">con tu perfil</span>
            </div>
          )}
        </section>

        <div className="detail-columns">
          <div className="detail-main">
            <section className="panel-card detail-panel">
              <h2>{isTraining ? "Lo que aprenderás" : "Lo que harás"}</h2>
              <p>{offer.description}</p>
            </section>

            <section className="panel-card detail-panel">
              <h2>Requisitos</h2>
              {offer.requirements.length ? (
                <ul className="detail-checks">
                  {offer.requirements.map((item, index) => (
                    <li key={index}><span className="detail-check" aria-hidden="true"><IconCheck size={15} /></span>{item}</li>
                  ))}
                </ul>
              ) : <p>Sin requisitos especificados.</p>}
            </section>

            {skills.length > 0 && (
              <section className="panel-card detail-panel">
                <div className="detail-panel-head">
                  <h2>Habilidades</h2>
                  {details && <span>Tienes {matchedSkills} de {skills.length} en tu perfil</span>}
                </div>
                <ul className="skill-chips">
                  {skills.map((skill) => {
                    const has = details ? hasSkill(skill) : null;
                    return (
                      <li key={skill} className={has === null ? "skill-chip" : has ? "skill-chip has" : "skill-chip missing"}>
                        {has === true && <IconCheck size={14} />}
                        {has === false && <IconPlus size={14} />}
                        {skill}
                        {has !== null && <span className="sr-only">{has ? " (ya está en tu perfil)" : " (no está en tu perfil)"}</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="panel-card detail-panel">
              <h2>Cómo es el proceso</h2>
              <ol className="process-steps">
                {STEPS.map((step, index) => {
                  const number = index + 1;
                  const reached = number <= currentStep;
                  return (
                    <li key={step.title} className={reached ? "is-reached" : ""} aria-current={number === currentStep ? "step" : undefined}>
                      <span className="process-step-head">
                        <span className="process-step-number" aria-hidden="true">{number}</span>
                        {number < STEPS.length && <span className="process-step-line" aria-hidden="true" />}
                      </span>
                      <strong>{step.title}</strong>
                      <small>{step.text}</small>
                    </li>
                  );
                })}
              </ol>
            </section>

            {(offer.duration || offer.schedule || offer.contactEmail) && (
              <div className="detail-facts">
                {offer.duration && <Fact icon={<IconCalendar />} label="Duración" value={offer.duration} />}
                {offer.schedule && <Fact icon={<IconClock />} label="Horario" value={offer.schedule} />}
                {offer.contactEmail && <Fact icon={<IconMail />} label="Contacto" value={offer.contactEmail} />}
              </div>
            )}
          </div>

          <aside className="detail-aside">
            <div className="apply-panel">
              <p className="apply-panel-label">Remuneración mensual</p>
              <p className="apply-panel-salary">{offer.salary.replace("/mes", "")}{hasSalary && <small> COP</small>}</p>
              <div className="apply-panel-deadline">
                <span>Fecha límite: {formatDate(offer.closeDate, "Sin fecha de cierre")}</span>
                {showCountdown && <strong>{daysText}</strong>}
              </div>
              {showCountdown && (
                <div className="apply-panel-track" role="img" aria-label={days === 0 ? "La oferta cierra hoy" : `Quedan ${daysText} para el cierre`}>
                  <div style={{ width: `${countdown}%` }} />
                </div>
              )}
              {applied && <p className="apply-panel-note"><IconCheck size={16} />Ya te postulaste. Consulta el estado en Mis postulaciones.</p>}
              {closed && !applied && <p className="apply-panel-note is-closed" role="status">Esta oferta cerró y ya no recibe postulaciones.</p>}
              {applyError && <div className="form-error" role="alert">{applyError}</div>}
              {applied ? (
                <button className="apply-panel-cta" onClick={() => navigate("student-applications")}>Ver mi postulación<IconArrowRight /></button>
              ) : (
                <button className="apply-panel-cta" disabled={closed} onClick={() => setConfirming(true)}>{isTraining ? "Inscribirme" : "Postularme"}<IconArrowRight /></button>
              )}
              <button className="apply-panel-ghost" aria-pressed={saved} onClick={toggleSaved}>
                <IconBookmark size={18} filled={saved} />
                {saved ? "Oferta guardada" : "Guardar oferta"}
              </button>
            </div>

            {profileSections && (
              <div className="ardy-tip">
                <ArdyMark className="ardy-tip-avatar bob" />
                <div>
                  <strong>Consejo de Ardy</strong>
                  <p>
                    Tu perfil está al {profilePercent} %.
                    {nextTip ? ` ${nextTip}${nextTip.startsWith("Sube") ? ` para destacar ante ${offer.company}.` : ""}` : " ¡Está completo, mucha suerte!"}
                  </p>
                  <div className="ardy-tip-track" role="progressbar" aria-label="Perfil completado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profilePercent}>
                    <div style={{ width: `${profilePercent}%` }} />
                  </div>
                  {profilePercent < 100 && <button className="text-button" onClick={() => navigate("student-profile")}>Completar mi perfil</button>}
                </div>
              </div>
            )}

            <div className="share-note-vivo">
              <strong>Información compartida</strong>
              <span>Nombre, correo, teléfono y datos académicos de tu perfil.</span>
            </div>
          </aside>
        </div>
      </main>

      {confirming && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirming(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e) => e.stopPropagation()}>
            <p className="eyebrow">Antes de enviar</p>
            <h2 id="confirm-title">Confirma tu postulación</h2>
            <p>La empresa recibirá los datos de tu perfil SIPU:</p>
            <div className="cv-row"><span aria-hidden="true">SIPU</span><div><strong>Tu perfil SIPU</strong><small>Revisa tu perfil antes de enviar la postulación.</small></div><button className="text-button" onClick={() => navigate("student-profile")}>Ver perfil</button></div>
            {applyError && <div className="form-error" role="alert">{applyError}</div>}
            <div className="modal-actions"><button className="button secondary" onClick={() => setConfirming(false)}>Cancelar</button><button className="button primary" disabled={submitting} onClick={() => void submit()}>{submitting ? "Enviando..." : "Confirmar postulación"}</button></div>
          </section>
        </div>
      )}

      {success && (
        <div className="modal-backdrop">
          <section className="modal success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title">
            <div className="success-icon" aria-hidden="true"><IconCheck size={30} /></div>
            <h2 id="success-title">Postulación enviada</h2>
            <p>{offer.company} recibió tu postulación. Puedes consultar el estado en cualquier momento.</p>
            <button className="button primary full" onClick={() => navigate("student-applications")}>Ver mi postulación</button>
            <button className="button secondary full" onClick={() => setSuccess(false)}>Permanecer aquí</button>
          </section>
        </div>
      )}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel-card detail-fact">
      <span className="detail-fact-icon" aria-hidden="true">{icon}</span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </div>
  );
}
