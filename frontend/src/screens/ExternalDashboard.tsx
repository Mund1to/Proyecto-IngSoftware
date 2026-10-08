import { useEffect, useState } from "react";
import { AppState, Job, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import { api } from "../lib/api";
import { companyInitials, toNumberOrZero } from "../lib/offers";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

const AREAS = ["Todas", "Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Producción", "Jurídica", "Diseño"];
const MODALITIES = ["Todas", "Presencial", "Remota", "Híbrida"];
const TYPES = ["Todos", "Práctica", "Tiempo completo", "Medio tiempo", "Contrato", "Freelance"];

const modalityStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Presencial: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  Remota: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400" },
  Híbrida: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
};

const typeStyle: Record<string, string> = {
  "Práctica": "bg-cyan-50 text-cyan-700",
  "Tiempo completo": "bg-emerald-50 text-emerald-700",
  "Medio tiempo": "bg-sky-50 text-sky-700",
  Contrato: "bg-orange-50 text-orange-700",
  Freelance: "bg-pink-50 text-pink-700",
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
  "$" + (n >= 1000000 ? (n / 1000000).toFixed(1).replace(".0", "") + "M" : (n / 1000) + "K");

const mapOfferToJob = (offer: any): Job => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: (offer.modalidad ?? "Híbrida") as Job["modality"],
  type: offer.tipo === "PRACTICA" ? "Práctica" : (offer.tipo === "EMPLEO_PUBLICO" ? "Contrato" : "Tiempo completo"),
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? new Date().toISOString(),
  salaryMin: toNumberOrZero(offer.remuneracion ?? offer.salaryMin),
  salaryMax: toNumberOrZero(offer.remuneracion_maxima ?? offer.remuneracionMaxima ?? offer.salaryMax ?? offer.remuneracion),
  experience: offer.experiencia ?? "No especificada",
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  benefits: Array.isArray(offer.benefits) ? offer.benefits : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
});

