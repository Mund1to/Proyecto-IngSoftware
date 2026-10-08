import { useState, useEffect } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import useStoredList from "../lib/useStoredList";

type Props = {
  state: AppState;
  navigate: (screen: Screen) => void;
  updateExternalProfile?: (payload: Record<string, unknown>) => Promise<void>;
};

const tabs = [
  { id: "info", label: "Info personal" },
  { id: "experience", label: "Experiencia" },
  { id: "education", label: "Educación" },
  { id: "skills", label: "Habilidades" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function ExternalProfile({ state, navigate, updateExternalProfile }: Props) {
  const [cvName, setCvName] = useState("");
  const [fileError, setFileError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("info");

  const user = state.currentUser;
  const profileId = user?.id ?? "demo";
  const completeness = Math.round([
    user?.nombreCompleto,
    user?.telefono,
    user?.ubicacion,
    user?.disponibilidad,
    user?.resumen,
  ].filter(Boolean).length / 5 * 100);
  const selectPdf = (file?: File) => {
    setFileError("");
    if (!file) return;
    if (file.type !== "application/pdf") return setFileError("Selecciona un archivo PDF.");
    if (file.size > 5 * 1024 * 1024) return setFileError("El PDF no puede superar 5 MB.");
    setCvName(file.name);
  };
  const initials = (user?.nombreCompleto || "Candidato Externo")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="external" navigate={navigate} activeScreen="external-profile" userName={user?.nombreCompleto ?? "Candidato"} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#0d2240]">Mi Perfil</h1>
          <button
            onClick={() => setActiveTab("info")}
            className="text-sm font-semibold text-[#16a34a] flex items-center gap-1.5 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar perfil
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-3xl border border-[#e8eef4] overflow-hidden mb-6 shadow-sm">
          <div
            className="h-28 relative"
            style={{ background: "linear-gradient(145deg, #081626 0%, #0d2240 60%, #1e3a6e 100%)" }}
          >
            <div className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }} />
            {/* "Profesional externo" badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#60a5fa]/20 border border-[#60a5fa]/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
              <span className="text-[#93c5fd] text-xs font-semibold">Candidato externo</span>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-5">
              <div className="relative w-fit">
                <div
                  className="w-20 h-20 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)" }}
                >
                  <span className="text-white font-bold text-2xl">{initials || "CE"}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 sm:pb-1">
                <h2 className="text-xl font-bold text-[#0d2240]">{user?.nombreCompleto ?? "Candidato Externo"}</h2>
                <p className="text-[#64748b] text-sm font-medium">Bolsa de Empleo General</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#94a3b8]">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {user?.ubicacion ?? "Ubicación no indicada"}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {user?.email ?? "correo@ejemplo.com"}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {user?.disponibilidad ?? "Disponibilidad no indicada"}
                  </span>
                </div>
              </div>

              {/* CV */}
              <div className="sm:ml-auto">
                <div className={`rounded-xl border-2 border-dashed p-4 text-center min-w-[160px] ${cvName ? "border-[#16a34a]/30 bg-[#f0fdf4]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
                  {cvName ? (
                    <>
                      <div className="text-[#16a34a] text-2xl mb-1">📄</div>
                      <p className="text-xs font-bold text-[#16a34a] break-all">{cvName}</p>
                      <p className="text-[10px] text-[#64748b] mt-0.5">Seleccionado en este dispositivo</p>
                      <label className="mt-1.5 block text-[11px] text-[#0d2240] font-semibold hover:underline cursor-pointer">
                        Actualizar CV
                        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => selectPdf(event.target.files?.[0])} />
                      </label>
                    </>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="text-2xl mb-1">📎</div>
                      <p className="text-xs font-bold text-[#0d2240]">Subir hoja de vida</p>
                      <p className="text-[10px] text-[#94a3b8]">PDF · máx 5 MB</p>
                      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => selectPdf(event.target.files?.[0])} />
                    </label>
                  )}
                </div>
                {fileError && <p className="mt-2 max-w-[180px] text-xs text-red-600" role="alert">{fileError}</p>}
                {cvName && <p className="mt-2 max-w-[180px] text-[10px] text-[#64748b]">El archivo aún no se carga al servidor.</p>}
              </div>
            </div>

            {/* Completion bar */}
            <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e8eef4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#0d2240]">Perfil completado</span>
                <span className="text-sm font-bold text-[#16a34a] tabular">{completeness}%</span>
              </div>
              <div className="h-2.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${completeness}%`,
                    background: "linear-gradient(90deg, #16a34a 0%, #4ade80 100%)",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <p className="text-xs text-[#94a3b8] mt-2">
                💡 Mantén tu información actualizada para recibir mejores ofertas laborales.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-3xl border border-[#e8eef4] overflow-hidden shadow-sm">
          <div className="flex border-b border-[#f1f5f9] overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? "border-[#0d2240] text-[#0d2240]"
                    : "border-transparent text-[#94a3b8] hover:text-[#475569]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-7">
            {activeTab === "info" && <ExternalInfoTab state={state} onSave={updateExternalProfile} />}
            {activeTab === "experience" && <ExternalExperienceTab profileId={profileId} />}
            {activeTab === "education" && <ExternalEducationTab profileId={profileId} />}
            {activeTab === "skills" && <ExternalSkillsTab profileId={profileId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalInfoTab({ state, onSave }: { state: AppState; onSave?: (p: Record<string, unknown>) => Promise<void> }) {
  const [nombre, setNombre] = useState(state.currentUser?.nombreCompleto ?? "");
  const [telefono, setTelefono] = useState(state.currentUser?.telefono ?? "");
  const [ubicacion, setUbicacion] = useState(state.currentUser?.ubicacion ?? "");
  const [disponibilidad, setDisponibilidad] = useState(state.currentUser?.disponibilidad ?? "");
  const [resumen, setResumen] = useState(state.currentUser?.resumen ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(state.currentUser?.nombreCompleto ?? "");
    setTelefono(state.currentUser?.telefono ?? "");
    setUbicacion(state.currentUser?.ubicacion ?? "");
    setDisponibilidad(state.currentUser?.disponibilidad ?? "");
    setResumen(state.currentUser?.resumen ?? "");
  }, [state.currentUser]);

  const handleSave = async () => {
    if (!onSave) return;
    setLoading(true);
    setSaveError("");
    try {
      await onSave({
        nombreCompleto: nombre,
        telefono,
        ubicacion,
        disponibilidad,
        resumen,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Nombre completo</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Correo electrónico</label>
          <input
            type="text"
            value={state.currentUser?.email ?? ""}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-gray-100 text-sm text-[#64748b] cursor-not-allowed"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Teléfono de contacto</label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 000 0000"
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Ciudad de residencia / Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Disponibilidad</label>
          <input
            type="text"
            value={disponibilidad}
            onChange={(e) => setDisponibilidad(e.target.value)}
            placeholder="Inmediata / A convenir"
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Resumen / Perfil laboral</label>
          <textarea
            rows={3}
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] resize-none focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-semibold text-[#16a34a]">✓ ¡Cambios guardados con éxito!</span>}
        {saveError && <span role="alert" className="text-sm font-semibold text-red-600">{saveError}</span>}
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

type ExperienceEntry = { id: string; logo: string; bg: string; title: string; company: string; period: string; desc: string };
const initialExperience: ExperienceEntry[] = [];

function ExternalExperienceTab({ profileId }: { profileId: number | string }) {
  const [entries, setEntries] = useStoredList(`sipu-external-experience-v2-${profileId}`, initialExperience);
  const edit = (entry: ExperienceEntry) => {
    const title = window.prompt("Cargo", entry.title);
    if (title === null) return;
    const company = window.prompt("Empresa", entry.company);
    if (company === null) return;
    const period = window.prompt("Periodo", entry.period);
    if (period === null) return;
    const desc = window.prompt("Descripción", entry.desc);
    if (desc === null) return;
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, title, company, period, desc } : item));
  };
  const add = () => {
    const title = window.prompt("Cargo o experiencia");
    if (!title?.trim()) return;
    const company = window.prompt("Empresa");
    if (!company?.trim()) return;
    const period = window.prompt("Periodo");
    if (!period?.trim()) return;
    const desc = window.prompt("Descripción") ?? "";
    setEntries((current) => [...current, { id: crypto.randomUUID(), logo: company.slice(0, 2).toUpperCase(), bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", title, company, period, desc }]);
  };

  return (
    <div className="space-y-4">
      {entries.map((e) => (
        <div key={e.id} className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: e.bg }}>
            <span className="text-white text-xs font-bold">{e.logo}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#0d2240] text-sm">{e.title}</h4>
            <p className="text-[#64748b] text-sm font-medium">{e.company}</p>
            <p className="text-[#94a3b8] text-xs mt-0.5">{e.period}</p>
            <p className="text-[#475569] text-sm mt-2 leading-relaxed">{e.desc}</p>
          </div>
          <button onClick={() => edit(e)} className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium flex-shrink-0">Editar</button>
        </div>
      ))}
      <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar experiencia
      </button>
    </div>
  );
}

type EducationEntry = { id: string; logo: string; bg: string; title: string; institution: string; period: string };
const initialEducation: EducationEntry[] = [];

function ExternalEducationTab({ profileId }: { profileId: number | string }) {
  const [entries, setEntries] = useStoredList(`sipu-external-education-v2-${profileId}`, initialEducation);
  const edit = (entry: EducationEntry) => {
    const title = window.prompt("Título de la formación", entry.title);
    if (title === null) return;
    const institution = window.prompt("Institución", entry.institution);
    if (institution === null) return;
    const period = window.prompt("Periodo", entry.period);
    if (period === null) return;
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, title, institution, period } : item));
  };
  const add = () => {
    const title = window.prompt("Título de la formación");
    if (!title?.trim()) return;
    const institution = window.prompt("Institución");
    if (!institution?.trim()) return;
    const period = window.prompt("Periodo");
    if (!period?.trim()) return;
    setEntries((current) => [...current, { id: crypto.randomUUID(), logo: title.slice(0, 2).toUpperCase(), bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", title, institution, period }]);
  };

  return (
    <div className="space-y-4">
      {entries.map((e) => (
        <div key={e.id} className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: e.bg }}>
            <span className="text-white text-xs font-bold">{e.logo}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#0d2240] text-sm">{e.title}</h4>
            <p className="text-[#64748b] text-sm">{e.institution}</p>
            <p className="text-[#94a3b8] text-xs mt-1">{e.period}</p>
          </div>
          <button onClick={() => edit(e)} className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium">Editar</button>
        </div>
      ))}
      <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar educación
      </button>
    </div>
  );
}

type SkillCategory = { label: string; skills: string[]; style: string };
const initialSkills: SkillCategory[] = [
    { label: "Frontend", skills: [], style: "bg-blue-50 text-blue-700" },
    { label: "Backend", skills: [], style: "bg-violet-50 text-violet-700" },
    { label: "Cloud & DevOps", skills: [], style: "bg-sky-50 text-sky-700" },
    { label: "Idiomas", skills: [], style: "bg-amber-50 text-amber-700" },
    { label: "Blandas", skills: [], style: "bg-emerald-50 text-emerald-700" },
];

function ExternalSkillsTab({ profileId }: { profileId: number | string }) {
  const [categories, setCategories] = useStoredList(`sipu-external-skills-v2-${profileId}`, initialSkills);

  return (
    <div className="space-y-7">
      {categories.map((cat) => (
        <div key={cat.label}>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-bold text-[#0d2240]">{cat.label}</h4>
            <div className="flex-1 h-px bg-[#f1f5f9]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {cat.skills.map((s) => (
              <span key={s} className={`text-sm px-3.5 py-1.5 rounded-full font-semibold ${cat.style}`}>{s}</span>
            ))}
            <button onClick={() => { const skill = window.prompt(`Agregar habilidad en ${cat.label}`); if (skill?.trim()) setCategories((current) => current.map((item) => item.label === cat.label && !item.skills.includes(skill.trim()) ? { ...item, skills: [...item.skills, skill.trim()] } : item)); }} className={`text-sm px-3.5 py-1.5 rounded-full font-semibold border-2 border-dashed opacity-70 hover:opacity-100 ${cat.style}`}>
              + Agregar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
