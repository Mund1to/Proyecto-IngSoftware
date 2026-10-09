import { useEffect, useMemo, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import FilterDropdown, { FilterOption } from "../components/FilterDropdown";
import { api } from "../lib/api";
import { companyInitials, daysUntil, formatDate, formatSalary, isValidDate, normalizeModality, OFFER_TYPE_LABELS, offerTypeLabel, toNumberOrZero } from "../lib/offers";
import { useSavedOffers } from "../lib/useStoredList";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Sort = "recent" | "closing" | "salary";
type FilterKey = "city" | "area" | "modality" | "offerType";

const FILTER_KEYS: FilterKey[] = ["city", "area", "modality", "offerType"];
const SORT_OPTIONS: FilterOption[] = [
  { value: "recent", label: "Más recientes" },
  { value: "closing", label: "Fecha de cierre" },
  { value: "salary", label: "Mayor remuneración" },
];
const cities = ["Todas", "Bogotá", "Medellín", "Cali", "Ibagué"];
const areas = ["Todas", "Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Producción"];
const modalities = ["Todas", "Presencial", "Remota", "Híbrida"];

export const toUiOffer = (offer: any): Offer => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: normalizeModality(offer.modalidad ?? offer.modality),
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? "",
  salary: formatSalary(offer.remuneracion),
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
  offerType: offer.tipo,
  verified: Boolean(offer.verificada),
  duration: offer.duracion,
  schedule: offer.horario,
  contactEmail: offer.contacto_email,
  salaryMin: offer.remuneracion === null ? null : toNumberOrZero(offer.remuneracion),
  salaryMax: offer.remuneracion_maxima === null ? null : toNumberOrZero(offer.remuneracion_maxima),
});

