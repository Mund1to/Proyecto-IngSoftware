import { AppState, Application, OFFERS, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

const statusConfig = {
  Enviada: {
    bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  "En revisión": {
    bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  Aceptada: {
    bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  Rechazada: {
    bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

const logoStyle: Record<string, string> = {
  B: "linear-gradient(135deg, #0d2240 0%, #163456 100%)",
  E: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  D: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
  A: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
  R: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
  AL: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
};

const steps = ["Enviada", "En revisión", "Aceptada"] as const;

export default function StudentApplications({ state, navigate }: Props) {
  const apps = state.applications;
  const counts = {
    total: apps.length,
    active: apps.filter((a) => a.status === "Enviada" || a.status === "En revisión").length,
    accepted: apps.filter((a) => a.status === "Aceptada").length,
    rejected: apps.filter((a) => a.status === "Rechazada").length,
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="student" navigate={navigate} activeScreen="student-applications" />

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
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-white text-3xl font-bold tracking-tight mb-1">Mis Postulaciones</h1>
          <p className="text-white/50 text-sm mb-7">Seguimiento en tiempo real del estado de cada candidatura.</p>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Total", value: counts.total, color: "bg-white/10 text-white border-white/15" },
              { label: "En proceso", value: counts.active, color: "bg-amber-400/15 text-amber-300 border-amber-400/25" },
              { label: "Aceptadas", value: counts.accepted, color: "bg-green-400/15 text-green-300 border-green-400/25" },
              { label: "Rechazadas", value: counts.rejected, color: "bg-red-400/15 text-red-300 border-red-400/25" },
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
            <h3 className="text-lg font-bold text-[#0d2240] mb-2">Sin postulaciones aún</h3>
            <p className="text-[#64748b] text-sm mb-6 max-w-xs mx-auto">Explora las ofertas disponibles y postúlate a las que más te interesen.</p>
            <button
              onClick={() => navigate("student-dashboard")}
              className="px-6 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
            >
              Explorar ofertas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => {
              const offer = OFFERS.find((o) => o.id === app.offerId);
              const logo = offer?.logo ?? "?";
              const bg = logoStyle[logo] ?? "linear-gradient(135deg, #0d2240 0%, #163456 100%)";
              const cfg = statusConfig[app.status];
              const stepIndex = app.status === "Rechazada" ? 0 : steps.indexOf(app.status as (typeof steps)[number]);

              return (
                <div key={app.id} className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm overflow-hidden">
                  {/* Top strip by status */}
                  <div className={`h-1 w-full ${app.status === "Aceptada" ? "bg-[#16a34a]" : app.status === "Rechazada" ? "bg-red-400" : app.status === "En revisión" ? "bg-amber-400" : "bg-blue-400"}`} />

                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bg }}>
                        <span className="text-white font-bold text-sm">{logo}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#0d2240] text-sm leading-snug">{app.offerTitle}</h3>
                        <p className="text-[#64748b] text-sm font-medium">{app.company}</p>
                        <p className="text-[#94a3b8] text-xs mt-1">
                          Postulado el {new Date(app.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                        {cfg.icon}
                        {app.status}
                      </span>
                    </div>

                    {/* Progress tracker */}
                    {app.status !== "Rechazada" ? (
                      <div className="relative flex items-center">
                        {steps.map((step, i) => {
                          const done = i < stepIndex;
                          const current = i === stepIndex;
                          return (
                            <div key={step} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                  done ? "bg-[#0d2240] border-[#0d2240] text-white" :
                                  current ? "bg-white border-[#0d2240] text-[#0d2240]" :
                                  "bg-white border-[#e2e8f0] text-[#cbd5e1]"
                                }`}>
                                  {done ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : i + 1}
                                </div>
                                <span className={`text-[11px] mt-1.5 font-semibold whitespace-nowrap ${current ? "text-[#0d2240]" : done ? "text-[#64748b]" : "text-[#cbd5e1]"}`}>
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
                        <p className="text-xs text-red-600 font-medium leading-snug">
                          No fuiste seleccionado esta vez. ¡No te desanimes, sigue aplicando a otras ofertas!
                        </p>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#f8fafc] flex justify-end">
                      <button
                        onClick={() => navigate("offer-detail", { selectedOffer: offer ?? null })}
                        className="text-xs font-semibold text-[#0d2240]/60 hover:text-[#0d2240] flex items-center gap-1"
                      >
                        Ver oferta
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
