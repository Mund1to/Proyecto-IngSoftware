import { useEffect, useState } from "react";
import { daysUntil, formatDate } from "../lib/offers";
import { AppState, Job, Screen } from "../App";
import NavBar from "../components/NavBar";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  applyToJob: (job: Job) => Promise<void>;
};

const logoStyle: Record<string, string> = {
  B: "linear-gradient(135deg, #0d2240 0%, #163456 100%)",
  E: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  D: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
  A: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
  R: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
  AL: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
  CL: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
  AN: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
};

const fmt = (n: number) =>
  "$" + (n >= 1000000 ? (n / 1000000).toFixed(1).replace(".0", "") + "M" : n / 1000 + "K");

const modalityIcon: Record<string, string> = { Presencial: "🏢", Remota: "💻", Híbrida: "🔄" };

export default function ExternalJobDetail({ state, navigate, applyToJob }: Props) {
  const job = state.selectedJob;
  const [applied, setApplied] = useState(
    job ? state.jobApplications.some((a) => a.jobId === job.id) : false
  );
  const [showModal, setShowModal] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applying, setApplying] = useState(false);

  // Navegar durante el render provoca advertencias de React; se hace en un efecto.
  useEffect(() => {
    if (!job) navigate("external-dashboard");
  }, [job, navigate]);

  if (!job) return null;

  const bg = logoStyle[job.logo] ?? "linear-gradient(135deg, #0d2240 0%, #163456 100%)";
  const daysLeft = daysUntil(job.closeDate);

  const handleApply = async () => {
    setApplying(true);
    setApplyError("");
    try {
      await applyToJob(job);
      setApplied(true);
      setShowModal(true);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "No se pudo enviar la postulación.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="external" navigate={navigate} activeScreen="external-dashboard" userName={state.currentUser?.nombreCompleto ?? "Candidato"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate("external-dashboard")}
          className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#0d2240] mb-6 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a vacantes
        </button>

        {/* Hero card */}
        <div
          className="rounded-3xl p-8 mb-6 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #081626 0%, #0d2240 60%, #122f5c 100%)" }}
        >
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />
          <div className="absolute bottom-0 right-0 w-72 h-48 opacity-15"
            style={{ background: "radial-gradient(circle at 80% 120%, #3b82f6 0%, transparent 60%)" }} />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl" style={{ background: bg }}>
              <span className="text-white font-bold text-2xl">{job.logo}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[#60a5fa] text-xs font-semibold tracking-wide uppercase bg-[#60a5fa]/10 px-2.5 py-1 rounded-full">
                  {job.type}
                </span>
                {daysLeft <= 7 && daysLeft > 0 && (
                  <span className="text-red-400 text-xs font-semibold bg-red-400/10 px-2.5 py-1 rounded-full">
                    ⚠ Cierra en {daysLeft}d
                  </span>
                )}
              </div>
              <h1 className="text-white text-2xl font-bold mb-1 tracking-tight">{job.title}</h1>
              <p className="text-white/55 text-base mb-5">{job.company}</p>

              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "📍", label: job.city },
                  { icon: modalityIcon[job.modality] ?? "🔄", label: job.modality },
                  { icon: "📁", label: job.area },
                  { icon: "🎯", label: job.experience },
                  { icon: "📅", label: `Cierre: ${formatDate(job.closeDate, "sin fecha")}` },
                ].map((c) => (
                  <span key={c.label} className="flex items-center gap-1.5 text-sm text-white/70 bg-white/8 border border-white/10 px-3 py-1.5 rounded-xl">
                    <span className="text-base leading-none">{c.icon}</span>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
              <div className="text-[#4ade80] font-bold text-xl tabular">
                {job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir"}
              </div>
              <div className="text-white/35 text-sm">{job.applicants} aplicantes</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#e8eef4] p-7">
              <h2 className="text-lg font-bold text-[#0d2240] mb-4">Descripción del cargo</h2>
              <p className="text-[#475569] text-sm leading-7">{job.description}</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#e8eef4] p-7">
              <h2 className="text-lg font-bold text-[#0d2240] mb-5">Requisitos</h2>
              <ul className="space-y-3">
                {job.requirements.length === 0 && <li className="text-sm text-[#64748b]">Sin requisitos especificados.</li>}
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#475569]">
                    <div className="w-5 h-5 rounded-full bg-[#dcfce7] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-[#e8eef4] p-7">
              <h2 className="text-lg font-bold text-[#0d2240] mb-5">Beneficios</h2>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-sm text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1.5 rounded-full font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {b}
                  </span>
                ))}
                {job.benefits.length === 0 && <p className="text-[#64748b] text-sm">No se especificaron beneficios para esta oferta.</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e8eef4] p-7">
              <h2 className="text-lg font-bold text-[#0d2240] mb-4">Sobre la empresa</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm" style={{ background: bg }}>
                  <span className="text-white font-bold text-xl">{job.logo}</span>
                </div>
                <div>
                  <div className="font-bold text-[#0d2240]">{job.company}</div>
                  <div className="text-[#64748b] text-sm">{job.city}</div>
                </div>
              </div>
              <p className="text-[#475569] text-sm leading-relaxed">Oferta publicada por {job.company} en SIPU.</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#e8eef4] p-6 sticky top-[76px]">
              <h3 className="font-bold text-[#0d2240] mb-1">¿Listo para aplicar?</h3>
              <p className="text-[#64748b] text-xs mb-5 leading-relaxed">
                Asegúrate de tener tu hoja de vida actualizada. Tu perfil será enviado directamente a la empresa.
              </p>

              {applied ? (
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-[#16a34a] rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-[#16a34a] font-bold text-sm">Aplicación enviada</div>
                  <div className="text-[#64748b] text-xs mt-0.5">Te contactarán si quedas preseleccionado</div>
                </div>
              ) : (
                <button
                  onClick={() => void handleApply()}
                  disabled={applying || daysLeft < 0}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-bold shadow-lg shadow-green-900/20 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", transition: "opacity 0.15s, transform 0.1s" }}
                >
                  {applying ? "Enviando..." : daysLeft < 0 ? "Oferta cerrada" : job.type === "Formación" ? "Inscribirme" : "Aplicar ahora"}
                </button>
              )}
              {applyError && <div className="form-error mt-3" role="alert">{applyError}</div>}

              <button
                onClick={() => navigate("external-profile")}
                className="w-full mt-3 py-3 rounded-xl border border-[#e2e8f0] text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] hover:border-[#94a3b8]"
              >
                Ver mi perfil
              </button>

              <div className="mt-5 pt-5 border-t border-[#f1f5f9] space-y-3">
                {[
                  { label: "Tipo de oferta", value: job.type },
                  { label: "Modalidad", value: job.modality },
                  { label: "Duración", value: job.experience },
                  { label: "Salario", value: job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir" },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">{s.label}</span>
                    <span className="text-[#1e293b] font-semibold text-right max-w-[140px]">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200"
              style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#0d2240] mb-2">¡Aplicación enviada!</h3>
            <p className="text-[#64748b] text-sm mb-7 leading-relaxed">
              Tu aplicación a <span className="font-semibold text-[#0d2240]">{job.company}</span> fue enviada. El equipo de RRHH revisará tu perfil y te contactará si quedas preseleccionado.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-[#f8fafc]">
                Cerrar
              </button>
              <button
                onClick={() => { setShowModal(false); navigate("external-applications"); }}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
              >
                Mis aplicaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
