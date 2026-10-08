import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import useStoredList from "../lib/useStoredList";

type Props = { state: AppState; navigate: (screen: Screen) => void; updateStudentProfile: (payload: Record<string, unknown>) => Promise<void> };

const tabs = [
  { id: "info", label: "Info personal" },
  { id: "education", label: "Educación" },
  { id: "experience", label: "Experiencia" },
  { id: "skills", label: "Habilidades" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function StudentProfile({ state, navigate, updateStudentProfile }: Props) {
  const [cvName, setCvName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const user = state.currentUser;
  const initials = (user?.nombreCompleto ?? "Estudiante").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const profileId = user?.id ?? "demo";
  const completeness = Math.round([
    user?.nombreCompleto,
    user?.telefono,
    user?.universidad,
    user?.programaAcademico,
    user?.semestre,
    user?.codigoEstudiante,
    user?.fechaGraduacionEstimada,
  ].filter(Boolean).length / 7 * 100);

  const selectPdf = (file?: File) => {
    setFileError("");
    if (!file) return;
    if (file.type !== "application/pdf") return setFileError("Selecciona un archivo PDF.");
    if (file.size > 5 * 1024 * 1024) return setFileError("El PDF no puede superar 5 MB.");
    setCvName(file.name);
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="student" navigate={navigate} activeScreen="student-profile" userName={user?.nombreCompleto ?? "Estudiante"} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#0d2240]">Mi Perfil</h1>
          <button onClick={() => { setActiveTab("info"); document.getElementById("student-profile-form")?.scrollIntoView({ behavior: "smooth" }); }} className="text-sm font-semibold text-[#16a34a] flex items-center gap-1.5 hover:underline">
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
                  style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
                >
                  {!avatarUrl && <span className="text-white font-bold text-2xl">{initials}</span>}
                </div>
                <label title="Cambiar foto" className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center shadow-sm hover:bg-[#f8fafc] cursor-pointer">
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAvatarUrl(URL.createObjectURL(file)); }} />
                  <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </label>
              </div>

              <div className="flex-1 min-w-0 sm:pb-1">
                <h2 className="text-xl font-bold text-[#0d2240]">{user?.nombreCompleto ?? "Estudiante"}</h2>
                <p className="text-[#64748b] text-sm font-medium">{user?.programaAcademico ?? "Completa tu programa académico"}{user?.semestre ? ` · ${user.semestre}° Semestre` : ""}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#94a3b8]">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {user?.universidad ?? "Universidad"}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {user?.email ?? ""}
                  </span>
                </div>
              </div>

              {/* CV upload */}
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
            {activeTab === "info" && <InfoTab user={user} onSave={updateStudentProfile} />}
            {activeTab === "education" && <EducationTab profileId={profileId} />}
            {activeTab === "experience" && <ExperienceTab profileId={profileId} />}
            {activeTab === "skills" && <SkillsTab profileId={profileId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
function InfoTab({ user, onSave }: { user: AppState["currentUser"]; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    nombreCompleto: user?.nombreCompleto ?? "",
    telefono: user?.telefono ?? "",
    universidad: user?.universidad ?? "",
    programaAcademico: user?.programaAcademico ?? "",
    semestre: user?.semestre?.toString() ?? "",
    codigoEstudiante: user?.codigoEstudiante ?? "",
    fechaGraduacionEstimada: user?.fechaGraduacionEstimada?.slice(0, 10) ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      nombreCompleto: user?.nombreCompleto ?? "",
      telefono: user?.telefono ?? "",
      universidad: user?.universidad ?? "",
      programaAcademico: user?.programaAcademico ?? "",
      semestre: user?.semestre?.toString() ?? "",
      codigoEstudiante: user?.codigoEstudiante ?? "",
      fechaGraduacionEstimada: user?.fechaGraduacionEstimada?.slice(0, 10) ?? "",
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        ...form,
        semestre: form.semestre ? Number(form.semestre) : null,
        fechaGraduacionEstimada: form.fechaGraduacionEstimada || null,
      });
      setMessage("Cambios guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof typeof form; label: string; type?: string }[] = [
    { key: "nombreCompleto", label: "Nombre completo" },
    { key: "telefono", label: "Teléfono", type: "tel" },
    { key: "universidad", label: "Universidad" },
    { key: "programaAcademico", label: "Programa académico" },
    { key: "semestre", label: "Semestre", type: "number" },
    { key: "codigoEstudiante", label: "Código estudiantil" },
    { key: "fechaGraduacionEstimada", label: "Graduación estimada", type: "date" },
  ];

  return (
    <div id="student-profile-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">{f.label}</label>
            <input
              type={f.type ?? "text"}
              min={f.type === "number" ? 1 : undefined}
              value={form[f.key]}
              onChange={(event) => setForm((current) => ({ ...current, [f.key]: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
              style={{ outline: "none" }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && <span role="status" className={`text-sm ${message === "Cambios guardados." ? "text-[#16a34a]" : "text-red-600"}`}>{message}</span>}
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
type EducationEntry = { id: string; logo: string; bg: string; title: string; institution: string; period: string };
const initialEducation: EducationEntry[] = [];

function EducationTab({ profileId }: { profileId: number | string }) {
  const [entries, setEntries] = useStoredList(`sipu-student-education-v2-${profileId}`, initialEducation);
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
type ExperienceEntry = { id: string; title: string; company: string; period: string; description: string };
const initialExperience: ExperienceEntry[] = [];

function ExperienceTab({ profileId }: { profileId: number | string }) {
  const [entries, setEntries] = useStoredList(`sipu-student-experience-v2-${profileId}`, initialExperience);
  const edit = (entry: ExperienceEntry) => {
    const title = window.prompt("Cargo", entry.title);
    if (title === null) return;
    const company = window.prompt("Empresa o institución", entry.company);
    if (company === null) return;
    const period = window.prompt("Periodo", entry.period);
    if (period === null) return;
    const description = window.prompt("Descripción", entry.description);
    if (description === null) return;
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, title, company, period, description } : item));
  };
  const add = () => {
    const title = window.prompt("Cargo o experiencia");
    if (!title?.trim()) return;
    const company = window.prompt("Empresa o institución");
    if (!company?.trim()) return;
    const period = window.prompt("Periodo");
    if (!period?.trim()) return;
    const description = window.prompt("Descripción") ?? "";
    setEntries((current) => [...current, { id: crypto.randomUUID(), title, company, period, description }]);
  };

  return (
    <div className="space-y-4">
      {entries.map((entry) => <div key={entry.id} className="flex items-start gap-4 p-5 rounded-2xl bg-[#f8fafc] border border-[#e8eef4]">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}><span className="text-white text-xs font-bold">{entry.company.slice(0, 2).toUpperCase()}</span></div>
        <div className="flex-1"><h4 className="font-bold text-[#0d2240] text-sm">{entry.title}</h4><p className="text-[#64748b] text-sm font-medium">{entry.company}</p><p className="text-[#94a3b8] text-xs mt-0.5">{entry.period}</p><p className="text-[#475569] text-sm mt-2.5 leading-relaxed">{entry.description}</p></div>
        <button onClick={() => edit(entry)} className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium flex-shrink-0">Editar</button>
      </div>)}
      <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-sm font-semibold text-[#94a3b8] hover:border-[#0d2240]/30 hover:text-[#0d2240] flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar experiencia
      </button>
    </div>
  );
}
type SkillCategory = { label: string; skills: string[]; style: string };
const initialSkills: SkillCategory[] = [
    { label: "Técnicas", skills: [], style: "bg-blue-50 text-blue-700" },
    { label: "Herramientas", skills: [], style: "bg-violet-50 text-violet-700" },
    { label: "Idiomas", skills: [], style: "bg-amber-50 text-amber-700" },
    { label: "Habilidades blandas", skills: [], style: "bg-emerald-50 text-emerald-700" },
];

function SkillsTab({ profileId }: { profileId: number | string }) {
  const [categories, setCategories] = useStoredList(`sipu-student-skills-v2-${profileId}`, initialSkills);

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
            <button onClick={() => { const skill = window.prompt(`Agregar habilidad en ${cat.label}`); if (skill?.trim()) setCategories((current) => current.map((item) => item.label === cat.label && !item.skills.includes(skill.trim()) ? { ...item, skills: [...item.skills, skill.trim()] } : item)); }} className={`text-sm px-3.5 py-1.5 rounded-full font-semibold border-2 border-dashed opacity-70 hover:opacity-100 ${cat.style}`}>
              + Agregar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

