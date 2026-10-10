import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import ChangePasswordCard from "../components/ChangePasswordCard";
import NavBar from "../components/NavBar";
import { FileCard, ProfileAvatar, findFile } from "../components/ProfileFiles";
import ProfileSections from "../components/ProfileSections";

type Props = {
  state: AppState;
  navigate: (screen: Screen) => void;
  updateStudentProfile: (payload: Record<string, unknown>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const tabs = [
  { id: "info", label: "Info personal" },
  { id: "education", label: "Educación" },
  { id: "experience", label: "Experiencia" },
  { id: "skills", label: "Habilidades" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function StudentProfile({ state, navigate, updateStudentProfile, changePassword, refreshCurrentUser }: Props) {
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
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
              {/* Avatar */}
              <div className="-mt-10 shrink-0"><ProfileAvatar token={state.token} photo={findFile(user?.archivos, "FOTO")} initials={initials} onChanged={refreshCurrentUser} gradient="linear-gradient(135deg, #0d2240 0%, #163456 100%)" /></div>

              <div className="flex-1 min-w-0 sm:pt-3">
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

              {/* Hoja de vida */}
              <div className="sm:ml-auto sm:pt-4">
                <FileCard token={state.token} kind="cv" current={findFile(user?.archivos, "CV")} onChanged={refreshCurrentUser} />
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
                💡 Completa todos los datos de Info personal para llegar al 100% y destacar frente a las empresas
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
            {activeTab === "education" && <ProfileSections token={state.token} section="education" skillCategories={["Técnicas", "Herramientas", "Idiomas", "Habilidades blandas"]} legacyPrefix="student" profileId={profileId} />}
            {activeTab === "experience" && <ProfileSections token={state.token} section="experience" skillCategories={["Técnicas", "Herramientas", "Idiomas", "Habilidades blandas"]} legacyPrefix="student" profileId={profileId} />}
            {activeTab === "skills" && <ProfileSections token={state.token} section="skills" skillCategories={["Técnicas", "Herramientas", "Idiomas", "Habilidades blandas"]} legacyPrefix="student" profileId={profileId} />}
          </div>
        </div>

        <ChangePasswordCard onChange={changePassword} />
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
