import { useEffect, useRef, useState } from "react";
import type { AppState, Navigate } from "../../app/types";
import NavBar from "../../app/NavBar";
import ArdyMark from "../../shared/ui/ArdyMark";
import TypeBadge from "./TypeBadge";
import { IconBriefcase, IconCheck, IconClock, IconPlus, IconSearch, IconUser } from "../../shared/ui/icons";
import { offersApi } from "./offers.api";
import { daysUntil, formatDate } from "../../shared/lib/format";
import { toUiOffer, type Offer } from "./offers.model";
import OfferForm, { type SaveOutcome } from "./offer-form/OfferForm";

type Props = { state: AppState; navigate: Navigate };

// Etapas de la barra de cada oferta, en orden, con el estado de la API que cuentan.
const STAGES = [
  { status: "ENVIADA", label: "enviadas", legend: "Enviada", tone: "sent" },
  { status: "EN_REVISION", label: "en revisión", legend: "En revisión", tone: "review" },
  { status: "PRESELECCIONADA", label: "entrevista", legend: "Entrevista", tone: "interview" },
  { status: "ACEPTADA", label: "aceptadas", legend: "Aceptada", tone: "accepted" },
] as const;
const OPEN_STATUSES = ["ENVIADA", "EN_REVISION", "PRESELECCIONADA"];

// conteo_estados y nuevos_semana llegan de GET /offers/mine.
type CompanyOffer = Offer & { stageCounts?: Record<string, number>; newThisWeek?: number };

const toCompanyOffer = (offer: any): CompanyOffer => {
  const base = toUiOffer(offer);
  const stageCounts = offer.conteo_estados && typeof offer.conteo_estados === "object" ? offer.conteo_estados as Record<string, number> : undefined;
  const total = stageCounts ? Object.values(stageCounts).reduce((sum, value) => sum + Number(value || 0), 0) : base.applicants ?? 0;
  return {
    ...base,
    status: offer.estado ?? offer.status ?? "PUBLICADA",
    applicants: total,
    ...(stageCounts ? { stageCounts } : {}),
    ...(offer.nuevos_semana != null && Number.isFinite(Number(offer.nuevos_semana)) ? { newThisWeek: Number(offer.nuevos_semana) } : {}),
  };
};

const STATUS_LABELS: Record<string, string> = { PUBLICADA: "Publicada", BORRADOR: "Borrador", CANCELADA: "Cancelada", CERRADA: "Cerrada" };

const OUTCOME_TEXT: Record<SaveOutcome, { title: string; text: string }> = {
  published: { title: "Oferta publicada", text: "Ya está visible para los candidatos. Te avisaremos en el panel cuando lleguen postulaciones." },
  updated: { title: "Cambios guardados", text: "Los candidatos ya ven la oferta actualizada." },
  draft: { title: "Borrador guardado", text: "La oferta quedó en tu panel como borrador. Nadie más la ve hasta que la publiques." },
};

