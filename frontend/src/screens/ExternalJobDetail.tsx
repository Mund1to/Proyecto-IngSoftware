import { useEffect, useState } from "react";
import { daysUntil, formatDate } from "../lib/offers";
import { AppState, Job, Screen } from "../App";
import NavBar from "../components/NavBar";
import { IconBriefcase, IconCalendar, IconMonitor, IconPin, IconUser } from "../components/icons";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  applyToJob: (job: Job) => Promise<void>;
};

const logoStyle: Record<string, string> = {
  B: "linear-gradient(145deg, #123b70, #4d87ff)",
  E: "linear-gradient(145deg, #123b70, #4d87ff)",
  D: "linear-gradient(145deg, #123b70, #4d87ff)",
  A: "linear-gradient(145deg, #123b70, #4d87ff)",
  R: "linear-gradient(145deg, #123b70, #4d87ff)",
  AL: "linear-gradient(145deg, #123b70, #4d87ff)",
  CL: "linear-gradient(145deg, #123b70, #4d87ff)",
  AN: "linear-gradient(145deg, #123b70, #4d87ff)",
};

const fmt = (n: number) =>
  "$" + (n >= 1000000 ? (n / 1000000).toFixed(1).replace(".0", "") + "M" : n / 1000 + "K");


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

  const bg = logoStyle[job.logo] ?? "linear-gradient(145deg, #123b70, #4d87ff)";
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
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="external" navigate={navigate} activeScreen="external-dashboard" userName={state.currentUser?.nombreCompleto ?? "Candidato"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate("external-dashboard")}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--navy)] mb-6 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a vacantes
        </button>

        {/* Hero card */}
        <div
          className="rounded-[24px] p-8 mb-6 relative overflow-hidden"
          style={{ background: "radial-gradient(circle at 85% 20%, rgba(103,176,255,.45), transparent 32%), linear-gradient(130deg, #0d2240, #123b70 45%, #155eef)" }}
        >
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />
          <div className="absolute bottom-0 right-0 w-72 h-48 opacity-15"
            style={{ background: "radial-gradient(circle at 80% 120%, rgba(103,176,255,.6) 0%, transparent 60%)" }} />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="w-20 h-20 rounded-[20px] flex items-center justify-center flex-shrink-0 shadow-xl" style={{ background: bg }}>
              <span className="text-white font-bold text-2xl">{job.logo}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[var(--sky)] text-xs font-semibold tracking-wide uppercase bg-[var(--sky)]/10 px-2.5 py-1 rounded-full">
                  {job.type}
                </span>
                {daysLeft <= 7 && daysLeft > 0 && (
                  <span className="text-red-400 text-xs font-semibold bg-red-400/10 px-2.5 py-1 rounded-full">
                    Cierra en {daysLeft} {daysLeft === 1 ? "día" : "días"}
                  </span>
                )}
              </div>
              <h1 className="display text-white text-3xl mb-1">{job.title}</h1>
              <p className="text-white/55 text-base mb-5">{job.company}</p>

              <div className="flex flex-wrap gap-2">
                {[
                  { icon: <IconPin size={16} />, label: job.city },
                  { icon: <IconMonitor size={16} />, label: job.modality },
                  { icon: <IconBriefcase size={16} />, label: job.area },
                  { icon: <IconUser size={16} />, label: job.experience },
                  { icon: <IconCalendar size={16} />, label: `Cierre: ${formatDate(job.closeDate, "sin fecha")}` },
                ].map((c) => (
                  <span key={c.label} className="flex items-center gap-1.5 text-sm text-white/70 bg-white/8 border border-white/10 px-3 py-1.5 rounded-xl">
                    <span className="flex" aria-hidden="true">{c.icon}</span>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
              <div className="text-[#86d9a7] font-bold text-xl tabular">
                {job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir"}
              </div>
              <div className="text-white/35 text-sm">{job.applicants} aplicantes</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main */}
          <div className="space-y-5">
            <div className="bg-white rounded-[20px] border border-[#d3e0f5] p-7">
              <h2 className="text-lg font-bold text-[var(--navy)] mb-4">Descripción del cargo</h2>
              <p className="text-[#475467] text-sm leading-7">{job.description}</p>
            </div>

            <div className="bg-white rounded-[20px] border border-[#d3e0f5] p-7">
              <h2 className="text-lg font-bold text-[var(--navy)] mb-5">Requisitos</h2>
              <ul className="space-y-3">
                {job.requirements.length === 0 && <li className="text-sm text-[var(--muted)]">Sin requisitos especificados.</li>}
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#475467]">
                    <div className="w-5 h-5 rounded-full bg-[#eaf7f0] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-[20px] border border-[#d3e0f5] p-7">
              <h2 className="text-lg font-bold text-[var(--navy)] mb-5">Beneficios</h2>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-sm text-[var(--success)] bg-[#eaf7f0] border border-[#b7e4c7] px-3 py-1.5 rounded-full font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {b}
                  </span>
                ))}
                {job.benefits.length === 0 && <p className="text-[var(--muted)] text-sm">No se especificaron beneficios para esta oferta.</p>}
              </div>
            </div>

            <div className="bg-white rounded-[20px] border border-[#d3e0f5] p-7">
              <h2 className="text-lg font-bold text-[var(--navy)] mb-4">Sobre la empresa</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm" style={{ background: bg }}>
                  <span className="text-white font-bold text-xl">{job.logo}</span>
                </div>
                <div>
                  <div className="font-bold text-[var(--navy)]">{job.company}</div>
                  <div className="text-[var(--muted)] text-sm">{job.city}</div>
                </div>
              </div>
              <p className="text-[#475467] text-sm leading-relaxed">Oferta publicada por {job.company} en SIPU.</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] border border-[#d3e0f5] p-6 sticky top-[76px]">
              <h3 className="font-bold text-[var(--navy)] mb-1">¿Listo para aplicar?</h3>
              <p className="text-[var(--muted)] text-xs mb-5 leading-relaxed">
                Asegúrate de tener tu hoja de vida actualizada. Tu perfil será enviado directamente a la empresa.
              </p>

              {applied ? (
                <div className="bg-[#eaf7f0] border border-[#b7e4c7] rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-[var(--success)] font-bold text-sm">Aplicación enviada</div>
                  <div className="text-[var(--muted)] text-xs mt-0.5">Te contactarán si quedas preseleccionado</div>
                </div>
              ) : (
                <button
                  onClick={() => void handleApply()}
                  disabled={applying || daysLeft < 0}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-bold shadow-lg shadow-green-900/20 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #155eef, #3478ff)", transition: "opacity 0.15s, transform 0.1s" }}
                >
                  {applying ? "Enviando..." : daysLeft < 0 ? "Oferta cerrada" : job.type === "Formación" ? "Inscribirme" : "Aplicar ahora"}
                </button>
              )}
              {applyError && <div className="form-error mt-3" role="alert">{applyError}</div>}

              <button
                onClick={() => navigate("external-profile")}
                className="w-full mt-3 py-3 rounded-xl border border-[#d3e0f5] text-sm font-medium text-[var(--muted)] hover:bg-[var(--selection)] hover:border-[#97b4ea]"
              >
                Ver mi perfil
              </button>

              <div className="mt-5 pt-5 border-t border-[#e3eaf5] space-y-3">
                {[
                  { label: "Tipo de oferta", value: job.type },
                  { label: "Modalidad", value: job.modality },
                  { label: "Duración", value: job.experience },
                  { label: "Salario", value: job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir" },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-[var(--muted)]">{s.label}</span>
                    <span className="text-[var(--text)] font-semibold text-right max-w-[140px]">{s.value}</span>
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
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200"
              style={{ background: "linear-gradient(135deg, #155eef, #3478ff)" }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[var(--navy)] mb-2">¡Aplicación enviada!</h3>
            <p className="text-[var(--muted)] text-sm mb-7 leading-relaxed">
              Tu aplicación a <span className="font-semibold text-[var(--navy)]">{job.company}</span> fue enviada. El equipo de RRHH revisará tu perfil y te contactará si quedas preseleccionado.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-[#d3e0f5] text-sm font-semibold text-[var(--muted)] hover:bg-[var(--selection)]">
                Cerrar
              </button>
              <button
                onClick={() => { setShowModal(false); navigate("external-applications"); }}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90"
                style={{ background: "linear-gradient(145deg, #123b70, #4d87ff)" }}
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
