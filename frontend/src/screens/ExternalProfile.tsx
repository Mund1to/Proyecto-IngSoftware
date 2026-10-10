import { useState, useEffect } from "react";
import { AppState, Screen } from "../App";
import ChangePasswordCard from "../components/ChangePasswordCard";
import NavBar from "../components/NavBar";
import { FileCard, ProfileAvatar, findFile } from "../components/ProfileFiles";
import ProfileSections from "../components/ProfileSections";

type Props = {
  state: AppState;
  navigate: (screen: Screen) => void;
  updateExternalProfile?: (payload: Record<string, unknown>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const tabs = [
  { id: "info", label: "Info personal" },
  { id: "experience", label: "Experiencia" },
  { id: "education", label: "Educación" },
  { id: "skills", label: "Habilidades" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function ExternalProfile({ state, navigate, updateExternalProfile, changePassword, refreshCurrentUser }: Props) {
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
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
              <div className="-mt-10 shrink-0"><ProfileAvatar token={state.token} photo={findFile(user?.archivos, "FOTO")} initials={initials || "CE"} onChanged={refreshCurrentUser} gradient="linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)" /></div>

              <div className="flex-1 min-w-0 sm:pt-3">
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

              {/* Hoja de vida */}
              <div className="sm:ml-auto sm:pt-4">
                <FileCard token={state.token} kind="cv" current={findFile(user?.archivos, "CV")} onChanged={refreshCurrentUser} />
                {user?.cvUrl && <a className="mt-2 block text-[11px] font-semibold text-blue-700 underline" href={user.cvUrl} target="_blank" rel="noreferrer">Ver hoja de vida enlazada</a>}
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
            {activeTab === "experience" && <ProfileSections token={state.token} section="experience" skillCategories={["Frontend", "Backend", "Cloud & DevOps", "Idiomas", "Blandas"]} legacyPrefix="external" profileId={profileId} />}
            {activeTab === "education" && <ProfileSections token={state.token} section="education" skillCategories={["Frontend", "Backend", "Cloud & DevOps", "Idiomas", "Blandas"]} legacyPrefix="external" profileId={profileId} />}
            {activeTab === "skills" && <ProfileSections token={state.token} section="skills" skillCategories={["Frontend", "Backend", "Cloud & DevOps", "Idiomas", "Blandas"]} legacyPrefix="external" profileId={profileId} />}
          </div>
        </div>

        <ChangePasswordCard onChange={changePassword} />
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
  const [cvUrl, setCvUrl] = useState(state.currentUser?.cvUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(state.currentUser?.nombreCompleto ?? "");
    setTelefono(state.currentUser?.telefono ?? "");
    setUbicacion(state.currentUser?.ubicacion ?? "");
    setDisponibilidad(state.currentUser?.disponibilidad ?? "");
    setResumen(state.currentUser?.resumen ?? "");
    setCvUrl(state.currentUser?.cvUrl ?? "");
  }, [state.currentUser]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaveError("");
    if (!nombre.trim()) return setSaveError("El nombre completo es obligatorio.");
    if (cvUrl.trim() && !/^https?:\/\//i.test(cvUrl.trim())) return setSaveError("El enlace de la hoja de vida debe empezar por http:// o https://.");
    setLoading(true);
    try {
      await onSave({
        nombreCompleto: nombre,
        telefono,
        ubicacion,
        disponibilidad,
        resumen,
        cvUrl: cvUrl.trim(),
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
          <label htmlFor="ext-nombre" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Nombre completo</label>
          <input id="ext-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label htmlFor="ext-email" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Correo electrónico</label>
          <input id="ext-email"
            type="text"
            value={state.currentUser?.email ?? ""}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-gray-100 text-sm text-[#64748b] cursor-not-allowed"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label htmlFor="ext-telefono" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Teléfono de contacto</label>
          <input id="ext-telefono"
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 000 0000"
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div>
          <label htmlFor="ext-ubicacion" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Ciudad de residencia / Ubicación</label>
          <input id="ext-ubicacion"
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ext-disponibilidad" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Disponibilidad</label>
          <input id="ext-disponibilidad"
            type="text"
            value={disponibilidad}
            onChange={(e) => setDisponibilidad(e.target.value)}
            placeholder="Inmediata / A convenir"
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ext-cv-url" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Enlace a tu hoja de vida (Drive, OneDrive, LinkedIn)</label>
          <input id="ext-cv-url"
            type="url"
            value={cvUrl}
            onChange={(e) => setCvUrl(e.target.value)}
            placeholder="https://"
            className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white focus:ring-3 focus:ring-[#0d2240]/8"
            style={{ outline: "none" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ext-resumen" className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Resumen / Perfil laboral (incluye tus habilidades separadas por comas)</label>
          <textarea id="ext-resumen"
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
