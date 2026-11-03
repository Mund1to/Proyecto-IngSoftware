// Lo que el candidato ve de su proceso en cada postulación: la entrevista
// programada (con opción de agregarla al calendario), el último mensaje de la
// empresa, el historial y la hoja de vida que envió (reemplazable mientras siga Enviada).
import { useEffect, useRef, useState } from "react";
import { buildIcs, downloadIcs } from "../../shared/lib/calendar";
import { formatSize } from "../../shared/lib/files";
import { formatDate } from "../../shared/lib/format";
import { IconCalendar, IconClock, IconFile, IconMail, IconMonitor, IconPin } from "../../shared/ui/icons";
import { validateFile } from "../profile/ProfileFiles";
import { applicationsApi } from "./applications.api";
import {
  INTERVIEW_MODE_LABELS,
  describeEvent,
  formatInterviewDate,
  lastCompanyMessage,
  type Application,
  type Interview,
} from "./applications.model";

type Props = { app: Application; token: string | null; onChanged: () => Promise<void> };

export function InterviewCard({ interview, title, company, uid }: { interview: Interview; title: string; company: string; uid: string }) {
  const mode = INTERVIEW_MODE_LABELS[interview.modalidad] ?? interview.modalidad;
  const isLink = interview.modalidad === "VIRTUAL" && interview.lugar;
  const addToCalendar = () => downloadIcs(`entrevista-${uid}.ics`, buildIcs({
    uid: `entrevista-${uid}`,
    title: `Entrevista: ${title} (${company})`,
    start: interview.fecha,
    minutes: interview.duracionMinutos ?? 30,
    location: interview.lugar,
    description: `Entrevista ${mode.toLowerCase()} con ${company} para ${title}. Detalles en SIPU.`,
  }));
  return (
    <div className="interview-card">
      <span className="interview-card-icon" aria-hidden="true"><IconCalendar size={22} /></span>
      <div className="interview-card-body">
        <strong>Entrevista {mode.toLowerCase()}</strong>
        <span className="interview-card-date">{formatInterviewDate(interview.fecha)} <small>(hora de Colombia)</small></span>
        <ul>
          {interview.lugar && (
            <li>
              {interview.modalidad === "VIRTUAL" ? <IconMonitor size={15} /> : <IconPin size={15} />}
              {isLink ? <a href={interview.lugar!} target="_blank" rel="noreferrer">Unirse a la reunión</a> : interview.lugar}
            </li>
          )}
          {interview.duracionMinutos && <li><IconClock size={15} />{interview.duracionMinutos} minutos</li>}
        </ul>
      </div>
      <button type="button" className="button secondary interview-card-action" onClick={addToCalendar}>Agregar a mi calendario</button>
    </div>
  );
}

export default function ApplicationActivity({ app, token, onChanged }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const events = app.events ?? [];
  const message = lastCompanyMessage(events);
  const canReplaceCv = app.status === "Enviada";

  const replaceCv = async (file: File | undefined) => {
    if (!file || !token) return;
    const problem = validateFile("cv", file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await applicationsApi.uploadApplicationCv(app.id, file, token);
      setDone(`Se adjuntó ${file.name} a esta postulación.`);
      await onChanged();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo adjuntar la hoja de vida.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const openCv = () => token && void applicationsApi.openApplicationCv(app.id, token).catch((openError) => setError(openError instanceof Error ? openError.message : "No se pudo abrir la hoja de vida."));

  return (
    <div className="application-activity">
      {app.status === "Entrevista" && app.interview && (
        <InterviewCard interview={app.interview} title={app.offerTitle} company={app.company} uid={String(app.id)} />
      )}

      {message && (
        <blockquote className="company-message">
          <span className="company-message-head"><IconMail size={15} />Mensaje de {app.company} · {formatDate(message.fecha)}</span>
          <p>{message.mensaje}</p>
        </blockquote>
      )}

      <div className="sent-cv">
        <span className="sent-cv-icon" aria-hidden="true"><IconFile size={18} /></span>
        <span className="sent-cv-text">
          {app.cv ? (
            <>
              <strong>Hoja de vida enviada: {app.cv.nombre}</strong>
              <small>{app.cv.origen === "PROPIO" ? "Subida solo para esta oferta" : "Copia de la de tu perfil"} · {formatSize(app.cv.tamano)}{app.cv.fecha ? ` · ${formatDate(app.cv.fecha)}` : ""}</small>
            </>
          ) : (
            <>
              <strong>Enviaste esta postulación sin hoja de vida</strong>
              <small>{canReplaceCv ? "Puedes adjuntar una mientras la empresa no empiece a revisarla." : "La empresa ve los datos de tu perfil SIPU."}</small>
            </>
          )}
        </span>
        <span className="sent-cv-actions">
          {app.cv && <button type="button" className="text-button" onClick={openCv}>Ver</button>}
          {canReplaceCv && <button type="button" className="text-button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "Subiendo..." : app.cv ? "Cambiar" : "Adjuntar"}</button>}
        </span>
        <input ref={fileInput} className="sr-only" type="file" accept="application/pdf,.pdf" aria-label={`Hoja de vida para ${app.offerTitle}`} onChange={(event) => void replaceCv(event.target.files?.[0])} />
      </div>
      {error && <p className="vf-error" role="alert">{error}</p>}
      {done && !error && <p className="vf-hint" role="status">{done}</p>}

      {events.length > 0 && (
        <div className="application-history">
          <button type="button" className="text-button" aria-expanded={showHistory} onClick={() => setShowHistory((current) => !current)}>
            {showHistory ? "Ocultar historial" : `Ver historial (${events.length})`}
          </button>
          {showHistory && (
            <ol className="timeline">
              {events.map((event) => (
                <li key={event.id} className={`timeline-item timeline-${event.tipo.toLowerCase()}`}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{describeEvent(event, "candidate")}</strong>
                    <time dateTime={event.fecha}>{formatDate(event.fecha)}</time>
                    {event.entrevista && <p>{formatInterviewDate(event.entrevista.fecha)} · {INTERVIEW_MODE_LABELS[event.entrevista.modalidad]}</p>}
                    {event.mensaje && event.tipo !== "CV" && <p className="timeline-message">“{event.mensaje}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

const WITHDRAW_REASONS = ["Acepté otra oferta", "Ya no me interesa la vacante", "Las condiciones no me convienen", "Cambié de planes"];

// Confirmación del retiro con motivo opcional (queda en el historial que ve la empresa).
export function WithdrawDialog({ offerTitle, busy, onCancel, onConfirm }: { offerTitle: string; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) onCancel(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="withdraw-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Retirar postulación</p>
        <h2 id="withdraw-title">¿Retirar tu postulación a {offerTitle}?</h2>
        <p>La empresa dejará de considerarla. Esta acción no se puede deshacer.</p>
        <fieldset className="vf-choice">
          <legend className="vf-label">Motivo (opcional)</legend>
          <div className="vf-choice-options">
            {WITHDRAW_REASONS.map((option, index) => (
              <label key={option} className={`vf-option ${reason === option ? "is-selected" : ""}`}>
                <input ref={index === 0 ? first : undefined} type="radio" name="withdraw-reason" checked={reason === option} onChange={() => setReason(option)} />
                <span className="vf-option-text"><strong>{option}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Conservar postulación</button>
          <button type="button" className="button primary danger" disabled={busy} onClick={() => onConfirm(reason)}>{busy ? "Retirando..." : "Retirar postulación"}</button>
        </div>
      </section>
    </div>
  );
}
