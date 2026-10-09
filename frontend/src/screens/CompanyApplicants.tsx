import { useEffect, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api } from "../lib/api";
import { formatDate } from "../lib/offers";
import { toUiOffer } from "./StudentDashboard";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  updateCandidateStatus: (id: number, status: "Aceptada" | "Rechazada") => Promise<void>;
};

const statusConfig = {
  "En revisión": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  Aceptada: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  Rechazada: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-400" },
  Retirada: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
};

const avatarGradients = [
  "linear-gradient(135deg, #0d2240 0%, #163456 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
  "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
  "linear-gradient(135deg, #0f766e 0%, #0d6b63 100%)",
];

const mapStatus = (status?: string): Candidate["status"] => {
  switch (status) {
    case "RETIRADA":
      return "Retirada";
    case "ACEPTADA":
      return "Aceptada";
    case "RECHAZADA":
      return "Rechazada";
    default:
      return "En revisión";
  }
};

type Candidate = { id: number; name: string; career: string; semester: string; university: string; email: string; phone: string; summary: string; cvUrl: string; city: string; appliedDate: string; status: "En revisión" | "Aceptada" | "Rechazada" | "Retirada"; skills: string[] };

export default function CompanyApplicants({ state, navigate, updateCandidateStatus }: Props) {
  const offer = state.selectedCompanyOffer;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [filter, setFilter] = useState<"Todos" | "En revisión" | "Aceptada" | "Rechazada">(state.applicantFilter ?? "Todos");
  const [actionError, setActionError] = useState("");
  const [myOffers, setMyOffers] = useState<Offer[] | null>(null);

  // Sin oferta seleccionada (entrada desde el menú) se listan las ofertas propias.
  useEffect(() => {
    if (offer || !state.token) return;
    api.getMyOffers(state.token)
      .then((response) => setMyOffers((response.offers ?? []).map(toUiOffer)))
      .catch((error) => {
        setMyOffers([]);
        setActionError(error instanceof Error ? error.message : "No se pudieron cargar tus ofertas.");
      });
  }, [offer, state.token]);

  useEffect(() => {
    if (!offer || !state.token) return;

    api.getApplicationsForOffer(String(offer.id), state.token)
      .then((response) => {
        const mapped = (response.applications ?? []).map((item) => ({
          id: Number(item.id),
          name: item.postulante_nombre ?? item.nombre ?? "Candidato",
          career: item.programa_academico ?? (item.perfil_tipo === "ESTUDIANTE" ? "Estudiante" : "Candidato externo"),
          semester: item.semestre ? String(item.semestre) : "No reportado",
          university: item.universidad ?? "No reportada",
          email: item.postulante_email ?? "No reportado",
          phone: item.postulante_telefono ?? "No reportado",
          summary: item.resumen ?? "",
          cvUrl: item.cv_url ?? "",
          city: item.candidato_ubicacion ?? "No reportada",
          appliedDate: (item.created_at ?? new Date().toISOString()).slice(0, 10),
          status: mapStatus(item.estado),
          skills: [],
        }));
        setCandidates(mapped);
      })
      .catch((error) => {
        setCandidates([]);
        setActionError(error instanceof Error ? error.message : "No se pudieron cargar las postulaciones.");
      });
  }, [offer, state.token]);

  const changeCandidateStatus = async (id: number, status: "Aceptada" | "Rechazada") => {
    setActionError("");
    try {
      await updateCandidateStatus(id, status);
      setCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, status } : candidate));
      setSelected((current) => current?.id === id ? { ...current, status } : current);
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
      return false;
    }
  };

  const filtered = candidates.filter((c) => filter === "Todos" || c.status === filter);
  const counts = {
    pending: candidates.filter((c) => c.status === "En revisión").length,
    accepted: candidates.filter((c) => c.status === "Aceptada").length,
    rejected: candidates.filter((c) => c.status === "Rechazada").length,
  };

  if (!offer) return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="company" navigate={navigate} activeScreen="company-applicants" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2240] mb-1">Postulantes</h1>
        <p className="text-[#64748b] text-sm mb-6">Elige una oferta para revisar sus candidatos.</p>
        {actionError && <div className="form-error mb-5" role="alert">{actionError}</div>}
        {myOffers === null ? (
          <p className="text-sm text-[#64748b]">Cargando ofertas...</p>
        ) : myOffers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16">
            <p className="text-[#64748b] text-sm mb-4">Aún no has publicado ofertas.</p>
            <button className="button primary" onClick={() => navigate("company-dashboard")}>Crear una oferta</button>
          </div>
        ) : (
          <div className="space-y-3">
            {myOffers.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate("company-applicants", { selectedCompanyOffer: item, applicantFilter: "Todos" })}
                className="w-full text-left bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-5 hover:border-[#94a3b8] flex items-center justify-between gap-4"
              >
                <span>
                  <strong className="block text-[#0d2240]">{item.title}</strong>
                  <small className="text-[#64748b]">{item.city} · {item.modality} · Cierra {formatDate(item.closeDate, "sin fecha")}</small>
                </span>
                <span className="text-sm font-semibold text-[#0d2240]">Ver postulantes →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="company" navigate={navigate} activeScreen="company-applicants" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />

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
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <button
            onClick={() => navigate("company-applicants", { selectedCompanyOffer: null })}
            className="flex items-center gap-1.5 text-white/45 hover:text-white/80 text-sm font-medium mb-5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Mis ofertas
          </button>

          <h1 className="text-white text-2xl font-bold tracking-tight mb-1">
            {offer?.title ?? "Postulantes"}
          </h1>
          <p className="text-white/45 text-sm mb-7">{candidates.length} candidatos para esta oferta</p>

          <div className="flex flex-wrap gap-3">
            {[
              { label: "Pendientes", value: counts.pending, color: "bg-amber-400/15 text-amber-300 border-amber-400/25" },
              { label: "Aceptados", value: counts.accepted, color: "bg-green-400/15 text-green-300 border-green-400/25" },
              { label: "Rechazados", value: counts.rejected, color: "bg-red-400/15 text-red-300 border-red-400/25" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${s.color}`}>
                <span className="text-lg font-bold tabular">{s.value}</span>
                <span className="opacity-70 font-normal">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {actionError && <div className="form-error mb-5" role="alert">{actionError}</div>}
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["Todos", "En revisión", "Aceptada", "Rechazada"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === f
                  ? "bg-[#0d2240] text-white shadow-md"
                  : "bg-white text-[#64748b] border border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {f}
              {f !== "Todos" && (
                <span className={`ml-1.5 text-xs ${filter === f ? "opacity-70" : "text-[#94a3b8]"}`}>
                  ({f === "En revisión" ? counts.pending : f === "Aceptada" ? counts.accepted : counts.rejected})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((candidate, i) => {
            const cfg = statusConfig[candidate.status];
            const initials = candidate.name.split(" ").slice(0, 2).map((n) => n[0]).join("");
            const bg = avatarGradients[i % avatarGradients.length];

            return (
              <div key={candidate.id} className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm overflow-hidden">
                {/* Status strip */}
                <div className={`h-1 ${candidate.status === "Aceptada" ? "bg-[#16a34a]" : candidate.status === "Rechazada" ? "bg-red-400" : candidate.status === "Retirada" ? "bg-slate-300" : "bg-amber-400"}`} />

                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: bg }}
                    >
                      <span className="text-white font-bold text-base">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-[#0d2240] text-sm leading-snug">{candidate.name}</h3>
                          <p className="text-[#64748b] text-xs mt-0.5 font-medium">{candidate.career}{candidate.semester !== "No reportado" ? ` · ${candidate.semester}° semestre` : ""}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full font-bold border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {candidate.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[#94a3b8]">
                        <span>📍 {candidate.city}</span>
                        <span>{candidate.university}</span>
                        <span>{new Date(candidate.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  {candidate.skills.length > 0 && <div className="flex flex-wrap gap-1.5 mb-5">
                    {candidate.skills.map((s) => (
                      <span key={s} className="text-[11px] px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg font-semibold">{s}</span>
                    ))}
                  </div>}

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-4 border-t border-[#f8fafc]">
                    <button
                      onClick={() => setSelected(candidate)}
                      className="flex-1 py-2.5 text-sm font-semibold text-[#0d2240] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] hover:border-[#94a3b8] flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Ver perfil
                    </button>
                    {candidate.status === "En revisión" ? (
                      <>
                        <button
                          onClick={() => void changeCandidateStatus(candidate.id, "Aceptada")}
                          className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 flex items-center justify-center gap-1"
                          style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Aceptar
                        </button>
                        <button
                          onClick={() => void changeCandidateStatus(candidate.id, "Rechazada")}
                          className="px-3.5 py-2.5 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : candidate.status === "Aceptada" ? (
                      <div className="flex-1 py-2.5 text-center text-sm font-bold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
                        ✓ Aceptado
                      </div>
                    ) : candidate.status === "Retirada" ? (
                      <div className="flex-1 py-2.5 text-center text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl">
                        Retirada por el candidato
                      </div>
                    ) : (
                      <div className="flex-1 py-2.5 text-center text-sm font-semibold text-red-400 bg-red-50 border border-red-100 rounded-xl">
                        No seleccionado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16">
            <div className="w-12 h-12 bg-[#f1f5f9] rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-[#64748b] text-sm font-medium">Sin candidatos con este filtro</p>
          </div>
        )}
      </div>

      {/* CV Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#f1f5f9]">
              <h3 className="font-bold text-[#0d2240]">Perfil del candidato</h3>
              <button aria-label="Cerrar perfil" onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-[#f1f5f9] flex items-center justify-center text-[#64748b] hover:bg-[#e2e8f0]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Candidate header */}
              <div className="flex items-center gap-4 p-4 bg-[#f8fafc] rounded-2xl mb-5 border border-[#e8eef4]">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{ background: avatarGradients[0] }}
                >
                  <span className="text-white font-bold text-base">
                    {selected.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-[#0d2240]">{selected.name}</h4>
                  <p className="text-[#64748b] text-sm">{selected.career}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#94a3b8]">
                    <span>📍 {selected.city}</span>
                    <span>·</span>
                    <span>{selected.university}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <Section title="Formación">
                  <p className="text-sm font-semibold text-[#1e293b]">{selected.career}</p>
                  <p className="text-sm text-[#64748b]">Semestre: {selected.semester}</p>
                </Section>

                {selected.summary && <Section title="Resumen profesional"><p className="text-sm text-[#475569]">{selected.summary}</p></Section>}

                <Section title="Contacto">
                  <p className="text-sm text-[#1e293b]">Correo: {selected.email}</p>
                  <p className="text-sm text-[#64748b]">Teléfono: {selected.phone}</p>
                </Section>

                <Section title="Habilidades técnicas">
                  <div className="flex flex-wrap gap-1.5">
                    {selected.skills.length > 0 ? selected.skills.map((s) => (
                      <span key={s} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full font-semibold">{s}</span>
                    )) : <p className="text-sm text-[#64748b]">No se registraron habilidades en este perfil.</p>}
                  </div>
                </Section>

                <Section title="Fecha de postulación">
                  <p className="text-sm text-[#1e293b]">
                    {new Date(selected.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </Section>

                {selected.cvUrl ? <a className="text-sm font-semibold text-blue-700 underline" href={selected.cvUrl} target="_blank" rel="noreferrer">Abrir hoja de vida</a> : <p className="text-sm text-[#64748b]">No hay una hoja de vida adjunta a esta postulación.</p>}
              </div>

              {selected.status === "En revisión" && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => void changeCandidateStatus(selected.id, "Rechazada").then((updated) => { if (updated) setSelected(null); })}
                    className="flex-1 py-3 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => void changeCandidateStatus(selected.id, "Aceptada").then((updated) => { if (updated) setSelected(null); })}
                    className="flex-1 py-3 text-sm font-bold text-white rounded-xl hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
                  >
                    Aceptar candidato
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2">{title}</h5>
      {children}
    </div>
  );
}
