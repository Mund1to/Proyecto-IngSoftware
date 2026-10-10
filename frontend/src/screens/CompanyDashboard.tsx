import { useEffect, useRef, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import TypeBadge from "../components/TypeBadge";
import { IconBriefcase, IconCheck, IconClock, IconPlus, IconSearch, IconUser } from "../components/icons";
import { api } from "../lib/api";
import { formatDate } from "../lib/offers";
import { companyInitials, daysUntil, formatSalary, normalizeModality, OFFER_TYPE_LABELS, offerTypeLabel, toNumberOrZero, type OfferType } from "../lib/offers";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Draft = {
  title: string; area: string; description: string; program: string; semester: string; skills: string;
  experience: string; languages: string; city: string; modality: Offer["modality"]; duration: string;
  schedule: string; salary: string; salaryMin: string; salaryMax: string; closeDate: string; contact: string;
  offerType: OfferType;
};

const initial: Draft = {
  title: "", area: "Tecnología", description: "", program: "", semester: "", skills: "", experience: "No requerida",
  languages: "", city: "Bogotá", modality: "Híbrida", duration: "6 meses", schedule: "Lunes a viernes",
  salary: "", salaryMin: "", salaryMax: "", closeDate: "", contact: "",
  offerType: "PRACTICA",
};

// Etapas de la barra de cada oferta, en orden, con el estado de la API que cuentan.
const STAGES = [
  { status: "ENVIADA", label: "enviadas", legend: "Enviada", tone: "sent" },
  { status: "EN_REVISION", label: "en revisión", legend: "En revisión", tone: "review" },
  { status: "PRESELECCIONADA", label: "entrevista", legend: "Entrevista", tone: "interview" },
  { status: "ACEPTADA", label: "aceptadas", legend: "Aceptada", tone: "accepted" },
] as const;

// conteo_estados y nuevos_semana llegan de GET /offers/mine; si faltan, se muestra solo el total.
type CompanyOffer = Offer & { stageCounts?: Record<string, number>; newThisWeek?: number };

const toUiOffer = (offer: any, fallbackCompany = "Empresa", fallbackVerified = false): CompanyOffer => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? fallbackCompany,
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: normalizeModality(offer.modalidad ?? offer.modality),
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? "",
  salary: formatSalary(offer.remuneracion),
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
  offerType: offer.tipo ?? offer.offerType,
  status: offer.estado ?? offer.status ?? "PUBLICADA",
  verified: Boolean(offer.verificada ?? fallbackVerified),
  duration: offer.duracion ?? offer.duration,
  schedule: offer.horario ?? offer.schedule,
  contactEmail: offer.contacto_email ?? offer.contactEmail,
  salaryMin: offer.remuneracion == null ? null : toNumberOrZero(offer.remuneracion),
  salaryMax: offer.remuneracion_maxima == null ? null : toNumberOrZero(offer.remuneracion_maxima),
  ...(offer.conteo_estados && typeof offer.conteo_estados === "object" ? { stageCounts: offer.conteo_estados as Record<string, number> } : {}),
  ...(offer.nuevos_semana != null && Number.isFinite(Number(offer.nuevos_semana)) ? { newThisWeek: Number(offer.nuevos_semana) } : {}),
});

const STATUS_LABELS: Record<string, string> = { PUBLICADA: "Publicada", BORRADOR: "Borrador", CANCELADA: "Cancelada", CERRADA: "Cerrada" };

