import { useEffect, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import { IconPin } from "../components/icons";
import { api } from "../lib/api";
import { formatDate } from "../lib/offers";
import { toUiOffer } from "./StudentDashboard";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  updateCandidateStatus: (id: number, status: "Aceptada" | "Rechazada") => Promise<void>;
};

const statusConfig = {
  "En revisión": { bg: "bg-[#fff4df]", text: "text-[var(--warning)]", border: "border-[#f5d9a8]", dot: "bg-[var(--warning)]" },
  Aceptada: { bg: "bg-[#eaf7f0]", text: "text-[var(--success)]", border: "border-[#b7e4c7]", dot: "bg-[var(--success)]" },
  Rechazada: { bg: "bg-[#fef3f2]", text: "text-[var(--danger)]", border: "border-[#fecdca]", dot: "bg-[var(--danger)]" },
  Retirada: { bg: "bg-[#f2f6fc]", text: "text-[#475467]", border: "border-[#e3eaf5]", dot: "bg-[#97b4ea]" },
};

const avatarGradients = [
  "linear-gradient(145deg, #123b70, #4d87ff)",
  "linear-gradient(145deg, #123b70, #4d87ff)",
  "linear-gradient(145deg, #123b70, #4d87ff)",
  "linear-gradient(145deg, #123b70, #4d87ff)",
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

type Candidate = { id: number; name: string; career: string; semester: string; university: string; email: string; phone: string; summary: string; cvUrl: string; hasCv: boolean; education: { titulo: string; institucion: string; periodo: string }[]; experience: { cargo: string; empresa: string; periodo: string; descripcion?: string | null }[]; city: string; appliedDate: string; status: "En revisión" | "Aceptada" | "Rechazada" | "Retirada"; skills: string[] };

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
          hasCv: Boolean(item.tiene_cv),
          education: Array.isArray(item.educacion) ? item.educacion : [],
          experience: Array.isArray(item.experiencia) ? item.experiencia : [],
          city: item.candidato_ubicacion ?? "No reportada",
          appliedDate: (item.created_at ?? new Date().toISOString()).slice(0, 10),
          status: mapStatus(item.estado),
          skills: Array.isArray(item.habilidades) ? item.habilidades : [],
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
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="company" navigate={navigate} activeScreen="company-applicants" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="display text-3xl text-[var(--navy)] mb-1">Postulantes</h1>
        <p className="text-[var(--muted)] text-sm mb-6">Elige una oferta para revisar sus candidatos.</p>
        {actionError && <div className="form-error mb-5" role="alert">{actionError}</div>}
        {myOffers === null ? (
          <p className="text-sm text-[var(--muted)]">Cargando ofertas...</p>
        ) : myOffers.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16">
            <p className="text-[var(--muted)] text-sm mb-4">Aún no has publicado ofertas.</p>
            <button className="button primary" onClick={() => navigate("company-dashboard")}>Crear una oferta</button>
          </div>
        ) : (
          <div className="space-y-3">
            {myOffers.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate("company-applicants", { selectedCompanyOffer: item, applicantFilter: "Todos" })}
                className="w-full text-left bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-5 hover:border-[#97b4ea] flex items-center justify-between gap-4"
              >
                <span>
                  <strong className="block text-[var(--navy)]">{item.title}</strong>
                  <small className="text-[var(--muted)]">{item.city} · {item.modality} · Cierra {formatDate(item.closeDate, "sin fecha")}</small>
                </span>
                <span className="text-sm font-semibold text-[var(--navy)]">Ver postulantes →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="company" navigate={navigate} activeScreen="company-applicants" userName={state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa"} />

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

          <h1 className="display text-white text-3xl mb-1">
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
                  ? "bg-[var(--primary)] text-white shadow-md"
                  : "bg-white text-[var(--muted)] border border-[#d3e0f5] hover:border-[#97b4ea]"
              }`}
            >
              {f}
              {f !== "Todos" && (
                <span className={`ml-1.5 text-xs ${filter === f ? "opacity-70" : "text-[var(--muted)]"}`}>
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
              <div key={candidate.id} className="bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm overflow-hidden">
                {/* Status strip */}
                <div className={`h-1 ${candidate.status === "Aceptada" ? "bg-[var(--success)]" : candidate.status === "Rechazada" ? "bg-[var(--danger)]" : candidate.status === "Retirada" ? "bg-[#e3eaf5]" : "bg-[var(--warning)]"}`} />

                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: bg }}
                    >
                      <span className="text-white font-bold text-base">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-[var(--navy)] text-sm leading-snug">{candidate.name}</h3>
                          <p className="text-[var(--muted)] text-xs mt-0.5 font-medium">{candidate.career}{candidate.semester !== "No reportado" ? ` · ${candidate.semester}° semestre` : ""}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full font-bold border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {candidate.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1"><IconPin size={14} />{candidate.city}</span>
                        <span>{candidate.university}</span>
                        <span>{new Date(candidate.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  {candidate.skills.length > 0 && <div className="flex flex-wrap gap-1.5 mb-5">
                    {candidate.skills.map((s) => (
                      <span key={s} className="text-[11px] px-2.5 py-1 bg-[#f2f6fc] border border-[#e3eaf5] text-[#475467] rounded-lg font-semibold">{s}</span>
                    ))}
                  </div>}

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-4 border-t border-[#e3eaf5]">
                    <button
                      onClick={() => setSelected(candidate)}
                      className="flex-1 py-2.5 text-sm font-semibold text-[var(--navy)] border border-[#d3e0f5] rounded-xl hover:bg-[var(--selection)] hover:border-[#97b4ea] flex items-center justify-center gap-1.5"
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
                          style={{ background: "linear-gradient(135deg, #157347, #1f8a57)" }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Aceptar
                        </button>
                        <button
                          onClick={() => void changeCandidateStatus(candidate.id, "Rechazada")}
                          className="px-3.5 py-2.5 text-sm font-bold text-[var(--danger)] border border-[#fecdca] rounded-xl hover:bg-[#fef3f2]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : candidate.status === "Aceptada" ? (
                      <div className="flex-1 py-2.5 text-center text-sm font-bold text-[var(--success)] bg-[#eaf7f0] border border-[#b7e4c7] rounded-xl">
                        ✓ Aceptado
                      </div>
                    ) : candidate.status === "Retirada" ? (
                      <div className="flex-1 py-2.5 text-center text-sm font-semibold text-[var(--muted)] bg-[#f2f6fc] border border-[#e3eaf5] rounded-xl">
                        Retirada por el candidato
                      </div>
                    ) : (
                      <div className="flex-1 py-2.5 text-center text-sm font-semibold text-red-400 bg-[#fef3f2] border border-[#fecdca] rounded-xl">
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
          <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16">
            <div className="w-12 h-12 bg-[#f8faff] rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-[var(--muted)] text-sm font-medium">Sin candidatos con este filtro</p>
          </div>
        )}
      </div>

      {/* CV Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#e3eaf5]">
              <h3 className="font-bold text-[var(--navy)]">Perfil del candidato</h3>
              <button aria-label="Cerrar perfil" onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-[#f8faff] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--primary-soft)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Candidate header */}
              <div className="flex items-center gap-4 p-4 bg-[#f8faff] rounded-[20px] mb-5 border border-[#d3e0f5]">
                <div
                  className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-sm"
                  style={{ background: avatarGradients[0] }}
                >
                  <span className="text-white font-bold text-base">
                    {selected.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--navy)]">{selected.name}</h4>
                  <p className="text-[var(--muted)] text-sm">{selected.career}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1"><IconPin size={14} />{selected.city}</span>
                    <span>·</span>
                    <span>{selected.university}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <Section title="Formación">
                  <p className="text-sm font-semibold text-[var(--text)]">{selected.career}</p>
                  {selected.semester !== "No reportado" && <p className="text-sm text-[var(--muted)]">Semestre: {selected.semester}</p>}
                  {selected.education.map((item, index) => (
                    <p key={index} className="text-sm text-[#475467] mt-1"><strong>{item.titulo}</strong> · {item.institucion} · {item.periodo}</p>
                  ))}
                </Section>

                {selected.experience.length > 0 && (
                  <Section title="Experiencia">
                    {selected.experience.map((item, index) => (
                      <div key={index} className="mb-2">
                        <p className="text-sm font-semibold text-[var(--text)]">{item.cargo} · {item.empresa}</p>
                        <p className="text-xs text-[var(--muted)]">{item.periodo}</p>
                        {item.descripcion && <p className="text-sm text-[#475467]">{item.descripcion}</p>}
                      </div>
                    ))}
                  </Section>
                )}

                {selected.summary && <Section title="Resumen profesional"><p className="text-sm text-[#475467]">{selected.summary}</p></Section>}

                <Section title="Contacto">
                  <p className="text-sm text-[var(--text)]">Correo: {selected.email}</p>
                  <p className="text-sm text-[var(--muted)]">Teléfono: {selected.phone}</p>
                </Section>

                <Section title="Habilidades técnicas">
                  <div className="flex flex-wrap gap-1.5">
                    {selected.skills.length > 0 ? selected.skills.map((s) => (
                      <span key={s} className="text-xs px-3 py-1.5 bg-[var(--selection)] text-[var(--primary)] rounded-full font-semibold">{s}</span>
                    )) : <p className="text-sm text-[var(--muted)]">No se registraron habilidades en este perfil.</p>}
                  </div>
                </Section>

                <Section title="Fecha de postulación">
                  <p className="text-sm text-[var(--text)]">
                    {new Date(selected.appliedDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </Section>

                <div className="flex flex-wrap gap-4">
                  {selected.hasCv && (
                    <button
                      className="text-sm font-semibold text-[var(--primary)] underline"
                      onClick={() => state.token && void api.openApplicationCv(selected.id, state.token).catch((error) => setActionError(error instanceof Error ? error.message : "No se pudo abrir la hoja de vida."))}
                    >
                      Descargar hoja de vida (PDF)
                    </button>
                  )}
                  {selected.cvUrl && <a className="text-sm font-semibold text-[var(--primary)] underline" href={selected.cvUrl} target="_blank" rel="noreferrer">Abrir enlace de hoja de vida</a>}
                  {!selected.hasCv && !selected.cvUrl && <p className="text-sm text-[var(--muted)]">El candidato no adjuntó hoja de vida.</p>}
                </div>
              </div>

              {selected.status === "En revisión" && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => void changeCandidateStatus(selected.id, "Rechazada").then((updated) => { if (updated) setSelected(null); })}
                    className="flex-1 py-3 text-sm font-bold text-[var(--danger)] border border-[#fecdca] rounded-xl hover:bg-[#fef3f2]"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => void changeCandidateStatus(selected.id, "Aceptada").then((updated) => { if (updated) setSelected(null); })}
                    className="flex-1 py-3 text-sm font-bold text-white rounded-xl hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #157347, #1f8a57)" }}
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
      <h5 className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">{title}</h5>
      {children}
    </div>
  );
}
