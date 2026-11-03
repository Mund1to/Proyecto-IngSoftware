// Diálogo para mover a un candidato de etapa con lo que esa etapa necesita:
// citar o reprogramar la entrevista (fecha, hora, modalidad, lugar o enlace),
// seleccionar, descartar con un mensaje y reabrir un proceso cerrado.
// El mensaje lo recibe el candidato en SIPU y por correo.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChoiceGroup, FormField } from "../../shared/ui/form";
import { IconMonitor, IconPin, IconUser } from "../../shared/ui/icons";
import { INTERVIEW_MODE_LABELS, formatInterviewDate, type InterviewMode } from "./applications.model";
import { REJECTION_TEMPLATES, acceptanceMessageTemplate, interviewMessageTemplate, type Applicant, type Stage } from "./applicants.model";
import type { StageChange } from "./applications.api";

export type DialogMode = "interview" | "accept" | "reject" | "reopen";

type Props = {
  mode: DialogMode;
  applicant: Applicant;
  company: string;
  isTraining: boolean;
  // Vacantes de la oferta y cuántas ya están cubiertas (para avisar al seleccionar).
  vacancies: number;
  accepted: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (status: Stage, change: StageChange) => void;
};

const DURATIONS = [30, 45, 60, 90];

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDate(date); };
const maxDate = () => { const date = new Date(); date.setDate(date.getDate() + 180); return localDate(date); };

function initialInterview(applicant: Applicant) {
  const current = applicant.interview;
  if (current) {
    const date = new Date(current.fecha);
    return {
      date: localDate(date),
      time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      mode: current.modalidad,
      place: current.lugar ?? "",
      minutes: current.duracionMinutos ?? 45,
    };
  }
  return { date: tomorrow(), time: "09:00", mode: "VIRTUAL" as InterviewMode, place: "", minutes: 45 };
}

