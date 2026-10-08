import { useEffect, useRef, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api } from "../lib/api";
import { formatDate } from "./StudentDashboard";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Draft = {
  title: string; area: string; description: string; program: string; semester: string; skills: string;
  experience: string; languages: string; city: string; modality: Offer["modality"]; duration: string;
  schedule: string; salary: string; salaryMin: string; salaryMax: string; closeDate: string; contact: string;
  offerType: "PRACTICA" | "EMPLEO" | "EMPLEO_PUBLICO";
};

const initial: Draft = {
  title: "", area: "Tecnología", description: "", program: "", semester: "", skills: "", experience: "No requerida",
  languages: "", city: "Bogotá", modality: "Híbrida", duration: "6 meses", schedule: "Lunes a viernes",
  salary: "", salaryMin: "", salaryMax: "", closeDate: "", contact: "",
  offerType: "PRACTICA",
};

const toUiOffer = (offer: any, fallbackCompany = "Empresa", fallbackVerified = false): Offer => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? fallbackCompany,
  logo: (offer.empresa ?? offer.company ?? "E").slice(0, 2).toUpperCase(),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: (offer.modalidad ?? "Híbrida") as Offer["modality"],
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? new Date().toISOString(),
  salary: offer.remuneracion ? `$${Number(offer.remuneracion).toLocaleString("es-CO")}/mes` : "A convenir",
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
  offerType: offer.tipo ?? offer.offerType,
  status: offer.estado ?? offer.status ?? "PUBLICADA",
  verified: Boolean(offer.verificada ?? fallbackVerified),
  duration: offer.duracion ?? offer.duration,
  schedule: offer.horario ?? offer.schedule,
  contactEmail: offer.contacto_email ?? offer.contactEmail,
  salaryMin: offer.remuneracion == null ? null : Number(offer.remuneracion),
  salaryMax: offer.remuneracion_maxima == null ? null : Number(offer.remuneracion_maxima),
});

