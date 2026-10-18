import { useEffect, useState, type ReactNode } from "react";
import { MIN_REJECTION_REASON } from "../lib/verification";

type Props = {
  organizationName: string;
  decision: "APROBADA" | "RECHAZADA";
  // RECHAZADA sobre una organización ya verificada: se le retira la verificación.
  revoke?: boolean;
  onConfirm: (observaciones: string) => Promise<void>;
  onClose: () => void;
};

type Mode = "approve" | "reject" | "revoke";

const TEXTS: Record<Mode, {
  title: string;
  summary: (name: string) => ReactNode;
  label: string;
  placeholder: string;
  reasonNoun?: string;
}> = {
  approve: {
    title: "Aprobar verificación",
    summary: (name) => <>La empresa <strong>{name}</strong> quedará verificada y sus ofertas mostrarán el sello.</>,
    label: "Observaciones (opcional)",
    placeholder: "Por ejemplo: RUT y Cámara de Comercio vigentes.",
  },
  reject: {
    title: "Rechazar verificación",
    summary: (name) => <>La empresa <strong>{name}</strong> verá el motivo y podrá corregir sus documentos.</>,
    label: "Motivo del rechazo",
    placeholder: "Por ejemplo: el certificado de Cámara de Comercio tiene más de 30 días.",
    reasonNoun: "rechazo",
  },
  revoke: {
    title: "Retirar verificación",
    summary: (name) => <>La empresa <strong>{name}</strong> dejará de estar verificada y sus ofertas perderán el sello. Verá el motivo y podrá enviar una nueva solicitud.</>,
    label: "Motivo del retiro",
    placeholder: "Por ejemplo: la matrícula mercantil de la empresa fue cancelada.",
    reasonNoun: "retiro",
  },
};

// Confirma la decisión del revisor. Rechazar o retirar exige un motivo que la
// empresa verá en "Mi empresa" y en el correo (reemplaza el window.prompt anterior).
export default function VerificationDecisionModal({ organizationName, decision, revoke = false, onConfirm, onClose }: Props) {
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mode: Mode = decision === "APROBADA" ? "approve" : revoke ? "revoke" : "reject";
  const text = TEXTS[mode];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (text.reasonNoun && observaciones.trim().length < MIN_REJECTION_REASON) {
      return setError(`Explica el motivo del ${text.reasonNoun} (mínimo ${MIN_REJECTION_REASON} caracteres) para que la empresa sepa qué corregir.`);
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
        <h2 id="decision-title">{text.title}</h2>
        <p className="muted">{text.summary(organizationName)}</p>
        <label className="field">
          <span>{text.label}</span>
          <textarea
            rows={4}
            maxLength={1000}
            autoFocus
            className="block w-full mt-1.5 rounded-[10px] border border-[var(--border)] p-3 text-sm"
            value={observaciones}
            placeholder={text.placeholder}
            onChange={(event) => setObservaciones(event.target.value)}
          />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? "Guardando..." : text.title}
          </button>
        </div>
      </form>
    </div>
  );
}
