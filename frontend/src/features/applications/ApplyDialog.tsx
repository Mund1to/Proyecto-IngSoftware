// Confirmación de la postulación: el candidato elige qué hoja de vida enviar
// (la de su perfil, una distinta solo para esta oferta o ninguna) y puede dejar
// un mensaje. La empresa recibe una copia: cambios posteriores del perfil no la alteran.
import { useEffect, useRef, useState } from "react";
import type { StoredFile } from "../../shared/api/account";
import { formatSize } from "../../shared/lib/files";
import { formatDate } from "../../shared/lib/format";
import { IconFile } from "../../shared/ui/icons";
import { validateFile } from "../profile/ProfileFiles";
import { profileApi } from "../profile/profile.api";

export type CvChoice = "PERFIL" | "PROPIO" | "NINGUNA";
export type ApplyOptions = { coverLetter: string; cv: CvChoice; cvFile: File | null };

export const MAX_COVER_LETTER = 1500;

type Props = {
  token: string | null;
  offerTitle: string;
  company: string;
  isTraining: boolean;
  profileCv?: StoredFile;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (options: ApplyOptions) => void;
  onOpenProfile: () => void;
};

export default function ApplyDialog({ token, offerTitle, company, isTraining, profileCv, submitting, error, onCancel, onConfirm, onOpenProfile }: Props) {
  const [cv, setCv] = useState<CvChoice>(profileCv ? "PERFIL" : "PROPIO");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);

  // Escape cierra el diálogo; el foco empieza en la elección de hoja de vida.
  useEffect(() => {
    firstOption.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !submitting) onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, submitting]);

  const pickFile = (file: File | undefined) => {
    setLocalError("");
    if (!file) return;
    const problem = validateFile("cv", file);
    setFileError(problem ?? "");
    setCvFile(problem ? null : file);
    if (!problem) setCv("PROPIO");
  };

  const confirm = () => {
    if (cv === "PROPIO" && !cvFile) {
      setLocalError("Selecciona el PDF que quieres enviar a esta oferta o elige otra opción.");
      fileInput.current?.focus();
      return;
    }
    onConfirm({ coverLetter: message.trim(), cv, cvFile: cv === "PROPIO" ? cvFile : null });
  };

  const verb = isTraining ? "inscripción" : "postulación";

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!submitting) onCancel(); }}>
      <section className="modal apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Antes de enviar</p>
        <h2 id="apply-title">Confirma tu {verb}</h2>
        <p>Vas a postularte a <strong>{offerTitle}</strong> en {company}.</p>

        <fieldset className="apply-cv-options">
          <legend>Hoja de vida que enviarás</legend>
          <label className={`apply-cv-option ${cv === "PERFIL" ? "is-selected" : ""} ${profileCv ? "" : "is-disabled"}`}>
            <input ref={profileCv ? firstOption : undefined} type="radio" name="apply-cv" checked={cv === "PERFIL"} disabled={!profileCv} onChange={() => setCv("PERFIL")} />
            <span className="apply-cv-icon" aria-hidden="true"><IconFile size={20} /></span>
            <span className="apply-cv-text">
              <strong>La de mi perfil</strong>
              {profileCv
                ? <small>{profileCv.nombre} · {formatSize(profileCv.tamano)}{profileCv.createdAt || profileCv.created_at ? ` · subida el ${formatDate(profileCv.createdAt ?? profileCv.created_at)}` : ""}</small>
                : <small>Aún no tienes una hoja de vida en tu perfil.</small>}
            </span>
            {profileCv && token && <button type="button" className="text-button" onClick={() => void profileApi.openMyFile("cv", token).catch(() => setLocalError("No se pudo abrir la hoja de vida de tu perfil."))}>Ver</button>}
          </label>

          <label className={`apply-cv-option ${cv === "PROPIO" ? "is-selected" : ""}`}>
            <input ref={profileCv ? undefined : firstOption} type="radio" name="apply-cv" checked={cv === "PROPIO"} onChange={() => setCv("PROPIO")} />
            <span className="apply-cv-icon" aria-hidden="true"><IconFile size={20} /></span>
            <span className="apply-cv-text">
              <strong>Una distinta, solo para esta oferta</strong>
              <small>{cvFile ? `${cvFile.name} · ${formatSize(cvFile.size)}` : "PDF de máximo 5 MB. No reemplaza la de tu perfil."}</small>
            </span>
            <button type="button" className="text-button" onClick={() => fileInput.current?.click()}>{cvFile ? "Cambiar" : "Elegir PDF"}</button>
          </label>
          <input ref={fileInput} className="sr-only" type="file" accept="application/pdf,.pdf" aria-label="PDF para esta postulación" onChange={(event) => pickFile(event.target.files?.[0])} />

          <label className={`apply-cv-option ${cv === "NINGUNA" ? "is-selected" : ""}`}>
            <input type="radio" name="apply-cv" checked={cv === "NINGUNA"} onChange={() => setCv("NINGUNA")} />
            <span className="apply-cv-text">
              <strong>Enviar sin hoja de vida</strong>
              <small>La empresa solo verá los datos de tu perfil SIPU.</small>
            </span>
          </label>
          {fileError && <small className="vf-error" role="alert">{fileError}</small>}
        </fieldset>

        <p className="apply-note">
          La empresa recibe una copia de lo que envíes hoy: si después cambias tu hoja de vida para otra oferta, esta {verb} no cambia.
          Podrás reemplazarla desde Mis postulaciones mientras la empresa no empiece a revisarla.
        </p>

        <div className="vf-field">
          <div className="vf-label-row">
            <label htmlFor="apply-message" className="vf-label">Mensaje para {company} <span className="muted">(opcional)</span></label>
            <span className={`vf-counter ${message.length > MAX_COVER_LETTER ? "is-over" : ""}`} aria-hidden="true">{message.length}/{MAX_COVER_LETTER}</span>
          </div>
          <textarea id="apply-message" rows={4} maxLength={MAX_COVER_LETTER} value={message} placeholder="Cuéntale por qué te interesa y qué puedes aportar."
            onChange={(event) => setMessage(event.target.value)} />
        </div>

        <p className="apply-shared">
          Compartirás tu nombre, correo, teléfono, datos académicos, formación, experiencia y habilidades.{" "}
          <button type="button" className="text-button" onClick={onOpenProfile}>Revisar mi perfil</button>
        </p>

        {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={submitting} onClick={onCancel}>Cancelar</button>
          <button type="button" className="button primary" disabled={submitting} onClick={confirm}>{submitting ? "Enviando..." : `Confirmar ${verb}`}</button>
        </div>
      </section>
    </div>
  );
}