export default function CompanyDashboard({ state, navigate }: Props) {
  const [offers, setOffers] = useState<Offer[]>([]);
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
  const offersListRef = useRef<HTMLElement>(null);
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
        const mapped = (response.offers ?? []).map(toUiOffer);
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
    const salaryOk = draft.offerType === "PRACTICA"
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
      remuneracion: draft.offerType === "PRACTICA" ? Number(draft.salary) : Number(draft.salaryMin),
      remuneracionMaxima: draft.offerType === "PRACTICA" ? null : Number(draft.salaryMax),
    };

    try {
      if (editingId) {
        const response = await api.updateOffer(editingId, payload, state.token);
        const updated = toUiOffer(response.offer, state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto, state.currentUser?.organizacionVerificada);
        setOffers((current) => current.map((o) => (o.id === editingId ? { ...updated, applicants: o.applicants } : o)));
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
              <div className="detail-tags"><span>{draft.city}</span><span>{draft.modality}</span><span>{draft.area}</span><span>{draft.offerType}</span><span>{draft.offerType === "PRACTICA" ? `${draft.salary} COP` : `${draft.salaryMin} - ${draft.salaryMax} COP`}</span></div>
              <h3>Descripción</h3><p>{draft.description}</p>
              <h3>Requisitos</h3><ul className="check-list"><li>{draft.program}</li><li>{draft.skills}</li><li>{draft.experience}</li></ul>
              <h3>Condiciones</h3><p>{draft.duration} · {draft.schedule} · Cierre {formatDate(draft.closeDate)}</p>
            </section>
            <div className="publish-actions"><button className="button secondary" onClick={() => setPreview(false)}>Volver a editar</button>{!editingId && <button className="button secondary" onClick={saveDraft}>{draftSaved ? "Borrador guardado" : "Guardar borrador"}</button>}<button className="button primary" onClick={() => void publishOffer()}>{editingId ? "Guardar cambios" : "Publicar oferta"}</button></div>
            {draftSaved && <p role="status" className="muted">Borrador guardado en este navegador.</p>}
          </>
        ) : (
          <>
            <div className="page-title"><p className="eyebrow">{editingId ? "Edición de oferta" : "Paso 1 de 2"}</p><h1>{editingId ? "Modificar oferta" : `Crear oferta ${draft.offerType === "PRACTICA" ? "de práctica" : draft.offerType === "EMPLEO" ? "laboral" : "pública"}`}</h1><p>Los campos marcados con * son obligatorios.</p></div>
            <form className="publish-form" onSubmit={(event) => { event.preventDefault(); validate(); }}>
              <FormSection title="Información del cargo" description="Describe la oportunidad con claridad.">
                <Input label="Título del cargo *" value={draft.title} onChange={(value) => update("title", value)} />
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
                {draft.offerType === "PRACTICA" ? (
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

  return (
    <div className="app-shell">
      <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />
      <main>
        <section className="company-hero"><div className="container"><div><p className="eyebrow inverse">Panel empresarial</p><h1>{state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Panel empresarial"}</h1><p>Gestiona tus ofertas y procesos de selección.</p></div><button className="button primary light" onClick={() => { setEditingId(null); setDraft(initial); setCreating(true); }}>Crear oferta</button></div></section>
        <section className="container company-content">
          {offersError && <div className="form-error mb-5" role="alert">{offersError}</div>}
          <div className="metric-grid">
            <button onClick={() => offersListRef.current?.scrollIntoView({ behavior: "smooth" })}><span>Ofertas activas</span><strong>{offers.filter((offer) => offer.status === "PUBLICADA" && new Date(offer.closeDate).getTime() >= Date.now()).length}</strong><small>Ver publicaciones</small></button>
            <button disabled={!offers[0]} onClick={() => navigate("company-applicants", { selectedCompanyOffer: offers[0], applicantFilter: "Todos" })}><span>Postulantes</span><strong>{offers.reduce((total, offer) => total + (offer.applicants ?? 0), 0)}</strong><small>Ver todos</small></button>
            <button disabled={!offers[0]} onClick={() => navigate("company-applicants", { selectedCompanyOffer: offers[0], applicantFilter: "En revisión" })}><span>En revisión</span><strong>{pendingApplicants}</strong><small>Revisar candidatos</small></button>
          </div>
          <div className="catalog-heading" ref={offersListRef}><div><p className="eyebrow">Tus publicaciones</p><h2>Ofertas publicadas</h2></div></div>
          {offers.length === 0 ? (
            <div className="empty-state">
              <h2>No tienes ofertas publicadas</h2>
              <p>Publica tu primera vacante o práctica universitaria para comenzar a recibir candidatos.</p>
              <button className="button primary" onClick={() => { setEditingId(null); setDraft(initial); setCreating(true); }}>Publicar primera oferta</button>
            </div>
          ) : (
            offers.map((offer) => (
              <article className="company-offer" key={offer.id}>
                <div>
                  <span className={`status ${offer.status === "PUBLICADA" ? "status-abierta" : "status-cerrada"}`}>{offer.status === "PUBLICADA" ? "Publicada" : offer.status === "BORRADOR" ? "Borrador" : offer.status === "CANCELADA" ? "Cancelada" : "Cerrada"}</span>
                  <h3>{offer.title}</h3>
                  <p>{offer.city} · {offer.modality} · Cierra {formatDate(offer.closeDate)}</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{offer.applicants ?? 0} postulantes</strong>
                  <button className="button secondary" onClick={() => navigate("company-applicants", { selectedCompanyOffer: offer, applicantFilter: "Todos" })}>
                    Gestionar postulantes
                  </button>
                  {offer.status !== "CANCELADA" && <button className="button secondary" onClick={() => startEdit(offer)}>
                    Editar
                  </button>}
                  {offer.status === "PUBLICADA" && <button className="button secondary" style={{ color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => setDeletingId(offer.id)}>
                    Cancelar oferta
                  </button>}
                </div>
              </article>
            ))
          )}
        </section>
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

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="form-section"><div><h2>{title}</h2><p>{description}</p></div><div className="form-grid">{children}</div></section>;
}
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field full-span"><span>{label}</span><textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
