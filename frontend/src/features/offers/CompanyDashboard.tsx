import { useEffect, useRef, useState } from "react";
import type { AppState, Navigate } from "../../app/types";
import NavBar from "../../app/NavBar";
import ArdyMark from "../../shared/ui/ArdyMark";
import TypeBadge from "./TypeBadge";
import { IconBriefcase, IconCheck, IconClock, IconPlus, IconSearch, IconUser } from "../../shared/ui/icons";
import { CancelOfferDialog, PurgeOfferDialog } from "./OfferTrashDialogs";
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

// Pestañas del panel. Las canceladas viven aparte (papelera) y no se mezclan con las activas.
type OfferTab = "activas" | "borradores" | "canceladas";
const TAB_OF: Record<string, OfferTab> = { PUBLICADA: "activas", CERRADA: "activas", BORRADOR: "borradores", CANCELADA: "canceladas" };
const TABS: { id: OfferTab; label: string; heading: string; emptyTitle: string; emptyText: string }[] = [
  { id: "activas", label: "Publicadas", heading: "Ofertas publicadas", emptyTitle: "No tienes ofertas publicadas", emptyText: "Publica tu primera vacante o práctica universitaria para comenzar a recibir candidatos." },
  { id: "borradores", label: "Borradores", heading: "Borradores", emptyTitle: "No tienes borradores", emptyText: "Al guardar una oferta sin publicarla, o al restaurar una cancelada, aparece aquí." },
  { id: "canceladas", label: "Canceladas", heading: "Ofertas canceladas", emptyTitle: "La papelera está vacía", emptyText: "Las ofertas que canceles llegarán aquí. Podrás restaurarlas o eliminarlas definitivamente." },
];

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
  const [tab, setTab] = useState<OfferTab>("activas");
  // Papelera: oferta a cancelar o a borrar definitivamente, y aviso de la última acción.
  const [cancelling, setCancelling] = useState<CompanyOffer | null>(null);
  const [purging, setPurging] = useState<CompanyOffer | null>(null);
  const [trashBusy, setTrashBusy] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [notice, setNotice] = useState("");
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

  // Reemplaza la oferta con la fila que devolvió la API, conservando sus conteos.
  const mergeOffer = (apiOffer: unknown) => {
    const saved = toCompanyOffer(apiOffer);
    setOffers((current) => current.map((offer) => offer.id === saved.id ? { ...saved, applicants: offer.applicants, stageCounts: offer.stageCounts, newThisWeek: offer.newThisWeek } : offer));
  };

  const runTrashAction = async (action: () => Promise<void>) => {
    setTrashBusy(true);
    setTrashError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setTrashError(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      setTrashBusy(false);
    }
  };

  const confirmCancel = (reason: string) => runTrashAction(async () => {
    if (!cancelling || !state.token) return;
    const response = await offersApi.cancelOffer(cancelling.id, state.token, reason || undefined);
    mergeOffer(response.offer);
    const notified = response.notifiedApplications ?? 0;
    const warned = notified === 0 ? "" : ` Avisamos a ${notified === 1 ? "1 candidato" : `${notified} candidatos`}.`;
    setNotice(`"${cancelling.title}" se movió a Canceladas.${warned}`);
    setCancelling(null);
  });

  const restoreOffer = (offer: CompanyOffer) => runTrashAction(async () => {
    if (!state.token) return;
    const response = await offersApi.restoreOffer(offer.id, state.token);
    mergeOffer(response.offer);
    setNotice(`"${offer.title}" volvió como borrador. Revísala y publícala cuando esté lista.`);
    setTab("borradores");
  });

  const confirmPurge = () => runTrashAction(async () => {
    if (!purging || !state.token) return;
    await offersApi.deleteOfferPermanently(purging.id, state.token);
    setOffers((current) => current.filter((offer) => offer.id !== purging.id));
    setNotice(`"${purging.title}" se eliminó definitivamente.`);
    setPurging(null);
  });

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

  // Las ofertas canceladas quedan fuera de los indicadores: su proceso está en pausa.
  const live = offers.filter((offer) => offer.status !== "CANCELADA");
  const activeOffers = offers.filter((offer) => offer.status === "PUBLICADA" && daysUntil(offer.closeDate) >= 0).length;
  const totalApplicants = live.reduce((total, offer) => total + (offer.applicants ?? 0), 0);
  const openApplicants = live.reduce((total, offer) => total + OPEN_STATUSES.reduce((sum, status) => sum + Number(offer.stageCounts?.[status] ?? 0), 0), 0);
  const hasWeekData = live.some((offer) => offer.newThisWeek !== undefined);
  const newThisWeek = live.reduce((total, offer) => total + (offer.newThisWeek ?? 0), 0);
  const startCreate = () => setForm("new");
  const reviewApplicants = (filter: NonNullable<AppState["applicantFilter"]>) => navigate("company-applicants", { selectedCompanyOffer: live.find((offer) => offer.status === "PUBLICADA") ?? live[0], applicantFilter: filter });
  const tabOf = (offer: CompanyOffer) => TAB_OF[offer.status ?? "PUBLICADA"] ?? "activas";
  const tabOffers = offers.filter((offer) => tabOf(offer) === tab);
  const tabCount = (id: OfferTab) => offers.filter((offer) => tabOf(offer) === id).length;
  const tabInfo = TABS.find((item) => item.id === tab)!;

  const metrics = [
    { label: "Ofertas activas", value: activeOffers, icon: IconBriefcase, tone: "primary", onClick: () => { setTab("activas"); offersListRef.current?.scrollIntoView({ behavior: "smooth" }); }, disabled: false },
    { label: "Postulantes", value: totalApplicants, icon: IconUser, tone: "navy", onClick: () => reviewApplicants("Todos"), disabled: !live[0] },
    { label: "En proceso", value: openApplicants, icon: IconSearch, tone: "sky", onClick: () => reviewApplicants("En revisión"), disabled: !live[0] },
    { label: "Nuevos esta semana", value: hasWeekData ? newThisWeek : "—", icon: IconClock, tone: "amber", onClick: () => reviewApplicants("Todos"), disabled: !live[0] },
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
            <button className="hero-button-ghost" disabled={!live[0]} onClick={() => reviewApplicants("Todos")}>Revisar postulantes</button>
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
          <div><p className="eyebrow">Tus publicaciones</p><h2>{tabInfo.heading}</h2></div>
          {tab === "activas" && (
            <ul className="stage-legend" aria-hidden="true">
              {STAGES.map((stage) => <li key={stage.status}><span className={`stage-dot tone-${stage.tone}`} />{stage.legend}</li>)}
            </ul>
          )}
        </div>

        <div className="offer-tabs" role="tablist" aria-label="Tus ofertas">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" id={`offers-tab-${item.id}`} aria-selected={tab === item.id} aria-controls="offers-panel"
              className={item.id === "canceladas" ? "is-trash" : ""} onClick={() => { setTab(item.id); setNotice(""); setTrashError(""); }}>
              {item.label}<span className="offer-tabs-count">{tabCount(item.id)}</span>
            </button>
          ))}
        </div>

        {notice && <p className="offer-notice" role="status"><IconCheck size={16} />{notice}</p>}
        {trashError && !cancelling && !purging && <div className="form-error" role="alert">{trashError}</div>}

        <div id="offers-panel" role="tabpanel" aria-labelledby={`offers-tab-${tab}`}>
          {tab === "canceladas" && tabOffers.length > 0 && (
            <p className="trash-hint">Las ofertas canceladas no aparecen en el catálogo y su proceso de selección queda en pausa. Restáuralas como borrador para publicarlas de nuevo. Solo las que nunca recibieron postulaciones se pueden eliminar definitivamente.</p>
          )}

          {tabOffers.length === 0 && (
            <div className="empty-vivo company-empty">
              <ArdyMark className="empty-vivo-ardy" />
              <h2>{tabInfo.emptyTitle}</h2>
              <p>{tabInfo.emptyText}</p>
              {tab !== "canceladas" && <button className="button primary" onClick={startCreate}>{offers.length === 0 ? "Publicar primera oferta" : "Crear oferta"}</button>}
            </div>
          )}

          {tabOffers.length > 0 && (
            <div className="company-offer-grid">
              {tabOffers.map((offer) => offer.status === "CANCELADA" ? (
                <TrashOfferCard
                  key={offer.id}
                  offer={offer}
                  busy={trashBusy}
                  onRestore={() => void restoreOffer(offer)}
                  onView={() => navigate("company-applicants", { selectedCompanyOffer: offer, applicantFilter: "Todos" })}
                  onPurge={() => { setTrashError(""); setPurging(offer); }}
                />
              ) : (
                <CompanyOfferCard
                  key={offer.id}
                  offer={offer}
                  onManage={() => navigate("company-applicants", { selectedCompanyOffer: offer, applicantFilter: "Todos" })}
                  onEdit={() => setForm(offer)}
                  onCancel={() => { setTrashError(""); setCancelling(offer); }}
                />
              ))}
              {tab !== "canceladas" && (
                <button className="new-offer-card" onClick={startCreate}>
                  <span className="new-offer-plus" aria-hidden="true"><IconPlus size={26} /></span>
                  Publicar una nueva oferta
                  <small>Práctica, empleo o formación</small>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {cancelling && (
        <CancelOfferDialog
          title={cancelling.title}
          isDraft={cancelling.status === "BORRADOR"}
          openApplications={OPEN_STATUSES.reduce((sum, status) => sum + Number(cancelling.stageCounts?.[status] ?? 0), 0)}
          busy={trashBusy}
          error={trashError}
          onCancel={() => setCancelling(null)}
          onConfirm={(reason) => void confirmCancel(reason)}
        />
      )}
      {purging && (
        <PurgeOfferDialog title={purging.title} busy={trashBusy} error={trashError} onCancel={() => setPurging(null)} onConfirm={() => void confirmPurge()} />
      )}
    </div>
  );
}

// Oferta en la papelera: cuándo y por qué se canceló, y qué se puede hacer con ella.
function TrashOfferCard({ offer, busy, onRestore, onView, onPurge }: { offer: CompanyOffer; busy: boolean; onRestore: () => void; onView: () => void; onPurge: () => void }) {
  const applicants = offer.applicants ?? 0;
  return (
    <article className="panel-card company-offer-card is-trashed" aria-label={`${offer.title}, cancelada`}>
      <div className="company-offer-top">
        <div className="company-offer-info">
          <div className="company-offer-badges">
            <TypeBadge type={offer.offerType} />
            <span className="offer-status offer-status-cancelada">Cancelada</span>
          </div>
          <h3>{offer.title}</h3>
          <p>{offer.cancelledAt ? `Cancelada el ${formatDate(offer.cancelledAt)}` : "Cancelada"} · {offer.city}</p>
        </div>
        <div className="company-offer-total"><strong>{applicants}</strong><small>{applicants === 1 ? "postulante" : "postulantes"}</small></div>
      </div>
      {offer.cancelReason && <p className="trash-reason"><strong>Motivo:</strong> {offer.cancelReason}</p>}
      <div className="company-offer-actions">
        <button className="button primary" disabled={busy} onClick={onRestore}>Restaurar como borrador</button>
        {applicants > 0 && <button className="button secondary" onClick={onView}>Ver postulantes</button>}
        {applicants === 0
          ? <button className="danger-link" disabled={busy} onClick={onPurge}>Eliminar definitivamente</button>
          : <small className="trash-keep">Se conserva para el historial de {applicants === 1 ? "su candidato" : `sus ${applicants} candidatos`}.</small>}
      </div>
    </article>
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
        <button className="danger-link" onClick={onCancel}>{isDraft ? "Descartar" : "Cancelar oferta"}</button>
      </div>
    </article>
  );
}