export default function CompanyDashboard({ state, navigate }: Props) {
  const [offers, setOffers] = useState<CompanyOffer[]>([]);
  // null: panel; "new": creando; una oferta: editándola.
  const [form, setForm] = useState<null | "new" | CompanyOffer>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [offersError, setOffersError] = useState("");
  const offersListRef = useRef<HTMLDivElement>(null);
  const draftStorageKey = `sipu-offer-draft-${state.currentUser?.id ?? "anonymous"}`;

  useEffect(() => {
    if (!state.token) return;
    offersApi.getMyOffers(state.token)
      .then((response) => {
        setOffers((response.offers ?? []).map(toCompanyOffer));
        setOffersError("");
      })
      .catch((error) => {
        setOffers([]);
        setOffersError(error instanceof Error ? error.message : "No se pudieron cargar tus ofertas.");
      });
  }, [state.token]);

  const organization = state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "tu organización";
  const verified = Boolean(state.currentUser?.organizacionVerificada);

  const confirmDelete = async () => {
    if (!deletingId || !state.token) return;
    try {
      await offersApi.deleteOffer(deletingId, state.token);
      setOffers((current) => current.map((o) => o.id === deletingId ? { ...o, status: "CANCELADA" } : o));
      setDeletingId(null);
    } catch (err) {
      setOffersError(err instanceof Error ? err.message : "No se pudo cancelar la oferta.");
    }
  };

  const handleSaved = (apiOffer: unknown, result: SaveOutcome) => {
    const saved = toCompanyOffer(apiOffer);
    setOffers((current) => {
      const existing = current.find((offer) => offer.id === saved.id);
      if (!existing) return [{ ...saved, stageCounts: {}, newThisWeek: 0 }, ...current];
      return current.map((offer) => offer.id === saved.id ? { ...saved, applicants: offer.applicants, stageCounts: offer.stageCounts, newThisWeek: offer.newThisWeek } : offer);
    });
    setForm(null);
    setOutcome(result);
    window.scrollTo({ top: 0 });
  };

  const navBar = <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" userName={organization} />;

  if (form && state.token) {
    return (
      <div className="app-shell">
        {navBar}
        <OfferForm
          token={state.token}
          organization={{ name: organization, verified, email: state.currentUser?.email ?? "" }}
          editing={form === "new" ? null : form}
          storageKey={draftStorageKey}
          onCancel={() => setForm(null)}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  if (outcome) {
    const copy = OUTCOME_TEXT[outcome];
    return (
      <div className="app-shell">
        {navBar}
        <main className="container publish-page">
          <div className="publish-success" role="status">
            <div className="success-icon" aria-hidden="true"><IconCheck size={30} /></div>
            <h1>{copy.title}</h1>
            <p>{copy.text}</p>
            <div className="publish-actions">
              <button className="button secondary" onClick={() => { setOutcome(null); setForm("new"); }}>Crear otra oferta</button>
              <button className="button primary" onClick={() => setOutcome(null)}>Volver a mis ofertas</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const activeOffers = offers.filter((offer) => offer.status === "PUBLICADA" && daysUntil(offer.closeDate) >= 0).length;
  const totalApplicants = offers.reduce((total, offer) => total + (offer.applicants ?? 0), 0);
  const openApplicants = offers.reduce((total, offer) => total + OPEN_STATUSES.reduce((sum, status) => sum + Number(offer.stageCounts?.[status] ?? 0), 0), 0);
  const hasWeekData = offers.some((offer) => offer.newThisWeek !== undefined);
  const newThisWeek = offers.reduce((total, offer) => total + (offer.newThisWeek ?? 0), 0);
  const startCreate = () => setForm("new");
  const reviewApplicants = (filter: NonNullable<AppState["applicantFilter"]>) => navigate("company-applicants", { selectedCompanyOffer: offers.find((offer) => offer.status === "PUBLICADA") ?? offers[0], applicantFilter: filter });

  const metrics = [
    { label: "Ofertas activas", value: activeOffers, icon: IconBriefcase, tone: "primary", onClick: () => offersListRef.current?.scrollIntoView({ behavior: "smooth" }), disabled: false },
    { label: "Postulantes", value: totalApplicants, icon: IconUser, tone: "navy", onClick: () => reviewApplicants("Todos"), disabled: !offers[0] },
    { label: "En proceso", value: openApplicants, icon: IconSearch, tone: "sky", onClick: () => reviewApplicants("En revisión"), disabled: !offers[0] },
    { label: "Nuevos esta semana", value: hasWeekData ? newThisWeek : "—", icon: IconClock, tone: "amber", onClick: () => reviewApplicants("Todos"), disabled: !offers[0] },
  ];

  return (
    <div className="app-shell">
      {navBar}
      <main className="container company-vivo">
        <section className="hero-card company-hero-vivo">
          <div className="dots company-hero-dots" aria-hidden="true" />
          <div>
            <p className="eyebrow inverse">Panel empresarial</p>
            <h1 className="display">Hola, {organization}.</h1>
            {hasWeekData && (
              <p className="company-hero-lead">
                {newThisWeek > 0
                  ? <>Tienes <strong>{newThisWeek === 1 ? "1 postulante nuevo" : `${newThisWeek} postulantes nuevos`}</strong> esta semana esperando tu revisión.</>
                  : "No tienes postulantes nuevos esta semana."}
              </p>
            )}
            <span className={verified ? "verify-badge is-verified" : "verify-badge is-pending"}>
              {verified ? <IconCheck size={16} /> : <IconClock size={16} />}
              {verified ? "Organización verificada" : "Verificación pendiente"}
            </span>
          </div>
          <div className="company-hero-actions">
            <button className="hero-button-light" onClick={startCreate}><IconPlus />Crear oferta</button>
            <button className="hero-button-ghost" disabled={!offers[0]} onClick={() => reviewApplicants("Todos")}>Revisar postulantes</button>
          </div>
        </section>

        {offersError && <div className="form-error" role="alert">{offersError}</div>}
        <div className="company-metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <button key={metric.label} className="panel-card interactive company-metric" disabled={metric.disabled} onClick={metric.onClick}>
                <span className={`company-metric-icon tone-${metric.tone}`} aria-hidden="true"><Icon size={24} /></span>
                <span className="company-metric-text"><strong>{metric.value}</strong><span>{metric.label}</span></span>
              </button>
            );
          })}
        </div>

        <div className="company-list-head" ref={offersListRef}>
          <div><p className="eyebrow">Tus publicaciones</p><h2>Ofertas publicadas</h2></div>
          <ul className="stage-legend" aria-hidden="true">
            {STAGES.map((stage) => <li key={stage.status}><span className={`stage-dot tone-${stage.tone}`} />{stage.legend}</li>)}
          </ul>
        </div>

        {offers.length === 0 && (
          <div className="empty-vivo company-empty">
            <ArdyMark className="empty-vivo-ardy" />
            <h2>No tienes ofertas publicadas</h2>
            <p>Publica tu primera vacante o práctica universitaria para comenzar a recibir candidatos.</p>
            <button className="button primary" onClick={startCreate}>Publicar primera oferta</button>
          </div>
        )}
        {offers.length > 0 && (
          <div className="company-offer-grid">
            {offers.map((offer) => (
              <CompanyOfferCard
                key={offer.id}
                offer={offer}
                onManage={() => navigate("company-applicants", { selectedCompanyOffer: offer, applicantFilter: "Todos" })}
                onEdit={() => setForm(offer)}
                onCancel={() => setDeletingId(offer.id)}
              />
            ))}
            <button className="new-offer-card" onClick={startCreate}>
              <span className="new-offer-plus" aria-hidden="true"><IconPlus size={26} /></span>
              Publicar una nueva oferta
              <small>Práctica, empleo o formación</small>
            </button>
          </div>
        )}
      </main>

      {deletingId && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeletingId(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(e) => e.stopPropagation()}>
            <p className="eyebrow">Confirmación</p>
            <h2 id="delete-title">¿Cancelar esta oferta?</h2>
            <p>La oferta dejará de aparecer en los catálogos. Se conservará el historial de postulaciones recibidas.</p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setDeletingId(null)}>Cancelar</button>
              <button className="button primary" style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }} onClick={() => void confirmDelete()}>Confirmar cancelación</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CompanyOfferCard({ offer, onManage, onEdit, onCancel }: { offer: CompanyOffer; onManage: () => void; onEdit: () => void; onCancel: () => void }) {
  const status = offer.status ?? "PUBLICADA";
  const counts = STAGES.map((stage) => ({ ...stage, n: Number(offer.stageCounts?.[stage.status] ?? 0) }));
  const inPipeline = counts.reduce((total, stage) => total + stage.n, 0);
  const accepted = Number(offer.stageCounts?.ACEPTADA ?? 0);
  const vacancies = offer.vacancies ?? 1;
  const isDraft = status === "BORRADOR";
  return (
    <article className={`panel-card company-offer-card ${isDraft ? "is-draft" : ""}`}>
      <div className="company-offer-top">
        <div className="company-offer-info">
          <div className="company-offer-badges">
            <TypeBadge type={offer.offerType} />
            <span className={`offer-status offer-status-${status.toLowerCase()}`}>{STATUS_LABELS[status] ?? "Cerrada"}</span>
          </div>
          <h3>{offer.title}</h3>
          <p>{offer.city} · {offer.modality} · {isDraft ? "Sin publicar" : `Cierra ${formatDate(offer.closeDate, "sin fecha")}`}</p>
        </div>
        <div className="company-offer-total"><strong>{offer.applicants ?? 0}</strong><small>{offer.applicants === 1 ? "postulante" : "postulantes"}</small></div>
      </div>
      {!isDraft && offer.stageCounts && (
        <div>
          <div className="stage-bar" role="img" aria-label={`Postulaciones por etapa: ${counts.map((stage) => `${stage.n} ${stage.label}`).join(", ")}`}>
            {inPipeline > 0 && counts.filter((stage) => stage.n > 0).map((stage) => <span key={stage.status} className={`tone-${stage.tone}`} style={{ flexGrow: stage.n }} />)}
          </div>
          <ul className="stage-counts" aria-hidden="true">
            {counts.map((stage) => <li key={stage.status}><span className={`stage-dot tone-${stage.tone}`} /><strong>{stage.n}</strong> {stage.label}</li>)}
          </ul>
          <p className={`company-offer-vacancies ${accepted >= vacancies ? "is-full" : ""}`}>
            {accepted >= vacancies ? <IconCheck size={14} /> : null}
            {accepted} de {vacancies} {vacancies === 1 ? "vacante cubierta" : "vacantes cubiertas"}
          </p>
        </div>
      )}
      {isDraft && <p className="company-offer-draft-note">Termina de completarla y publícala para empezar a recibir postulaciones.</p>}
      <div className="company-offer-actions">
        {isDraft ? (
          <button className="button primary" onClick={onEdit}>Continuar borrador</button>
        ) : (
          <>
            <button className="button primary" onClick={onManage}>Gestionar postulantes</button>
            {status !== "CANCELADA" && <button className="button secondary" onClick={onEdit}>Editar</button>}
          </>
        )}
        {(status === "PUBLICADA" || isDraft) && <button className="danger-link" onClick={onCancel}>{isDraft ? "Descartar" : "Cancelar oferta"}</button>}
      </div>
    </article>
  );
}
