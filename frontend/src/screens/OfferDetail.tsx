import { useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import { formatDate } from "./StudentDashboard";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void; applyToOffer: (offer: Offer) => Promise<void> };

export default function OfferDetail({ state, navigate, applyToOffer }: Props) {
  const offer = state.selectedOffer;
  const [applied, setApplied] = useState(offer ? state.applications.some((item) => item.offerId === offer.id) : false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [applyError, setApplyError] = useState("");
  if (!offer) return null;

  const closed = +new Date(offer.closeDate) < Date.now();
  const submit = async () => {
    setApplyError("");
    try {
      await applyToOffer(offer);
      setApplied(true);
      setConfirming(false);
      setSuccess(true);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "No se pudo enviar la postulación.");
    }
  };

  return (
    <div className="app-shell">
      <NavBar role="student" navigate={navigate} activeScreen="student-dashboard" userName={state.currentUser?.nombreCompleto ?? "Estudiante"} />
      <main className="container detail-page">
        <button className="back-button" onClick={() => navigate("student-dashboard")}>← Volver a ofertas</button>
        <section className="detail-header">
          <div className="company-mark large">{offer.logo}</div>
          <div>
            <span className={`status ${closed ? "status-cerrada" : "status-abierta"}`}>{closed ? "Cerrada" : "Abierta"}</span>
            <h1>{offer.title}</h1>
            <p className="verified detail-company">{offer.company}{offer.verified && <span>✓ Organización verificada</span>}</p>
            <div className="detail-tags"><span>{offer.city}</span><span>{offer.modality}</span><span>{offer.area}</span></div>
          </div>
        </section>

        <div className="detail-layout">
          <div className="detail-content">
            <Info title="Remuneración"><p className="salary">{offer.salary} COP</p></Info>
            <Info title="Fecha límite"><p>{formatDate(offer.closeDate)}</p></Info>
            <Info title="Descripción"><p>{offer.description}</p></Info>
            <Info title="Requisitos">
              <ul className="check-list">{offer.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
            </Info>
            <div className="two-column-info">
              {offer.duration && <Info title="Duración"><p>{offer.duration}</p></Info>}
              {offer.schedule && <Info title="Horario"><p>{offer.schedule}</p></Info>}
            </div>
          </div>

          <aside className="apply-card">
            <p className="eyebrow">Tu postulación</p>
            <h2>{applied ? "Postulación enviada" : "¿Te interesa esta práctica?"}</h2>
            <p>{applied ? "Estado actual: En revisión. Te notificaremos cualquier cambio." : "Revisa tu perfil y confirma el envío de tu información."}</p>
            {closed && !applied && <div className="form-error">Esta oferta cerró y ya no recibe postulaciones.</div>}
            {applyError && <div className="form-error" role="alert">{applyError}</div>}
            {applied ? (
              <button className="button primary full" onClick={() => navigate("student-applications")}>Ver mi postulación</button>
            ) : (
              <button className="button primary full" disabled={closed} onClick={() => setConfirming(true)}>Postularme</button>
            )}
            <button className="button secondary full" onClick={() => setSaved(!saved)}>{saved ? "Oferta guardada" : "Guardar oferta"}</button>
            <div className="share-note"><strong>Información compartida</strong><span>Perfil profesional, educación, habilidades y CV seleccionado.</span></div>
          </aside>
        </div>
      </main>

      {confirming && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirming(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e) => e.stopPropagation()}>
            <p className="eyebrow">Antes de enviar</p>
            <h2 id="confirm-title">Confirma tu postulación</h2>
            <p>La empresa recibirá tu perfil SIPU y el siguiente documento:</p>
            <div className="cv-row"><span aria-hidden="true">PDF</span><div><strong>Hoja de vida</strong><small>Revisa tu perfil antes de enviar la postulación.</small></div><button className="text-button" onClick={() => navigate("student-profile")}>Ver perfil</button></div>
            {applyError && <div className="form-error" role="alert">{applyError}</div>}
            <div className="modal-actions"><button className="button secondary" onClick={() => setConfirming(false)}>Cancelar</button><button className="button primary" onClick={() => void submit()}>Confirmar postulación</button></div>
          </section>
        </div>
      )}

      {success && (
        <div className="modal-backdrop">
          <section className="modal success-modal" role="dialog" aria-modal="true">
            <div className="success-icon" aria-hidden="true">✓</div>
            <h2>Postulación enviada</h2>
            <p>Bancolombia recibió tu perfil y CV. Puedes consultar el estado en cualquier momento.</p>
            <button className="button primary full" onClick={() => navigate("student-applications")}>Ver mi postulación</button>
            <button className="button secondary full" onClick={() => setSuccess(false)}>Permanecer aquí</button>
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="info-section"><h2>{title}</h2>{children}</section>;
}