export default function StageDialog({ mode, applicant, company, isTraining, vacancies, accepted, busy, error, onCancel, onConfirm }: Props) {
  const rescheduling = mode === "interview" && applicant.status === "PRESELECCIONADA";
  const [interview, setInterview] = useState(() => initialInterview(applicant));
  const [template, setTemplate] = useState(REJECTION_TEMPLATES[0].id);
  const [message, setMessage] = useState(() => {
    if (mode === "interview") return rescheduling ? "Tuvimos que mover la fecha de tu entrevista. Disculpa las molestias." : interviewMessageTemplate(applicant.name, company);
    if (mode === "accept") return acceptanceMessageTemplate(applicant.name, isTraining);
    if (mode === "reject") return REJECTION_TEMPLATES[0].text;
    return "";
  });
  const [localError, setLocalError] = useState("");
  const firstField = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const when = useMemo(() => new Date(`${interview.date}T${interview.time || "00:00"}`), [interview.date, interview.time]);

  const validateInterview = (): string => {
    if (!interview.date || !interview.time || !Number.isFinite(when.getTime())) return "Indica la fecha y la hora de la entrevista.";
    if (when.getTime() <= Date.now()) return "La entrevista debe ser en una fecha y hora futuras.";
    if (interview.mode === "VIRTUAL" && !/^https?:\/\/\S+$/i.test(interview.place.trim())) return "Pega el enlace de la reunión (debe empezar por https://).";
    if (interview.mode === "PRESENCIAL" && interview.place.trim().length < 5) return "Escribe la dirección o el lugar de la entrevista.";
    return "";
  };

  const confirm = () => {
    const trimmed = message.trim();
    if (mode === "interview") {
      const problem = validateInterview();
      if (problem) {
        setLocalError(problem);
        return;
      }
      onConfirm("PRESELECCIONADA", {
        mensaje: trimmed || undefined,
        entrevista: { fecha: when.toISOString(), modalidad: interview.mode, lugar: interview.place.trim() || null, duracionMinutos: interview.minutes },
      });
      return;
    }
    onConfirm(mode === "accept" ? "ACEPTADA" : mode === "reject" ? "RECHAZADA" : "EN_REVISION", { mensaje: trimmed || undefined });
  };

  const first = applicant.name.split(/\s+/)[0] ?? applicant.name;
  const titles: Record<DialogMode, string> = {
    interview: rescheduling ? `Reprogramar la entrevista de ${first}` : `Citar a ${first} a entrevista`,
    accept: isTraining ? `Aceptar la inscripción de ${first}` : `Seleccionar a ${first}`,
    reject: `Descartar a ${first}`,
    reopen: `Reabrir el proceso de ${first}`,
  };
  const confirmLabels: Record<DialogMode, string> = {
    interview: rescheduling ? "Guardar nueva fecha" : "Enviar citación",
    accept: isTraining ? "Aceptar inscripción" : "Confirmar selección",
    reject: "Descartar candidato",
    reopen: "Reabrir y pasar a revisión",
  };
  const exceeds = mode === "accept" && accepted >= vacancies;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) onCancel(); }}>
      <section className="modal stage-dialog" role="dialog" aria-modal="true" aria-labelledby="stage-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">{mode === "reject" ? "Decisión" : mode === "accept" ? "Decisión final" : mode === "reopen" ? "Proceso cerrado" : "Siguiente etapa"}</p>
        <h2 id="stage-dialog-title" tabIndex={-1} ref={firstField}>{titles[mode]}</h2>

        {mode === "interview" && (
          <div className="stage-dialog-grid">
            <FormField label="Fecha" required>
              {({ id }) => <input id={id} type="date" min={tomorrow()} max={maxDate()} value={interview.date} onChange={(event) => setInterview((current) => ({ ...current, date: event.target.value }))} />}
            </FormField>
            <FormField label="Hora" required hint="Hora de Colombia.">
              {({ id, describedBy }) => <input id={id} type="time" step={900} aria-describedby={describedBy} value={interview.time} onChange={(event) => setInterview((current) => ({ ...current, time: event.target.value }))} />}
            </FormField>
            <div className="full-span">
              <ChoiceGroup<InterviewMode> legend="Modalidad" name="interview-mode" value={interview.mode} variant="pills"
                onChange={(value) => setInterview((current) => ({ ...current, mode: value }))}
                options={[
                  { value: "VIRTUAL", label: INTERVIEW_MODE_LABELS.VIRTUAL, icon: <IconMonitor size={16} /> },
                  { value: "PRESENCIAL", label: INTERVIEW_MODE_LABELS.PRESENCIAL, icon: <IconPin size={16} /> },
                  { value: "TELEFONICA", label: INTERVIEW_MODE_LABELS.TELEFONICA, icon: <IconUser size={16} /> },
                ]} />
            </div>
            <FormField className="full-span" label={interview.mode === "VIRTUAL" ? "Enlace de la reunión" : interview.mode === "PRESENCIAL" ? "Dirección" : "Número o indicaciones (opcional)"}
              required={interview.mode !== "TELEFONICA"} hint={interview.mode === "VIRTUAL" ? "Google Meet, Teams, Zoom…" : interview.mode === "TELEFONICA" ? `Llamarás al ${applicant.phone || "teléfono del perfil"}.` : undefined}>
              {({ id, describedBy }) => (
                <input id={id} aria-describedby={describedBy} value={interview.place} maxLength={300}
                  placeholder={interview.mode === "VIRTUAL" ? "https://meet.google.com/..." : interview.mode === "PRESENCIAL" ? "Calle 67 # 22-31, oficina 402, Ibagué" : ""}
                  onChange={(event) => setInterview((current) => ({ ...current, place: event.target.value }))} />
              )}
            </FormField>
            <div className="full-span">
              <ChoiceGroup<string> legend="Duración" name="interview-duration" value={String(interview.minutes)}
                onChange={(value) => setInterview((current) => ({ ...current, minutes: Number(value) }))}
                options={DURATIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))} />
            </div>
            {Number.isFinite(when.getTime()) && when.getTime() > Date.now() && (
              <p className="stage-dialog-preview full-span">El candidato verá: <strong>{formatInterviewDate(when.toISOString())}</strong>, {INTERVIEW_MODE_LABELS[interview.mode].toLowerCase()}, {interview.minutes} minutos.</p>
            )}
          </div>
        )}

        {mode === "reject" && (
          <ChoiceGroup<string> legend="Motivo" name="reject-reason" value={template}
            onChange={(value) => {
              setTemplate(value);
              const found = REJECTION_TEMPLATES.find((item) => item.id === value);
              if (found) setMessage(found.text);
            }}
            options={REJECTION_TEMPLATES.map((item) => ({ value: item.id, label: item.label }))} />
        )}

        {mode === "accept" && (
          <p className={`stage-dialog-vacancies ${exceeds ? "is-warning" : ""}`}>
            {exceeds
              ? `Ya cubriste ${accepted} de ${vacancies} ${vacancies === 1 ? "vacante" : "vacantes"}. Puedes seleccionar a ${first} de todas formas.`
              : `Con ${first} cubrirás ${accepted + 1} de ${vacancies} ${vacancies === 1 ? "vacante" : "vacantes"}.`}
          </p>
        )}

        {mode === "reopen" && <p>La postulación volverá a <strong>En revisión</strong> y el candidato verá que reabriste su proceso.</p>}

        <div className="vf-field">
          <label htmlFor="stage-message" className="vf-label">Mensaje para {first} {mode === "reopen" ? <span className="muted">(opcional)</span> : null}</label>
          <textarea id="stage-message" rows={4} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)}
            placeholder={mode === "reopen" ? "Cuéntale por qué retomas su proceso." : ""} />
          <small className="vf-hint">Lo verá en Mis postulaciones y le llegará por correo{mode === "reopen" ? " si escribes algo" : ""}.</small>
        </div>

        {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button type="button" className={`button primary ${mode === "reject" ? "danger" : ""}`} disabled={busy} onClick={confirm}>{busy ? "Guardando..." : confirmLabels[mode]}</button>
        </div>
      </section>
    </div>
  );
}
