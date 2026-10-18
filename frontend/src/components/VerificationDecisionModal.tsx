import { useEffect, useState } from "react";
import { MIN_REJECTION_REASON } from "../lib/verification";

type Props = {
  organizationName: string;
  decision: "APROBADA" | "RECHAZADA";
  onConfirm: (observaciones: string) => Promise<void>;
  onClose: () => void;
};

// Confirma la decisión del revisor. Rechazar exige un motivo que la empresa
// verá en "Mi empresa" y en el correo (reemplaza el window.prompt anterior).
export default function VerificationDecisionModal({ organizationName, decision, onConfirm, onClose }: Props) {
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reject = decision === "RECHAZADA";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (reject && observaciones.trim().length < MIN_REJECTION_REASON) {
      return setError(`Explica el motivo del rechazo (mínimo ${MIN_REJECTION_REASON} caracteres) para que la empresa pueda corregirlo.`);
    }
    setSaving(true);
    try {
      await onConfirm(observaciones.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la decisión.");
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void submit(event)} noValidate>
        <p className="eyebrow">Verificación de organizaciones</p>
        <h2 id="decision-title">{reject ? "Rechazar solicitud" : "Aprobar verificación"}</h2>
        <p className="muted">
          {reject
            ? <>La empresa <strong>{organizationName}</strong> verá el motivo y podrá corregir sus documentos.</>
            : <>La empresa <strong>{organizationName}</strong> quedará verificada y sus ofertas mostrarán el sello.</>}
        </p>
        <label className="field">
          <span>{reject ? "Motivo del rechazo" : "Observaciones (opcional)"}</span>
          <textarea
            rows={4}
            maxLength={1000}
            autoFocus
            className="block w-full mt-1.5 rounded-[10px] border border-[var(--border)] p-3 text-sm"
            value={observaciones}
            placeholder={reject ? "Por ejemplo: el certificado de Cámara de Comercio tiene más de 30 días." : "Por ejemplo: RUT y Cámara de Comercio vigentes."}
            onChange={(event) => setObservaciones(event.target.value)}
          />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? "Guardando..." : reject ? "Rechazar solicitud" : "Aprobar verificación"}
          </button>
        </div>
      </form>
    </div>
  );
}
