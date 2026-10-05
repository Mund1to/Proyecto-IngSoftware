import { AppState, JOBS, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

const statusConfig = {
  Enviada: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Enviada" },
  "En revisión": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400", label: "En revisión" },
  Entrevista: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500", label: "Entrevista" },
  Aceptada: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Aceptada" },
  Rechazada: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400", label: "Rechazada" },
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

// 5-step pipeline for professional jobs
const steps = ["Enviada", "En revisión", "Entrevista", "Aceptada"] as const;

export default function ExternalApplications({ state, navigate }: Props) {
  const apps = state.jobApplications;
  const counts = {
    total: apps.length,
    active: apps.filter((a) => ["Enviada", "En revisión", "Entrevista"].includes(a.status)).length,
    interview: apps.filter((a) => a.status === "Entrevista").length,
    accepted: apps.filter((a) => a.status === "Aceptada").length,
    rejected: apps.filter((a) => a.status === "Rechazada").length,
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="external" navigate={navigate} activeScreen="external-applications" />

      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #081626 0%, #0d2240 55%, #122f5c 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        <div className="absolute right-0 bottom-0 w-80 h-48 opacity-10"
          style={{ background: "radial-gradient(circle at 80% 120%, #3b82f6 0%, transparent 60%)" }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-white text-3xl font-bold tracking-tight mb-1">Mis Aplicaciones</h1>
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
        {apps.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e8eef4] text-center py-20 shadow-sm">
            <ArdyMark className="empty-squirrel mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#0d2240] mb-2">Sin aplicaciones aún</h3>
            <p className="text-[#64748b] text-sm mb-6 max-w-xs mx-auto">Explora las vacantes disponibles y aplica a las que más encajen con tu perfil.</p>
            <button
              onClick={() => navigate("external-dashboard")}
              className="px-6 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
            >
              Explorar vacantes
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => {
              const job = JOBS.find((j) => j.id === app.jobId);
              const logo = job?.logo ?? "?";
              const bg = logoStyle[logo] ?? "linear-gradient(135deg, #0d2240 0%, #163456 100%)";
              const cfg = statusConfig[app.status];
              const stepIndex = app.status === "Rechazada" ? 0 : steps.indexOf(app.status as (typeof steps)[number]);

              return (
                <div key={app.id} className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${
                    app.status === "Aceptada" ? "bg-[#16a34a]" :
                    app.status === "Rechazada" ? "bg-red-400" :
                    app.status === "Entrevista" ? "bg-violet-500" :
                    app.status === "En revisión" ? "bg-amber-400" : "bg-blue-400"
                  }`} />

                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bg }}>
                        <span className="text-white font-bold text-sm">{logo}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#0d2240] text-sm leading-snug">{app.jobTitle}</h3>
                        <p className="text-[#64748b] text-sm font-medium">{app.company}</p>
                        <p className="text-[#94a3b8] text-xs mt-1">
                          Aplicado el {new Date(app.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {app.status !== "Rechazada" ? (
                      <div className="relative flex items-center">
                        {steps.map((step, i) => {
                          const done = i < stepIndex;
                          const current = i === stepIndex;
                          const stepColors: Record<string, string> = {
                            Entrevista: "bg-violet-500 border-violet-500",
                            Aceptada: "bg-[#16a34a] border-[#16a34a]",
                          };
                          const doneColor = stepColors[step] ?? "bg-[#0d2240] border-[#0d2240]";

                          return (
                            <div key={step} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                  done ? `${doneColor} text-white` :
                                  current ? "bg-white border-[#0d2240] text-[#0d2240]" :
                                  "bg-white border-[#e2e8f0] text-[#cbd5e1]"
                                }`}>
                                  {done ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : i + 1}
                                </div>
                                <span className={`text-[10px] mt-1.5 font-semibold whitespace-nowrap ${current ? "text-[#0d2240]" : done ? "text-[#64748b]" : "text-[#cbd5e1]"}`}>
                                  {step}
                                </span>
                              </div>
                              {i < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full ${i < stepIndex ? "bg-[#0d2240]" : "bg-[#e2e8f0]"}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-xs text-red-600 font-medium">No fuiste seleccionado esta vez. ¡Sigue aplicando, hay muchas vacantes disponibles!</p>
                      </div>
                    )}

                    {app.status === "Entrevista" && (
                      <div className="mt-4 p-3.5 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3">
                        <span className="text-xl">🎉</span>
                        <div>
                          <p className="text-sm font-bold text-violet-700">¡Pasaste a la etapa de entrevista!</p>
                          <p className="text-xs text-violet-600 mt-0.5">El equipo de RRHH se pondrá en contacto contigo pronto para coordinar los detalles.</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#f8fafc] flex justify-end">
                      <button
                        onClick={() => navigate("external-job-detail", { selectedJob: job ?? null })}
                        className="text-xs font-semibold text-[#0d2240]/60 hover:text-[#0d2240] flex items-center gap-1"
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
