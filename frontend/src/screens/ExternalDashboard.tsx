import { useEffect, useState } from "react";
import { AppState, Job, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import FilterDropdown, { FilterOption } from "../components/FilterDropdown";
import { api } from "../lib/api";
import { companyInitials, daysUntil, normalizeModality, toNumberOrZero } from "../lib/offers";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

const AREAS = ["Todas", "Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Producción", "Jurídica", "Diseño"];
const MODALITIES = ["Todas", "Presencial", "Remota", "Híbrida"];
const TYPES = ["Todos", "Práctica", "Tiempo completo", "Medio tiempo", "Contrato", "Freelance", "Formación"];
const CITIES = ["Todas", "Bogotá", "Medellín", "Cali", "Ibagué"];

type JobFilterKey = "area" | "modality" | "city" | "type";
const JOB_FILTER_KEYS: JobFilterKey[] = ["area", "modality", "city", "type"];
const DEFAULTS: Record<JobFilterKey, string> = { area: "Todas", modality: "Todas", city: "Todas", type: "Todos" };
const LABELS: Record<JobFilterKey, string> = { area: "Área", modality: "Modalidad", city: "Ciudad", type: "Tipo" };
const SORT_OPTIONS: FilterOption[] = [
  { value: "recent", label: "Más recientes" },
  { value: "closing", label: "Cierran pronto" },
  { value: "salary", label: "Mayor salario" },
];

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
  "Formación": "bg-indigo-50 text-indigo-700",
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

export const mapOfferToJob = (offer: any): Job => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: normalizeModality(offer.modalidad ?? offer.modality),
  type: offer.tipo === "PRACTICA" ? "Práctica" : offer.tipo === "FORMACION" ? "Formación" : offer.tipo === "EMPLEO_PUBLICO" ? "Contrato" : "Tiempo completo",
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? "",
  salaryMin: toNumberOrZero(offer.remuneracion ?? offer.salaryMin),
  salaryMax: toNumberOrZero(offer.remuneracion_maxima ?? offer.remuneracionMaxima ?? offer.salaryMax ?? offer.remuneracion),
  experience: offer.experiencia ?? offer.duracion ?? "No especificada",
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
  const [city, setCity] = useState("Todas");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [openFilter, setOpenFilter] = useState<string | null>(null);

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

  const values: Record<JobFilterKey, string> = { area, modality, city, type };
  // Cumple los filtros activos salvo `except`; el contador de cada opción no
  // cuenta el filtro propio.
  const matches = (job: Job, except?: JobFilterKey) =>
    JOB_FILTER_KEYS.every((key) => key === except || values[key] === DEFAULTS[key] || job[key] === values[key]) &&
    (!search || `${job.title} ${job.company} ${job.area}`.toLowerCase().includes(search.toLowerCase()));

  const filtered = jobs.filter((job) => matches(job)).sort((a, b) => sort === "closing"
    ? daysUntil(a.closeDate) - daysUntil(b.closeDate)
    : sort === "salary"
      ? Math.max(b.salaryMin, b.salaryMax) - Math.max(a.salaryMin, a.salaryMax)
      : b.id - a.id);

  // Opciones con contador; se ocultan las que no tienen vacantes salvo la elegida.
  const withCounts = (key: JobFilterKey, base: string[]): FilterOption[] => {
    const pool = jobs.filter((job) => matches(job, key));
    return [...new Set([...base, ...jobs.map((job) => job[key])])]
      .map((option) => ({ value: option, label: option, count: option === DEFAULTS[key] ? pool.length : pool.filter((job) => job[key] === option).length }))
      .filter((option) => option.value === DEFAULTS[key] || option.value === values[key] || option.count > 0);
  };

  const setters: Record<JobFilterKey, (value: string) => void> = { area: setArea, modality: setModality, city: setCity, type: setType };
  const typeChips = withCounts("type", TYPES);
  const activeChips = [
    ...JOB_FILTER_KEYS.filter((key) => values[key] !== DEFAULTS[key]).map((key) => ({ key, text: `${LABELS[key]}: ${values[key]}`, remove: () => setters[key](DEFAULTS[key]) })),
    ...(sort !== "recent" ? [{ key: "sort", text: `Orden: ${SORT_OPTIONS.find((option) => option.value === sort)?.label}`, remove: () => setSort("recent") }] : []),
    ...(search ? [{ key: "search", text: `“${search}”`, remove: () => setSearch("") }] : []),
  ];
  const clear = () => { setArea("Todas"); setModality("Todas"); setCity("Todas"); setType("Todos"); setSort("recent"); setSearch(""); };
  const resultKey = [area, modality, city, type, sort, search].join("|");
  const dropdown = (key: JobFilterKey | "sort") => ({
    open: openFilter === key,
    onOpenChange: (open: boolean) => setOpenFilter((current) => open ? key : current === key ? null : current),
    variant: "pill" as const,
  });

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
              Bolsa de empleo general · {filtered.length} {filtered.length === 1 ? "vacante" : "vacantes"}
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
        <div className="ext-filters">
          <div className="type-tabs" role="group" aria-label="Tipo de vacante">
            {typeChips.map((option) => {
              const selected = type === option.value;
              return (
                <button key={option.value} type="button" aria-pressed={selected} className={selected ? "type-tab is-active" : "type-tab"} onClick={() => setType(option.value)}>
                  {option.label}
                  <span className="type-tab-count">{option.count}</span>
                </button>
              );
            })}
          </div>

          <div className="ext-filter-row">
            <span className="ext-filter-label">Filtrar:</span>
            <FilterDropdown label="Área" value={area} defaultValue="Todas" options={withCounts("area", AREAS)} onChange={setArea} {...dropdown("area")} />
            <FilterDropdown label="Modalidad" value={modality} defaultValue="Todas" options={withCounts("modality", MODALITIES)} onChange={setModality} {...dropdown("modality")} />
            <FilterDropdown label="Ciudad" value={city} defaultValue="Todas" options={withCounts("city", CITIES)} onChange={setCity} {...dropdown("city")} />
            <div className="ext-filter-sort">
              <FilterDropdown label="Ordenar" value={sort} defaultValue="recent" options={SORT_OPTIONS} onChange={setSort} {...dropdown("sort")} />
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="ext-active-row">
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" className="ext-chip" aria-label={`Quitar filtro ${chip.text}`} onClick={chip.remove}>
                  {chip.text}
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              ))}
              <button type="button" className="ext-clear" onClick={clear}>Limpiar todo</button>
            </div>
          )}
        </div>

        {/* Grid */}
        {loadError && <div className="form-error mt-5" role="alert">{loadError}</div>}
        <div className="py-8">
          <p className="ext-result-count" aria-live="polite">
            <strong key={filtered.length}>{filtered.length}</strong> {filtered.length === 1 ? "vacante encontrada" : "vacantes encontradas"}
          </p>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" key={resultKey}>
              {filtered.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  delay={Math.min(index, 8) * 45}
                  isApplied={applied.includes(job.id)}
                  onClick={() => navigate("external-job-detail", { selectedJob: job })}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ArdyMark className="empty-squirrel mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#0d2240] mb-2">Sin resultados</h3>
              <p className="text-[#64748b] text-sm mb-4">Ajusta los filtros para ver más vacantes.</p>
              <button type="button" className="ext-clear" onClick={clear}>Limpiar filtros</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, isApplied, delay = 0, onClick }: { job: Job; isApplied: boolean; delay?: number; onClick: () => void }) {
  const bg = logoStyle[job.logo] ?? "linear-gradient(135deg, #0d2240 0%, #163456 100%)";
  const mod = modalityStyle[job.modality] ?? modalityStyle.Híbrida;
  const daysLeft = daysUntil(job.closeDate);

  return (
    <button
      onClick={onClick}
      className="job-card text-left bg-white rounded-2xl border border-[#e8eef4] p-6 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#c5d4e8] group"
      style={{ transition: "box-shadow 0.2s, transform 0.2s, border-color 0.15s", animationDelay: `${delay}ms` }}
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
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${typeStyle[job.type] ?? "bg-slate-100 text-slate-600"}`}>{job.type}</span>
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">{job.area}</span>
      </div>

      <div className="flex items-center gap-1 text-[12px] text-[#94a3b8] mb-5">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{job.city}</span>
        <span className="mx-1 opacity-40">·</span>
        <span>{job.experience}</span>
        <span className="mx-1 opacity-40">·</span>
        <span>{job.applicants} aplicaron</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#f1f5f9]">
        <div>
          <div className="text-[#16a34a] font-bold text-sm">
            {job.salaryMin || job.salaryMax ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}` : "A convenir"}
          </div>
          <div className={`text-[11px] mt-0.5 font-medium ${daysLeft <= 5 ? "text-red-500" : "text-[#94a3b8]"}`}>
            {!Number.isFinite(daysLeft) ? "Sin fecha de cierre" : daysLeft >= 0 ? (daysLeft <= 5 ? `⚠ Cierra en ${daysLeft}d` : `Cierra en ${daysLeft} días`) : "Cerrada"}
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