export default function StudentDashboard({ state, navigate }: Props) {
  const [city, setCity] = useState("Todas");
  const [area, setArea] = useState("Todas");
  const [modality, setModality] = useState("Todas");
  const [offerType, setOfferType] = useState("Todas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [saved, setSaved] = useSavedOffers(state.currentUser?.id);
  const [onlySaved, setOnlySaved] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    // #20 HU-16: con sesión se usa el orden por afinidad al perfil; sin sesión,
    // el catálogo público. Si la recomendación falla, se cae al catálogo público.
    const fetchOffers = () => (state.token
      ? api.getRecommendedOffers(state.token).catch(() => api.getOffers())
      : api.getOffers());

    const refreshOffers = () => {
      fetchOffers()
        .then((response) => {
          if (!active) return;
          setOffers((response.offers ?? []).map(toUiOffer));
          setLoadError("");
        })
        .catch((error) => {
          if (!active) return;
          setOffers([]);
          setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las ofertas.");
        });
    };

    refreshOffers();
    const interval = window.setInterval(refreshOffers, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [state.token]);

  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const values: Record<FilterKey, string> = { city, area, modality, offerType };
  // Cumple todos los filtros activos salvo `except`; sirve para la lista y para
  // el contador de cada opción, que no cuenta el filtro propio.
  const matches = (offer: Offer, except?: FilterKey) =>
    FILTER_KEYS.every((key) => key === except || values[key] === "Todas" || offer[key] === values[key]) &&
    (!onlySaved || saved.includes(offer.id)) &&
    (!search || `${offer.title} ${offer.company}`.toLowerCase().includes(search.toLowerCase()));

  const filtered = useMemo(() => offers.filter((offer) => matches(offer)).sort((a, b) => sort === "closing"
    ? daysUntil(a.closeDate) - daysUntil(b.closeDate)
    : sort === "salary"
      ? salaryNumber(b.salary) - salaryNumber(a.salary)
      : b.id - a.id), [area, city, modality, offerType, search, sort, offers, onlySaved, saved]);

  const applied = new Set(state.applications.map((item) => item.offerId));
  const openCount = filtered.filter((offer) => !isValidDate(offer.closeDate) || daysUntil(offer.closeDate) >= 0).length;
  const clear = () => { setCity("Todas"); setArea("Todas"); setModality("Todas"); setOfferType("Todas"); setSort("recent"); setSearch(""); setOnlySaved(false); };

  const withCounts = (key: FilterKey, options: string[], labels?: string[]): FilterOption[] => {
    const pool = offers.filter((offer) => matches(offer, key));
    return options.map((option, index) => ({
      value: option,
      label: labels?.[index] ?? option,
      count: option === "Todas" ? pool.length : pool.filter((offer) => offer[key] === option).length,
    }));
  };

  const typeOptions = ["Todas", ...Object.keys(OFFER_TYPE_LABELS)];
  const typeLabels = ["Todas", ...Object.values(OFFER_TYPE_LABELS)];
  const filters: { key: FilterKey | "sort"; label: string; value: string; defaultValue: string; options: FilterOption[]; onChange: (value: string) => void }[] = [
    { key: "city", label: "Ciudad", value: city, defaultValue: "Todas", options: withCounts("city", [...new Set([...cities, ...offers.map((offer) => offer.city)])]), onChange: setCity },
    { key: "area", label: "Área", value: area, defaultValue: "Todas", options: withCounts("area", [...new Set([...areas, ...offers.map((offer) => offer.area)])]), onChange: setArea },
    { key: "modality", label: "Modalidad", value: modality, defaultValue: "Todas", options: withCounts("modality", modalities), onChange: setModality },
    { key: "offerType", label: "Tipo", value: offerType, defaultValue: "Todas", options: withCounts("offerType", typeOptions, typeLabels), onChange: setOfferType },
    { key: "sort", label: "Ordenar por", value: sort, defaultValue: "recent", options: SORT_OPTIONS, onChange: (value) => setSort(value as Sort) },
  ];

  const activeChips: { key: string; text: string; remove: () => void }[] = filters
    .filter((filter) => filter.value !== filter.defaultValue)
    .map((filter) => ({
      key: filter.key,
      text: `${filter.label}: ${filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}`,
      remove: () => filter.onChange(filter.defaultValue),
    }));
  if (onlySaved) activeChips.push({ key: "saved", text: "Solo guardadas", remove: () => setOnlySaved(false) });
  const resultKey = [city, area, modality, offerType, sort, onlySaved, search].join("|");

  return (
    <div className="app-shell">
      <NavBar role="student" navigate={navigate} activeScreen="student-dashboard" userName={state.currentUser?.nombreCompleto ?? "Estudiante"} />
      <main>
        <section className="page-hero">
          <div className="container">
            <p className="eyebrow inverse">Prácticas universitarias</p>
            <h1>Hola, {state.currentUser?.nombreCompleto?.split(" ")[0] ?? "estudiante"}. Encuentra tu próxima oportunidad.</h1>
            <p>Explora ofertas verificadas y lleva el seguimiento de tu proceso en un solo lugar.</p>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input aria-label="Buscar por cargo o empresa" placeholder="Buscar por cargo o empresa" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="container catalog">
          <div className="filter-card" aria-label="Filtros de ofertas">
            {filters.map((filter) => (
              <FilterDropdown
                key={filter.key}
                label={filter.label}
                value={filter.value}
                defaultValue={filter.defaultValue}
                options={filter.options}
                open={openFilter === filter.key}
                onOpenChange={(open) => setOpenFilter((current) => open ? filter.key : current === filter.key ? null : current)}
                onChange={filter.onChange}
              />
            ))}
            <button type="button" className={onlySaved ? "saved-toggle is-active" : "saved-toggle"} aria-pressed={onlySaved} onClick={() => setOnlySaved(!onlySaved)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
              Solo guardadas ({saved.length})
            </button>
            {activeChips.length > 0 && (
              <div className="active-filters">
                <span className="active-filters-label">Filtros activos:</span>
                {activeChips.map((chip) => (
                  <button key={chip.key} type="button" className="filter-chip" aria-label={`Quitar filtro ${chip.text}`} onClick={chip.remove}>
                    {chip.text}
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                ))}
                <button type="button" className="text-button active-filters-clear" onClick={clear}>Limpiar filtros</button>
              </div>
            )}
          </div>

          <div className="catalog-heading">
            <div><p className="eyebrow">Resultados</p><h2>{openCount === 1 ? "1 oferta abierta" : `${openCount} ofertas abiertas`}</h2></div>
            <p className="muted">Ofertas publicadas por organizaciones registradas en SIPU</p>
          </div>

          {loadError && <div className="form-error" role="alert">{loadError}</div>}
          {filtered.length ? (
            <div className="offer-grid" key={resultKey}>
              {filtered.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  applied={applied.has(offer.id)}
                  saved={saved.includes(offer.id)}
                  onSave={() => setSaved((current) => current.includes(offer.id) ? current.filter((id) => id !== offer.id) : [...current, offer.id])}
                  onOpen={() => navigate("offer-detail", { selectedOffer: offer })}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ArdyMark className="empty-squirrel" /><h2>No encontramos ofertas</h2>
              <p>Prueba cambiando la búsqueda o quitando algunos filtros.</p>
              <button className="button primary" onClick={clear}>Limpiar filtros</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function OfferCard({ offer, applied, saved, onSave, onOpen }: { offer: Offer; applied: boolean; saved: boolean; onSave: () => void; onOpen: () => void }) {
  const days = daysUntil(offer.closeDate);
  const status = applied ? "Ya te postulaste" : days < 0 ? "Cerrada" : days <= 14 ? "Cierra pronto" : "Abierta";
  return (
    <article className="offer-card">
      <div className="offer-topline">
        <div className="company-mark" aria-hidden="true">{offer.logo}</div>
        <span className={`status status-${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
        <button className={saved ? "save-button saved" : "save-button"} aria-label={`${saved ? "Quitar de guardadas" : "Guardar oferta"}: ${offer.title}`} onClick={onSave}>{saved ? "Guardada" : "Guardar"}</button>
      </div>
      <button className="offer-main" onClick={onOpen} aria-label={`Ver oferta ${offer.title} en ${offer.company}`}>
        <h3>{offer.title}</h3>
        <p className="verified">{offer.company}{offer.verified && <span title="Organización verificada">✓ Verificada</span>}</p>
        <dl className="offer-meta">
          <div><dt>Ciudad</dt><dd>{offer.city}</dd></div>
          <div><dt>Modalidad</dt><dd>{offer.modality}</dd></div>
          <div><dt>Tipo</dt><dd>{offerTypeLabel(offer.offerType)}</dd></div>
          <div><dt>Área</dt><dd>{offer.area}</dd></div>
          <div><dt>Remuneración</dt><dd>{offer.salary} COP</dd></div>
        </dl>
        <div className="offer-footer"><span>Fecha límite: {formatDate(offer.closeDate, "Sin fecha de cierre")}</span><strong>Ver detalle →</strong></div>
      </button>
    </article>
  );
}

function salaryNumber(value: string) { return Number(value.replace(/\D/g, "")); }

