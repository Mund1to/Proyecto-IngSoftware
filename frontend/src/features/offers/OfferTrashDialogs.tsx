// Papelera de ofertas: confirmar la cancelación (con motivo para los candidatos)
// y el borrado definitivo de una oferta cancelada sin postulaciones.
import { useEffect, useRef, useState } from "react";
import { ChoiceGroup } from "../../shared/ui/form";

// Debe caber en MAX_CANCEL_REASON_LENGTH del backend (offers.domain.js).
export const MAX_CANCEL_REASON = 300;
const REASONS = ["La vacante ya se cubrió", "Ya no necesitamos el cargo", "Hubo un error al publicarla", "La vamos a publicar de nuevo con cambios"];
const OTHER = "__OTRO__";

function useDialogKeys(busy: boolean, onCancel: () => void) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);
  return heading;
}

type CancelProps = {
  title: string;
  isDraft: boolean;
  // Postulaciones abiertas que recibirán el aviso.
  openApplications: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function CancelOfferDialog({ title, isDraft, openApplications, busy, error, onCancel, onConfirm }: CancelProps) {
  const [choice, setChoice] = useState(isDraft ? "" : REASONS[0]);
  const [other, setOther] = useState("");
  const heading = useDialogKeys(busy, onCancel);
  const reason = choice === OTHER ? other.trim() : choice;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) onCancel(); }}>
      <section className="modal trash-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-offer-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">{isDraft ? "Descartar borrador" : "Cancelar oferta"}</p>
        <h2 id="cancel-offer-title" tabIndex={-1} ref={heading}>¿Mover “{title}” a Canceladas?</h2>
        <ul className="trash-dialog-facts">
          <li>{isDraft ? "El borrador sale de tu panel." : "Deja de aparecer en el catálogo y no recibe más postulaciones."}</li>
          {!isDraft && (
            <li>
              {openApplications > 0
                ? `${openApplications === 1 ? "1 candidato con postulación abierta recibirá" : `${openApplications} candidatos con postulación abierta recibirán`} un aviso y su proceso quedará en pausa.`
                : "No hay postulaciones abiertas que avisar."}
            </li>
          )}
          <li>Podrás restaurarla como borrador desde la pestaña Canceladas.</li>
        </ul>

        {!isDraft && (
          <ChoiceGroup<string> legend="Motivo (lo verán los candidatos)" name="cancel-reason" value={choice}
            onChange={setChoice}
            options={[...REASONS.map((value) => ({ value, label: value })), { value: OTHER, label: "Otro motivo" }]} />
        )}
        {choice === OTHER && (
          <div className="vf-field">
            <label htmlFor="cancel-other" className="vf-label">Escribe el motivo</label>
            <input id="cancel-other" maxLength={MAX_CANCEL_REASON} value={other} onChange={(event) => setOther(event.target.value)} />
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Volver</button>
          <button type="button" className="button primary danger" disabled={busy || (choice === OTHER && !other.trim())} onClick={() => onConfirm(reason)}>
            {busy ? "Moviendo..." : isDraft ? "Descartar borrador" : "Cancelar oferta"}
          </button>
        </div>
      </section>
    </div>
  );
}

type PurgeProps = { title: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void };

export function PurgeOfferDialog({ title, busy, error, onCancel, onConfirm }: PurgeProps) {
  const heading = useDialogKeys(busy, onCancel);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) onCancel(); }}>
      <section className="modal trash-dialog" role="alertdialog" aria-modal="true" aria-labelledby="purge-offer-title" aria-describedby="purge-offer-text" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Eliminar definitivamente</p>
        <h2 id="purge-offer-title" tabIndex={-1} ref={heading}>¿Eliminar “{title}” para siempre?</h2>
        <p id="purge-offer-text">La oferta se borra de SIPU y no se puede recuperar. Como nunca recibió postulaciones, ningún candidato pierde su historial.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Conservar en Canceladas</button>
          <button type="button" className="button primary danger" disabled={busy} onClick={onConfirm}>{busy ? "Eliminando..." : "Eliminar definitivamente"}</button>
        </div>
      </section>
    </div>
  );
}
