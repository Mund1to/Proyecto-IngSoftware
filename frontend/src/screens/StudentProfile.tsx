import { useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";

type Props = { state: AppState; navigate: (screen: Screen) => void };

const tabs = [
  { id: "info", label: "Info personal" },
  { id: "education", label: "Educación" },
  { id: "experience", label: "Experiencia" },
  { id: "skills", label: "Habilidades" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function StudentProfile({ state, navigate }: Props) {
  const [cvUploaded, setCvUploaded] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const completeness = 78;

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="student" navigate={navigate} activeScreen="student-profile" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#0d2240]">Mi Perfil</h1>
          <button className="text-sm font-semibold text-[#16a34a] flex items-center gap-1.5 hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar perfil
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-3xl border border-[#e8eef4] overflow-hidden mb-6 shadow-sm">
          {/* Banner */}
          <div
            className="h-28 relative"
            style={{ background: "linear-gradient(145deg, #081626 0%, #0d2240 60%, #122f5c 100%)" }}
          >
            <div className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }} />
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-5">
              {/* Avatar */}
              <div className="relative w-fit">
                <div
                  className="w-20 h-20 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
                >
                  <span className="text-white font-bold text-2xl">LC</span>
                </div>
                <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center shadow-sm hover:bg-[#f8fafc]">
                  <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 min-w-0 sm:pb-1">
                <h2 className="text-xl font-bold text-[#0d2240]">Laura Camila Martínez Gómez</h2>
                <p className="text-[#64748b] text-sm font-medium">Ingeniería de Sistemas · 9° Semestre</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#94a3b8]">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ibagué, Tolima
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    lc.martinez@unibague.edu.co
                  </span>
                </div>
              </div>

              {/* CV upload */}
              <div className="sm:ml-auto">
                <div className={`rounded-xl border-2 border-dashed p-4 text-center min-w-[160px] ${cvUploaded ? "border-[#16a34a]/30 bg-[#f0fdf4]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
                  {cvUploaded ? (
                    <>
                      <div className="text-[#16a34a] text-2xl mb-1">📄</div>
                      <p className="text-xs font-bold text-[#16a34a]">HV_Laura.pdf</p>
                      <p className="text-[10px] text-[#64748b] mt-0.5">Sep 5, 2026</p>
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
                💡 Agrega experiencia laboral para llegar al 100% y destacar frente a las empresas
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
            {activeTab === "info" && <InfoTab />}
            {activeTab === "education" && <EducationTab />}
            {activeTab === "experience" && <ExperienceTab />}
            {activeTab === "skills" && <SkillsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTab() {
  const fields = [
    { label: "Nombre completo", value: "Laura Camila Martínez Gómez", span: false },
    { label: "Documento de identidad", value: "CC 1.006.843.217", span: false },
    { label: "Teléfono", value: "+57 315 823 4490", span: false },
    { label: "Correo institucional", value: "lc.martinez@unibague.edu.co", span: false },
    { label: "Ciudad de residencia", value: "Ibagué, Tolima", span: false },
    { label: "Código estudiantil", value: "2019270001", span: false },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">{f.label}</label>
            <input
              type="text"
              defaultValue={f.value}
              className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
              style={{ outline: "none" }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function EducationTab() {
  return (
    <div className="space-y-4">
      {[
        { logo: "UB", bg: "linear-gradient(135deg, #0d2240 0%, #163456 100%)", title: "Ingeniería de Sistemas", institution: "Universidad de Ibagué", period: "2019 — Actual · 9° Semestre · GPA: 4.2 / 5.0" },
        { logo: "IE", bg: "linear-gradient(135deg, #475569 0%, #334155 100%)", title: "Bachillerato Académico", institution: "I.E. Técnica Comercial de Ibagué", period: "2013 — 2018" },
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

function ExperienceTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}>
          <span className="text-white text-xs font-bold">UB</span>
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-[#0d2240] text-sm">Monitor de Laboratorio de Sistemas</h4>
          <p className="text-[#64748b] text-sm font-medium">Universidad de Ibagué</p>
          <p className="text-[#94a3b8] text-xs mt-0.5">Feb 2025 — Actual · Medio tiempo</p>
          <p className="text-[#475569] text-sm mt-2.5 leading-relaxed">
            Apoyo a estudiantes en herramientas de programación y administración del laboratorio de sistemas.
          </p>
        </div>
        <button className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium flex-shrink-0">Editar</button>
      </div>
      <button className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar experiencia
      </button>
    </div>
  );
}

function SkillsTab() {
  const categories = [
    { label: "Técnicas", skills: ["Python", "JavaScript", "React", "SQL", "Java", "Git", "Linux"], style: "bg-blue-50 text-blue-700" },
    { label: "Herramientas", skills: ["VS Code", "Figma", "Jira", "Postman"], style: "bg-violet-50 text-violet-700" },
    { label: "Idiomas", skills: ["Español (Nativo)", "Inglés (B1)"], style: "bg-amber-50 text-amber-700" },
    { label: "Habilidades blandas", skills: ["Trabajo en equipo", "Comunicación efectiva", "Resolución de problemas", "Aprendizaje continuo"], style: "bg-emerald-50 text-emerald-700" },
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
              <span key={s} className={`text-sm px-3.5 py-1.5 rounded-full font-semibold ${cat.style}`}>
                {s}
              </span>
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
