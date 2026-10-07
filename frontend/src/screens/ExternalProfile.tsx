import { useState, useEffect } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";

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
  const [cvUploaded, setCvUploaded] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const completeness = 85;

  const user = state.currentUser;
  const initials = (user?.nombreCompleto || "Candidato Externo")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="external" navigate={navigate} activeScreen="external-profile" />

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
                    Colombia
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
                    Disponible para contratación
                  </span>
                </div>
              </div>

              {/* CV */}
              <div className="sm:ml-auto">
                <div className={`rounded-xl border-2 border-dashed p-4 text-center min-w-[160px] ${cvUploaded ? "border-[#16a34a]/30 bg-[#f0fdf4]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
                  {cvUploaded ? (
                    <>
                      <div className="text-[#16a34a] text-2xl mb-1">📄</div>
                      <p className="text-xs font-bold text-[#16a34a]">HV_Registrada.pdf</p>
                      <p className="text-[10px] text-[#64748b] mt-0.5">Perfil Activo</p>
                      <label className="mt-1.5 block text-[11px] text-[#0d2240] font-semibold hover:underline cursor-pointer">
                        Actualizar CV
                        <input type="file" accept=".pdf" className="hidden" onChange={() => setCvUploaded(true)} />
                      </label>
                    </>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="text-2xl mb-1">📎</div>
                      <p className="text-xs font-bold text-[#0d2240]">Subir hoja de vida</p>
                      <p className="text-[10px] text-[#94a3b8]">PDF · máx 5 MB</p>
                      <input type="file" accept=".pdf" className="hidden" onChange={() => setCvUploaded(true)} />
                    </label>
                  )}
                </div>
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
            {activeTab === "experience" && <ExternalExperienceTab />}
            {activeTab === "education" && <ExternalEducationTab />}
            {activeTab === "skills" && <ExternalSkillsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalInfoTab({ state, onSave }: { state: AppState; onSave?: (p: Record<string, unknown>) => Promise<void> }) {
  const [nombre, setNombre] = useState(state.currentUser?.nombreCompleto ?? "");
  const [telefono, setTelefono] = useState(state.currentUser?.telefono ?? "");
  const [ubicacion, setUbicacion] = useState("Bogotá, Colombia");
  const [disponibilidad, setDisponibilidad] = useState("Inmediata");
  const [resumen, setResumen] = useState("Profesional capacitado y orientado al logro, con experiencia en proyectos y trabajo colaborativo.");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.currentUser?.nombreCompleto) {
      setNombre(state.currentUser.nombreCompleto);
    }
  }, [state.currentUser]);

  const handleSave = async () => {
    if (!onSave) return;
    setLoading(true);
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
      console.error(e);
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

function ExternalExperienceTab() {
  return (
    <div className="space-y-4">
      {[
        { logo: "TC", bg: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)", title: "Desarrollador Full Stack", company: "TechCorp SAS", period: "Ene 2024 — Actual · Tiempo completo", desc: "Desarrollo de plataformas web con React y Node.js para clientes del sector financiero." },
        { logo: "ST", bg: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", title: "Desarrollador Frontend", company: "StartupX", period: "Mar 2022 — Dic 2023 · Tiempo completo", desc: "Construcción del frontend de un SaaS B2B con React, TypeScript y GraphQL." },
        { logo: "FR", bg: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", title: "Desarrollador Web Freelance", company: "Independiente", period: "Jun 2021 — Feb 2022 · Freelance", desc: "Desarrollo de sitios y aplicaciones web para PYMEs colombianas." },
      ].map((e) => (
        <div key={e.title} className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: e.bg }}>
            <span className="text-white text-xs font-bold">{e.logo}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#0d2240] text-sm">{e.title}</h4>
            <p className="text-[#64748b] text-sm font-medium">{e.company}</p>
            <p className="text-[#94a3b8] text-xs mt-0.5">{e.period}</p>
            <p className="text-[#475569] text-sm mt-2 leading-relaxed">{e.desc}</p>
          </div>
          <button className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium flex-shrink-0">Editar</button>
        </div>
      ))}
      <button className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar experiencia
      </button>
    </div>
  );
}

function ExternalEducationTab() {
  return (
    <div className="space-y-4">
      {[
        { logo: "UN", bg: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", title: "Ingeniería de Sistemas", institution: "Universidad Nacional de Colombia", period: "2017 — 2021 · Graduado" },
        { logo: "PL", bg: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)", title: "Platzi Master · Full Stack", institution: "Platzi", period: "2022 · Certificación" },
      ].map((e) => (
        <div key={e.title} className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: e.bg }}>
            <span className="text-white text-xs font-bold">{e.logo}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#0d2240] text-sm">{e.title}</h4>
            <p className="text-[#64748b] text-sm">{e.institution}</p>
            <p className="text-[#94a3b8] text-xs mt-1">{e.period}</p>
          </div>
          <button className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium">Editar</button>
        </div>
      ))}
      <button className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar educación
      </button>
    </div>
  );
}

function ExternalSkillsTab() {
  const categories = [
    { label: "Frontend", skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "GraphQL"], style: "bg-blue-50 text-blue-700" },
    { label: "Backend", skills: ["Node.js", "Express", "NestJS", "PostgreSQL", "MongoDB"], style: "bg-violet-50 text-violet-700" },
    { label: "Cloud & DevOps", skills: ["AWS", "Docker", "GitHub Actions", "Vercel"], style: "bg-sky-50 text-sky-700" },
    { label: "Idiomas", skills: ["Español (Nativo)", "Inglés (B2)"], style: "bg-amber-50 text-amber-700" },
    { label: "Blandas", skills: ["Trabajo remoto", "Comunicación técnica", "Liderazgo de proyectos"], style: "bg-emerald-50 text-emerald-700" },
  ];

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
            <button className={`text-sm px-3.5 py-1.5 rounded-full font-semibold border-2 border-dashed opacity-40 hover:opacity-70 ${cat.style}`}>
              + Agregar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