export default function ExternalDashboard({ state, navigate }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadError, setLoadError] = useState("");
  const [area, setArea] = useState("Todas");
  const [modality, setModality] = useState("Todas");
  const [type, setType] = useState("Todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const refreshOffers = () => {
      api.getOffers()
        .then((response) => {
          if (!active) return;
          const offers = (response.offers ?? []).filter((offer) => offer.estado === "PUBLICADA");
          setJobs(offers.map(mapOfferToJob));
          setLoadError("");
        })
        .catch((error) => {
          if (!active) return;
          setJobs([]);
          setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las vacantes.");
        });
    };

    refreshOffers();
    const interval = window.setInterval(refreshOffers, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const applied = state.jobApplications.map((a) => a.jobId);

  const filtered = jobs.filter((j) => {
    if (area !== "Todas" && j.area !== area) return false;
    if (modality !== "Todas" && j.modality !== modality) return false;
    if (type !== "Todos" && j.type !== type) return false;
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasFilters = area !== "Todas" || modality !== "Todas" || type !== "Todos" || search;

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="external" navigate={navigate} activeScreen="external-dashboard" userName={state.currentUser?.nombreCompleto ?? "Candidato"} />

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #081626 0%, #0d2240 55%, #122f5c 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        <div className="absolute right-0 bottom-0 w-80 h-56 opacity-10"
          style={{ background: "radial-gradient(circle at 80% 120%, #3b82f6 0%, transparent 60%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 pb-12">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#60a5fa]" />
            <span className="text-[#60a5fa] text-xs font-semibold tracking-wide uppercase">
              Bolsa de empleo general · {filtered.length} vacantes
            </span>
          </div>
          <h1 className="text-white text-3xl font-bold mb-1 tracking-tight">
            Hola, {state.currentUser?.nombreCompleto?.split(" ")[0] ?? "Candidato"} 👋
          </h1>
          <p className="text-white/50 text-sm mb-7">
            Encuentra empleos en las mejores empresas del país. Abierto a todos los profesionales.
          </p>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-3 mb-7">
            {[
              { label: "Vacantes activas", value: jobs.length },
              { label: "Empresas", value: new Set(jobs.map(j => j.company)).size },
              { label: "Ciudades", value: new Set(jobs.map(j => j.city)).size },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-4 py-2 text-sm">
                <span className="text-white font-bold tabular">{s.value}</span>
                <span className="text-white/40">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-2xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" placeholder="Buscar por cargo, empresa o área..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm bg-white/10 border border-white/15 text-white placeholder-white/35 focus:bg-white/15 focus:border-white/30"
              style={{ outline: "none", backdropFilter: "blur(8px)" }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 py-5 border-b border-[#e2e8f0]">
          <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mr-1">Filtrar:</span>
          <Chip label="Área" value={area} options={AREAS} onChange={setArea} />
          <Chip label="Modalidad" value={modality} options={MODALITIES} onChange={setModality} />
          <Chip label="Tipo" value={type} options={TYPES} onChange={setType} />
          {hasFilters && (
            <button
              onClick={() => { setArea("Todas"); setModality("Todas"); setType("Todos"); setSearch(""); }}
              className="text-xs text-[#64748b] hover:text-[#0d2240] px-3 py-1.5 rounded-full border border-dashed border-[#cbd5e1] hover:border-[#0d2240]/30 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Grid */}
        {loadError && <div className="form-error mt-5" role="alert">{loadError}</div>}
        <div className="py-8">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isApplied={applied.includes(job.id)}
                  onClick={() => navigate("external-job-detail", { selectedJob: job })}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ArdyMark className="empty-squirrel mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#0d2240] mb-2">Sin resultados</h3>
              <p className="text-[#64748b] text-sm">Ajusta los filtros para ver más vacantes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const active = value !== "Todas" && value !== "Todos";
  return (
    <div className="relative">
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer text-xs font-semibold pl-3.5 pr-7 py-2 rounded-full border focus:outline-none transition-all ${
          active ? "bg-[#0d2240] text-white border-[#0d2240]" : "bg-white text-[#475569] border-[#e2e8f0] hover:border-[#94a3b8]"
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o} className="text-[#1e293b] bg-white font-normal">{o === "Todas" || o === "Todos" ? label : o}</option>
        ))}
      </select>
      <svg
        className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? "text-white" : "text-[#94a3b8]"}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function JobCard({ job, isApplied, onClick }: { job: Job; isApplied: boolean; onClick: () => void }) {
  const bg = logoStyle[job.logo] ?? "linear-gradient(135deg, #0d2240 0%, #163456 100%)";
  const mod = modalityStyle[job.modality];
  const daysLeft = Math.ceil((new Date(job.closeDate).getTime() - Date.now()) / 86400000);

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-[#e8eef4] p-6 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#c5d4e8] group"
      style={{ transition: "box-shadow 0.2s, transform 0.2s, border-color 0.15s" }}
    >
      <div className="flex items-start gap-3.5 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bg }}>
          <span className="text-white font-bold text-sm tracking-tight">{job.logo}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-[#0d2240] text-sm leading-snug line-clamp-2 group-hover:text-[#163456]">{job.title}</h3>
          <p className="text-[#64748b] text-xs mt-1 font-medium">{job.company}</p>
        </div>
        {isApplied && (
          <div className="w-6 h-6 rounded-full bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold ${mod.bg} ${mod.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${mod.dot}`} />
          {job.modality}
        </span>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${typeStyle[job.type]}`}>{job.type}</span>
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">{job.area}</span>
      </div>

      <div className="flex items-center gap-1 text-[12px] text-[#94a3b8] mb-5">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{job.city}</span>
        <span className="mx-1 opacity-40">·</span>
        <span>{job.experience} exp.</span>
        <span className="mx-1 opacity-40">·</span>
        <span>{job.applicants} aplicaron</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#f1f5f9]">
        <div>
          <div className="text-[#16a34a] font-bold text-sm">
            {job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir"}
          </div>
          <div className={`text-[11px] mt-0.5 font-medium ${daysLeft <= 5 ? "text-red-500" : "text-[#94a3b8]"}`}>
            {daysLeft > 0 ? (daysLeft <= 5 ? `⚠ Cierra en ${daysLeft}d` : `Cierra en ${daysLeft} días`) : "Cerrada"}
          </div>
        </div>
        {isApplied ? (
          <span className="text-[11px] font-bold text-[#16a34a] bg-[#f0fdf4] px-3 py-1.5 rounded-full">Aplicado ✓</span>
        ) : (
          <span className="text-[11px] font-semibold text-[#0d2240]/60 group-hover:text-[#0d2240] flex items-center gap-1">
            Ver vacante
            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transition: "transform 0.15s" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
