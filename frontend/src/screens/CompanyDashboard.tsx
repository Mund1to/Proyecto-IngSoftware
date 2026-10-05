import { useState } from "react";
import { AppState, Offer, OFFERS, Screen } from "../App";
import NavBar from "../components/NavBar";
import { formatDate } from "./StudentDashboard";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Draft = {
  title: string; area: string; description: string; program: string; semester: string; skills: string;
  experience: string; languages: string; city: string; modality: Offer["modality"]; duration: string;
  schedule: string; salary: string; closeDate: string; contact: string;
};

const initial: Draft = {
  title: "", area: "Tecnología", description: "", program: "", semester: "", skills: "", experience: "No requerida",
  languages: "", city: "Bogotá", modality: "Híbrida", duration: "6 meses", schedule: "Lunes a viernes",
  salary: "", closeDate: "", contact: "",
};

export default function CompanyDashboard({ navigate }: Props) {
  const offers = OFFERS.filter((offer) => offer.company === "Bancolombia");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");

  const update = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const validate = () => {
    if (!draft.title || !draft.description || !draft.program || !draft.skills || !draft.city || !draft.salary || !draft.closeDate || !draft.contact) {
      setError("Completa todos los campos obligatorios antes de continuar.");
      return;
    }
    setError("");
    setPreview(true);
  };

  if (creating) return (
    <div className="app-shell">
      <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" />
      <main className="container publish-page">
        <button className="back-button" onClick={() => { setCreating(false); setPreview(false); }}>← Volver al panel</button>
        {published ? (
          <div className="publish-success"><div className="success-icon">✓</div><h1>Oferta publicada</h1><p>La oferta ya está visible para estudiantes elegibles.</p><button className="button primary" onClick={() => { setPublished(false); setCreating(false); }}>Ver oferta publicada</button></div>
        ) : preview ? (
          <>
            <div className="page-title"><p className="eyebrow">Paso 2 de 2</p><h1>Vista previa de la oferta</h1><p>Así la verán los estudiantes. Revisa la información antes de publicarla.</p></div>
            <section className="preview-card">
              <span className="status status-abierta">Abierta</span>
              <h2>{draft.title}</h2><p className="verified">Bancolombia <span>✓ Empresa verificada</span></p>
              <div className="detail-tags"><span>{draft.city}</span><span>{draft.modality}</span><span>{draft.area}</span><span>{draft.salary} COP</span></div>
              <h3>Descripción</h3><p>{draft.description}</p>
              <h3>Requisitos</h3><ul className="check-list"><li>{draft.program}</li><li>{draft.skills}</li><li>{draft.experience}</li></ul>
              <h3>Condiciones</h3><p>{draft.duration} · {draft.schedule} · Cierre {formatDate(draft.closeDate)}</p>
            </section>
            <div className="publish-actions"><button className="button secondary" onClick={() => setPreview(false)}>Volver a editar</button><button className="button secondary" onClick={() => alert("Borrador guardado")}>Guardar borrador</button><button className="button primary" onClick={() => setPublished(true)}>Publicar oferta</button></div>
          </>
        ) : (
          <>
            <div className="page-title"><p className="eyebrow">Paso 1 de 2</p><h1>Crear oferta de práctica</h1><p>Los campos marcados con * son obligatorios.</p></div>
            <form className="publish-form" onSubmit={(event) => { event.preventDefault(); validate(); }}>
              <FormSection title="Información del cargo" description="Describe la oportunidad con claridad.">
                <Input label="Título del cargo *" value={draft.title} onChange={(value) => update("title", value)} />
                <Select label="Área *" value={draft.area} options={["Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Diseño"]} onChange={(value) => update("area", value)} />
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
                <Input label="Remuneración mensual COP *" value={draft.salary} onChange={(value) => update("salary", value)} />
              </FormSection>
              <FormSection title="Publicación" description="Define vigencia y persona de contacto.">
                <Input label="Fecha de cierre *" value={draft.closeDate} type="date" onChange={(value) => update("closeDate", value)} />
                <Input label="Correo de contacto *" value={draft.contact} type="email" onChange={(value) => update("contact", value)} />
              </FormSection>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="publish-actions"><button type="button" className="button secondary" onClick={() => alert("Borrador guardado")}>Guardar borrador</button><button className="button primary" type="submit">Revisar vista previa</button></div>
            </form>
          </>
        )}
      </main>
    </div>
  );

  return (
    <div className="app-shell">
      <NavBar role="company" navigate={navigate} activeScreen="company-dashboard" />
      <main>
        <section className="company-hero"><div className="container"><div><p className="eyebrow inverse">Panel empresarial</p><h1>Bancolombia</h1><p>Gestiona tus ofertas de práctica y procesos de selección.</p></div><button className="button primary light" onClick={() => setCreating(true)}>Crear oferta de práctica</button></div></section>
        <section className="container company-content">
          <div className="metric-grid">
            <button onClick={() => undefined}><span>Ofertas activas</span><strong>1</strong><small>Ver ofertas</small></button>
            <button onClick={() => navigate("company-applicants", { selectedCompanyOffer: offers[0] })}><span>Postulantes</span><strong>34</strong><small>Ver postulantes</small></button>
            <button onClick={() => navigate("company-applicants", { selectedCompanyOffer: offers[0] })}><span>En revisión</span><strong>2</strong><small>Gestionar proceso</small></button>
          </div>
          <div className="catalog-heading"><div><p className="eyebrow">Tus publicaciones</p><h2>Ofertas de práctica</h2></div></div>
          {offers.map((offer) => <article className="company-offer" key={offer.id}><div><span className="status status-abierta">Abierta</span><h3>{offer.title}</h3><p>{offer.city} · {offer.modality} · Cierra {formatDate(offer.closeDate)}</p></div><div><strong>34 postulantes</strong><button className="button secondary" onClick={() => navigate("company-applicants", { selectedCompanyOffer: offer })}>Gestionar postulantes</button></div></article>)}
        </section>
      </main>
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