export default function CompanyDashboard({ state, navigate }: Props) {
  const [offers, setOffers] = useState<CompanyOffer[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [pendingApplicants, setPendingApplicants] = useState(0);
  const [offersError, setOffersError] = useState("");
  const offersListRef = useRef<HTMLDivElement>(null);
  const draftStorageKey = `sipu-company-draft-${state.currentUser?.id ?? "anonymous"}`;

  useEffect(() => {
    const savedDraft = localStorage.getItem(draftStorageKey);
    if (!savedDraft || editingId !== null) return;
    try {
      setDraft({ ...initial, ...JSON.parse(savedDraft) as Partial<Draft> });
      setDraftSaved(true);
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, editingId]);

  useEffect(() => {
    if (!state.token) return;

    api.getMyOffers(state.token)
      .then(async (response) => {
        const mapped = (response.offers ?? []).map((offer: any) => toUiOffer(offer));
        setOffers(mapped);
        setOffersError("");
        const applicationLists = await Promise.all(mapped.map((offer) =>
          api.getApplicationsForOffer(offer.id, state.token!).catch(() => ({ applications: [] })),
        ));
        const applications = applicationLists.flatMap((item) => item.applications ?? []);
        setOffers(mapped.map((offer, index) => ({ ...offer, applicants: applicationLists[index].applications?.length ?? offer.applicants ?? 0 })));
        setPendingApplicants(applications.filter((item) => !["ACEPTADA", "RECHAZADA"].includes(item.estado)).length);
      })
      .catch((error) => {
        setOffers([]);
        setOffersError(error instanceof Error ? error.message : "No se pudieron cargar tus ofertas.");
      });
  }, [state.token]);

  const update = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftSaved(false);
  };
  const saveDraft = () => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setDraftSaved(true);
      setError("");
    } catch {
      setError("No se pudo guardar el borrador en este navegador.");
    }
  };
  const validate = () => {
    // La formación no exige remuneración; la práctica usa un valor y el empleo un rango.
    const salaryOk = draft.offerType === "FORMACION"
      ? true
      : draft.offerType === "PRACTICA"
        ? Boolean(draft.salary)
        : Boolean(draft.salaryMin && draft.salaryMax && Number(draft.salaryMax) >= Number(draft.salaryMin));
    const closeDateIsFuture = draft.closeDate && new Date(`${draft.closeDate}T23:59:59.999`).getTime() > Date.now();

    if (!draft.title || !draft.description || !draft.program || !draft.skills || !draft.city || !salaryOk || !closeDateIsFuture || !draft.contact) {
      setError("Completa todos los campos obligatorios antes de continuar.");
      return;
    }
    setError("");
    setPreview(true);
  };

  const startEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setDraft({
      title: offer.title,
      area: offer.area ?? "General",
      description: offer.description,
      program: offer.requirements?.[0] ?? "",
      semester: "",
      skills: offer.requirements?.[1] ?? "",
      experience: offer.requirements?.[2] ?? "No requerida",
      languages: "",
      city: offer.city,
      modality: offer.modality,
      duration: offer.duration ?? "",
      schedule: offer.schedule ?? "",
      salary: offer.salary ? offer.salary.replace(/\D/g, "") : "",
      salaryMin: offer.salaryMin ? String(offer.salaryMin) : offer.salary ? offer.salary.replace(/\D/g, "") : "",
      salaryMax: offer.salaryMax ? String(offer.salaryMax) : "",
      closeDate: offer.closeDate ? offer.closeDate.slice(0, 10) : "",
      contact: offer.contactEmail ?? state.currentUser?.email ?? "",
      offerType: offer.offerType ?? "PRACTICA",
    });
    setCreating(true);
    setPreview(false);
    setError("");
  };

  const cancelEditOrCreate = () => {
    setCreating(false);
    setEditingId(null);
    setPreview(false);
    setPublished(false);
    setDraft(initial);
    setError("");
  };

  const confirmDelete = async () => {
    if (!deletingId || !state.token) return;
    try {
      await api.deleteOffer(deletingId, state.token);
      setOffers((current) => current.map((o) => o.id === deletingId ? { ...o, status: "CANCELADA" } : o));
      setDeletingId(null);
    } catch (err) {
      setOffersError(err instanceof Error ? err.message : "No se pudo cancelar la oferta.");
    }
  };

  const publishOffer = async () => {
    if (!state.token) return;
    const payload = {
      titulo: draft.title,
      descripcion: draft.description,
      tipo: draft.offerType,
      estado: "PUBLICADA",
      ubicacion: draft.city,
      modalidad: draft.modality,
      area: draft.area,
      requisitos: [draft.program, draft.skills, draft.experience, draft.languages].filter(Boolean),
      duracion: draft.duration,
      horario: draft.schedule,
      contactoEmail: draft.contact,
      fechaPublicacion: new Date().toISOString(),
      fechaCierre: draft.closeDate ? new Date(`${draft.closeDate}T23:59:59.999`).toISOString() : null,
      remuneracion: draft.offerType === "FORMACION" ? null : draft.offerType === "PRACTICA" ? Number(draft.salary) : Number(draft.salaryMin),
      remuneracionMaxima: draft.offerType === "PRACTICA" || draft.offerType === "FORMACION" ? null : Number(draft.salaryMax),
    };

    try {
      if (editingId) {
        const response = await api.updateOffer(editingId, payload, state.token);
        const updated = toUiOffer(response.offer, state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto, state.currentUser?.organizacionVerificada);
        setOffers((current) => current.map((o) => (o.id === editingId ? { ...updated, applicants: o.applicants, stageCounts: o.stageCounts, newThisWeek: o.newThisWeek } : o)));
      } else {
        const response = await api.createOffer(payload, state.token);
        const created = toUiOffer(response.offer, state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto, state.currentUser?.organizacionVerificada);
        setOffers((current) => [created, ...current]);
        localStorage.removeItem(draftStorageKey);
      }
      setDraftSaved(false);
      setPublished(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar la oferta.");
    }
  };

  if (creating) return (
    <div className="app-shell">
      <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />
      <main className="container publish-page">
        <button className="back-button" onClick={cancelEditOrCreate}>← Volver al panel</button>
        {published ? (
          <div className="publish-success"><div className="success-icon">✓</div><h1>{editingId ? "Oferta actualizada" : "Oferta publicada"}</h1><p>{editingId ? "Los cambios ya son visibles para estudiantes y candidatos." : "La oferta ya está visible para estudiantes y candidatos externos."}</p><button className="button primary" onClick={cancelEditOrCreate}>Volver a mis ofertas</button></div>
        ) : preview ? (
          <>
            <div className="page-title"><p className="eyebrow">Paso 2 de 2</p><h1>{editingId ? "Vista previa de cambios" : "Vista previa de la oferta"}</h1><p>Así la verán los estudiantes y candidatos externos. Revisa la información antes de guardar.</p></div>
            <section className="preview-card">
              <span className="status status-abierta">Abierta</span>
              <h2>{draft.title}</h2><p className="verified">{state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Organización"}{state.currentUser?.organizacionVerificada && <span>✓ Organización verificada</span>}</p>
              <div className="detail-tags"><span>{draft.city}</span><span>{draft.modality}</span><span>{draft.area}</span><span>{offerTypeLabel(draft.offerType)}</span>{draft.offerType !== "FORMACION" && <span>{draft.offerType === "PRACTICA" ? `${draft.salary} COP` : `${draft.salaryMin} - ${draft.salaryMax} COP`}</span>}</div>
              <h3>Descripción</h3><p>{draft.description}</p>
              <h3>Requisitos</h3><ul className="check-list"><li>{draft.program}</li><li>{draft.skills}</li><li>{draft.experience}</li></ul>
              <h3>Condiciones</h3><p>{draft.duration} · {draft.schedule} · Cierre {formatDate(draft.closeDate)}</p>
            </section>
            <div className="publish-actions"><button className="button secondary" onClick={() => setPreview(false)}>Volver a editar</button>{!editingId && <button className="button secondary" onClick={saveDraft}>{draftSaved ? "Borrador guardado" : "Guardar borrador"}</button>}<button className="button primary" onClick={() => void publishOffer()}>{editingId ? "Guardar cambios" : "Publicar oferta"}</button></div>
            {draftSaved && <p role="status" className="muted">Borrador guardado en este navegador.</p>}
          </>
        ) : (
          <>
            <div className="page-title"><p className="eyebrow">{editingId ? "Edición de oferta" : "Paso 1 de 2"}</p><h1>{editingId ? "Modificar oferta" : `Crear oferta ${draft.offerType === "PRACTICA" ? "de práctica" : draft.offerType === "EMPLEO" ? "laboral" : draft.offerType === "FORMACION" ? "de formación" : "pública"}`}</h1><p>Los campos marcados con * son obligatorios.</p></div>
            <form className="publish-form" onSubmit={(event) => { event.preventDefault(); validate(); }}>
              <FormSection title="Información del cargo" description="Describe la oportunidad con claridad.">
                <Select label="Tipo de oferta *" value={draft.offerType} options={Object.keys(OFFER_TYPE_LABELS)} labels={Object.values(OFFER_TYPE_LABELS)} onChange={(value) => update("offerType", value)} />
                <Input label={draft.offerType === "FORMACION" ? "Nombre del curso o programa *" : "Título del cargo *"} value={draft.title} onChange={(value) => update("title", value)} />
                <Input label="Área *" value={draft.area} onChange={(value) => update("area", value)} />
                <TextArea label="Descripción *" value={draft.description} onChange={(value) => update("description", value)} />
              </FormSection>
              <FormSection title="Requisitos" description="Indica el perfil académico esperado.">
                <Input label="Programa o carrera *" value={draft.program} onChange={(value) => update("program", value)} />
                <Input label="Semestre o formación" value={draft.semester} onChange={(value) => update("semester", value)} />
                <Input label="Habilidades *" value={draft.skills} onChange={(value) => update("skills", value)} />
                <Input label="Experiencia" value={draft.experience} onChange={(value) => update("experience", value)} />
                <Input label="Idiomas" value={draft.languages} onChange={(value) => update("languages", value)} />
              </FormSection>
              <FormSection title="Condiciones" description="Explica cómo se desarrollará la práctica.">
                <Input label="Ciudad *" value={draft.city} onChange={(value) => update("city", value)} />
                <Select label="Modalidad *" value={draft.modality} options={["Presencial", "Remota", "Híbrida"]} onChange={(value) => update("modality", value)} />
                <Input label="Duración" value={draft.duration} onChange={(value) => update("duration", value)} />
                <Input label="Horario" value={draft.schedule} onChange={(value) => update("schedule", value)} />
                {draft.offerType === "FORMACION" ? null : draft.offerType === "PRACTICA" ? (
                  <Input label="Remuneración mensual COP *" value={draft.salary} onChange={(value) => update("salary", value)} />
                ) : (
                  <>
                    <Input label="Salario mínimo COP *" value={draft.salaryMin} onChange={(value) => update("salaryMin", value)} />
                    <Input label="Salario máximo COP *" value={draft.salaryMax} onChange={(value) => update("salaryMax", value)} />
                  </>
                )}
              </FormSection>
              <FormSection title="Publicación" description="Define vigencia y persona de contacto.">
                <Input label="Fecha de cierre *" value={draft.closeDate} type="date" onChange={(value) => update("closeDate", value)} />
                <Input label="Correo de contacto *" value={draft.contact} type="email" onChange={(value) => update("contact", value)} />
              </FormSection>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="publish-actions">{!editingId && <button type="button" className="button secondary" onClick={saveDraft}>{draftSaved ? "Borrador guardado" : "Guardar borrador"}</button>}<button className="button primary" type="submit">Revisar vista previa</button></div>
              {draftSaved && <p role="status" className="muted">Borrador guardado en este navegador.</p>}
            </form>
          </>
        )}
      </main>
    </div>
  );

  const organization = state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "tu organización";
  const verified = Boolean(state.currentUser?.organizacionVerificada);
  const activeOffers = offers.filter((offer) => offer.status === "PUBLICADA" && daysUntil(offer.closeDate) >= 0).length;
  const totalApplicants = offers.reduce((total, offer) => total + (offer.applicants ?? 0), 0);
  const hasWeekData = offers.some((offer) => offer.newThisWeek !== undefined);
  const newThisWeek = offers.reduce((total, offer) => total + (offer.newThisWeek ?? 0), 0);
  const startCreate = () => { setEditingId(null); setDraft(initial); setCreating(true); };
  const reviewApplicants = (filter: NonNullable<AppState["applicantFilter"]>) => navigate("company-applicants", { selectedCompanyOffer: offers[0], applicantFilter: filter });

  const metrics = [
    { label: "Ofertas activas", value: activeOffers, icon: IconBriefcase, tone: "primary", onClick: () => offersListRef.current?.scrollIntoView({ behavior: "smooth" }), disabled: false },
    { label: "Postulantes", value: totalApplicants, icon: IconUser, tone: "navy", onClick: () => reviewApplicants("Todos"), disabled: !offers[0] },
    { label: "En revisión", value: pendingApplicants, icon: IconSearch, tone: "sky", onClick: () => reviewApplicants("En revisión"), disabled: !offers[0] },
    { label: "Nuevos esta semana", value: hasWeekData ? newThisWeek : "—", icon: IconClock, tone: "amber", onClick: () => reviewApplicants("Todos"), disabled: !offers[0] },
  ];

  return (
    <div className="app-shell">
      <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />
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
                onEdit={() => startEdit(offer)}
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
  return (
    <article className="panel-card company-offer-card">
      <div className="company-offer-top">
        <div className="company-offer-info">
          <div className="company-offer-badges">
            <TypeBadge type={offer.offerType} />
            <span className={`offer-status offer-status-${status.toLowerCase()}`}>{STATUS_LABELS[status] ?? "Cerrada"}</span>
          </div>
          <h3>{offer.title}</h3>
          <p>{offer.city} · {offer.modality} · Cierra {formatDate(offer.closeDate, "sin fecha")}</p>
        </div>
        <div className="company-offer-total"><strong>{offer.applicants ?? 0}</strong><small>{offer.applicants === 1 ? "postulante" : "postulantes"}</small></div>
      </div>
      {offer.stageCounts && (
        <div>
          <div className="stage-bar" role="img" aria-label={`Postulaciones por etapa: ${counts.map((stage) => `${stage.n} ${stage.label}`).join(", ")}`}>
            {inPipeline > 0 && counts.filter((stage) => stage.n > 0).map((stage) => <span key={stage.status} className={`tone-${stage.tone}`} style={{ flexGrow: stage.n }} />)}
          </div>
          <ul className="stage-counts" aria-hidden="true">
            {counts.map((stage) => <li key={stage.status}><span className={`stage-dot tone-${stage.tone}`} /><strong>{stage.n}</strong> {stage.label}</li>)}
          </ul>
        </div>
      )}
      <div className="company-offer-actions">
        <button className="button primary" onClick={onManage}>Gestionar postulantes</button>
        {status !== "CANCELADA" && <button className="button secondary" onClick={onEdit}>Editar</button>}
        {status === "PUBLICADA" && <button className="danger-link" onClick={onCancel}>Cancelar oferta</button>}
      </div>
    </article>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="form-section"><div><h2>{title}</h2><p>{description}</p></div><div className="form-grid">{children}</div></section>;
}
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Select({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: string[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={option} value={option}>{labels?.[index] ?? option}</option>)}</select></label>;
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field full-span"><span>{label}</span><textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
