import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import { api } from "../lib/api";
import { mapOfferToJob } from "./ExternalDashboard";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import { IconCheck } from "../components/icons";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  reloadApplications: () => Promise<void>;
  withdrawApplication: (applicationId: number) => Promise<void>;
};

const statusConfig = {
  Enviada: { bg: "bg-[var(--selection)]", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]", label: "Enviada" },
  "En revisión": { bg: "bg-[#fff4df]", text: "text-[var(--warning)]", dot: "bg-[var(--warning)]", label: "En revisión" },
  Entrevista: { bg: "bg-[var(--selection)]", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]", label: "Entrevista" },
  Aceptada: { bg: "bg-[#eaf7f0]", text: "text-[var(--success)]", dot: "bg-[var(--success)]", label: "Aceptada" },
  Rechazada: { bg: "bg-[#fef3f2]", text: "text-[var(--danger)]", dot: "bg-[var(--danger)]", label: "Rechazada" },
  Retirada: { bg: "bg-[#f2f6fc]", text: "text-[#475467]", dot: "bg-[#97b4ea]", label: "Retirada" },
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

// 5-step pipeline for professional jobs
const steps = ["Enviada", "En revisión", "Entrevista", "Aceptada"] as const;

export default function ExternalApplications({ state, navigate, reloadApplications, withdrawApplication }: Props) {
  const apps = state.jobApplications;
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    void reloadApplications();
  }, [reloadApplications]);

  const openJob = async (jobId: number) => {
    setError("");
    try {
      const response = await api.getOffer(jobId);
      navigate("external-job-detail", { selectedJob: mapOfferToJob(response.offer) });
    } catch {
      setError("Esta vacante ya no está publicada, por eso no se puede abrir su detalle.");
    }
  };

  const withdraw = async (applicationId: number) => {
    if (!window.confirm("¿Retirar esta postulación? La empresa dejará de considerarla.")) return;
    setBusyId(applicationId);
    setError("");
    try {
      await withdrawApplication(applicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo retirar la postulación.");
    } finally {
      setBusyId(null);
    }
  };
  const counts = {
    total: apps.length,
    active: apps.filter((a) => ["Enviada", "En revisión", "Entrevista"].includes(a.status)).length,
    interview: apps.filter((a) => a.status === "Entrevista").length,
    accepted: apps.filter((a) => a.status === "Aceptada").length,
    rejected: apps.filter((a) => a.status === "Rechazada").length,
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="external" navigate={navigate} activeScreen="external-applications" userName={state.currentUser?.nombreCompleto ?? "Candidato"} />

      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "radial-gradient(circle at 78% 30%, rgba(103,176,255,.45), transparent 30%), linear-gradient(130deg, #0d2240, #123b70 40%, #155eef 85%, #3978f4)" }}
      >
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        <div className="absolute right-0 bottom-0 w-80 h-48 opacity-10"
          style={{ background: "radial-gradient(circle at 80% 120%, rgba(103,176,255,.6) 0%, transparent 60%)" }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="display text-white text-4xl mb-1">Mis Aplicaciones</h1>
          <p className="text-white/50 text-sm mb-7">Seguimiento del proceso de selección para cada vacante.</p>

          <div className="flex flex-wrap gap-3">
            {[
              { label: "Total", value: counts.total, color: "bg-white/10 text-white border-white/15" },
              { label: "En proceso", value: counts.active, color: "bg-blue-400/15 text-blue-300 border-blue-400/25" },
              { label: "En entrevista", value: counts.interview, color: "bg-violet-400/15 text-violet-300 border-violet-400/25" },
              { label: "Aceptadas", value: counts.accepted, color: "bg-green-400/15 text-green-300 border-green-400/25" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${s.color}`}>
                <span className="text-lg font-bold tabular">{s.value}</span>
                <span className="opacity-70 font-normal">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="form-error mb-5" role="alert">{error}</div>}
        {apps.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-[#d3e0f5] text-center py-20 shadow-sm">
            <ArdyMark className="empty-squirrel mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--navy)] mb-2">Sin aplicaciones aún</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">Explora las vacantes disponibles y aplica a las que más encajen con tu perfil.</p>
            <button
              onClick={() => navigate("external-dashboard")}
              className="px-6 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90"
              style={{ background: "linear-gradient(145deg, #123b70, #4d87ff)" }}
            >
              Explorar vacantes
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => {
              const logo = app.company.slice(0, 2).toUpperCase();
              const bg = logoStyle[logo] ?? "linear-gradient(145deg, #123b70, #4d87ff)";
              const cfg = statusConfig[app.status];
              const stepIndex = app.status === "Rechazada" || app.status === "Retirada" ? 0 : steps.indexOf(app.status as (typeof steps)[number]);

              return (
                <div key={app.id} className="bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${
                    app.status === "Aceptada" ? "bg-[var(--success)]" :
                    app.status === "Rechazada" ? "bg-[var(--danger)]" :
                    app.status === "Entrevista" ? "bg-[var(--primary)]" :
                    app.status === "En revisión" ? "bg-[var(--warning)]" : "bg-[var(--primary)]"
                  }`} />

                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bg }}>
                        <span className="text-white font-bold text-sm">{logo}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--navy)] text-sm leading-snug">{app.jobTitle}</h3>
                        <p className="text-[var(--muted)] text-sm font-medium">{app.company}</p>
                        <p className="text-[var(--muted)] text-xs mt-1">
                          Aplicado el {new Date(app.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {app.status === "Retirada" ? (
                      <p className="text-xs text-[var(--muted)] p-3.5 bg-[#f2f6fc] border border-[#e3eaf5] rounded-xl">Retiraste esta postulación.</p>
                    ) : app.status !== "Rechazada" ? (
                      <div className="relative flex items-center">
                        {steps.map((step, i) => {
                          const done = i < stepIndex;
                          const current = i === stepIndex;
                          const stepColors: Record<string, string> = {
                            Entrevista: "bg-[var(--primary)] border-[var(--primary)]",
                            Aceptada: "bg-[var(--success)] border-[var(--success)]",
                          };
                          const doneColor = stepColors[step] ?? "bg-[var(--primary)] border-[var(--primary)]";

                          return (
                            <div key={step} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                  done ? `${doneColor} text-white` :
                                  current ? "bg-white border-[var(--primary)] text-[var(--navy)]" :
                                  "bg-white border-[#d3e0f5] text-[#98a2b3]"
                                }`}>
                                  {done ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : i + 1}
                                </div>
                                <span className={`text-[10px] mt-1.5 font-semibold whitespace-nowrap ${current ? "text-[var(--navy)]" : done ? "text-[var(--muted)]" : "text-[#98a2b3]"}`}>
                                  {step}
                                </span>
                              </div>
                              {i < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full ${i < stepIndex ? "bg-[var(--primary)]" : "bg-[#e6eefc]"}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3.5 bg-[#fef3f2] border border-[#fecdca] rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-[#fef3f2] flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-xs text-[var(--danger)] font-medium">No fuiste seleccionado esta vez. ¡Sigue aplicando, hay muchas vacantes disponibles!</p>
                      </div>
                    )}

                    {app.status === "Entrevista" && (
                      <div className="mt-4 p-3.5 bg-[var(--selection)] border border-[#cfe0ff] rounded-xl flex items-center gap-3">
                        <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full bg-[var(--primary)] text-white" aria-hidden="true"><IconCheck size={18} /></span>
                        <div>
                          <p className="text-sm font-bold text-[var(--primary)]">¡Pasaste a la etapa de entrevista!</p>
                          <p className="text-xs text-[var(--primary)] mt-0.5">El equipo de RRHH se pondrá en contacto contigo pronto para coordinar los detalles.</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#e3eaf5] flex justify-end gap-4">
                      {(app.status === "Enviada" || app.status === "En revisión") && (
                        <button
                          onClick={() => void withdraw(app.id)}
                          disabled={busyId === app.id}
                          className="text-xs font-semibold text-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
                        >
                          {busyId === app.id ? "Retirando..." : "Retirar postulación"}
                        </button>
                      )}
                      <button
                        onClick={() => void openJob(app.jobId)}
                        className="text-xs font-semibold text-[var(--navy)]/60 hover:text-[var(--navy)] flex items-center gap-1"
                      >
                        Ver vacante
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
