import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import ArdyBubble from "../components/ArdyBubble";
import DueBadge from "../components/DueBadge";
import FilterDropdown, { FilterOption } from "../components/FilterDropdown";
import ProgressMeter from "../components/ProgressMeter";
import TypeBadge from "../components/TypeBadge";
import { IconArrowRight, IconBook, IconBookmark, IconBriefcase, IconCheck, IconClose, IconGraduation, IconGrid, IconMonitor, IconPin, IconSearch, IconVerified } from "../components/icons";
import { api } from "../lib/api";
import { companyInitials, daysUntil, formatSalary, isValidDate, normalizeModality, OFFER_TYPE_LABELS, toNumberOrZero } from "../lib/offers";
import { useSavedOffers } from "../lib/useStoredList";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Sort = "recent" | "closing" | "salary";
type FilterKey = "city" | "area" | "modality" | "offerType";
// Las recomendaciones traen `affinity` (0 a 100); el catálogo público no.
type CatalogOffer = Offer & { affinity?: number };

const FILTER_KEYS: FilterKey[] = ["city", "area", "modality", "offerType"];
const SORT_OPTIONS: FilterOption[] = [
  { value: "recent", label: "Más recientes" },
  { value: "closing", label: "Fecha de cierre" },
  { value: "salary", label: "Mayor remuneración" },
];
const cities = ["Todas", "Bogotá", "Medellín", "Cali", "Ibagué"];
const areas = ["Todas", "Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Producción"];
const modalities = ["Todas", "Presencial", "Remota", "Híbrida"];

// Fichas de "Explora por tipo"; actúan sobre el mismo estado `offerType`.
const TYPE_TILES = [
  { value: "Todas", label: "Todas", icon: IconGrid, tone: "all" },
  { value: "PRACTICA", label: "Prácticas", icon: IconGraduation, tone: "practica" },
  { value: "EMPLEO", label: "Empleos", icon: IconBriefcase, tone: "empleo" },
  { value: "FORMACION", label: "Formación", icon: IconBook, tone: "formacion" },
  { value: "EMPLEO_PUBLICO", label: "Empleo público", icon: IconBriefcase, tone: "empleo" },
] as const;

export const toUiOffer = (offer: any): CatalogOffer => ({
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
  ...(Number.isFinite(Number(offer.affinity)) && offer.affinity !== null && offer.affinity !== undefined ? { affinity: Number(offer.affinity) } : {}),
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
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loadError, setLoadError] = useState("");
  // Número de ofertas que devolvió la recomendación; null si se usó el catálogo público.
  const [recommendedCount, setRecommendedCount] = useState<number | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    // #20 HU-16: con sesión se usa el orden por afinidad al perfil; sin sesión,
    // el catálogo público. Si la recomendación falla, se cae al catálogo público.
    const fetchOffers = () => (state.token
      ? api.getRecommendedOffers(state.token)
        .then((response) => ({ response, recommended: true }))
        .catch(() => api.getOffers().then((response) => ({ response, recommended: false })))
      : api.getOffers().then((response) => ({ response, recommended: false })));

    const refreshOffers = () => {
      fetchOffers()
        .then(({ response, recommended }) => {
          if (!active) return;
          const list = (response.offers ?? []).map(toUiOffer);
          setOffers(list);
          setRecommendedCount(recommended ? list.length : null);
          setLoadError("");
        })
        .catch((error) => {
          if (!active) return;
          setOffers([]);
          setRecommendedCount(null);
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

  const filters: { key: FilterKey | "sort"; label: string; value: string; defaultValue: string; options: FilterOption[]; onChange: (value: string) => void }[] = [
    { key: "city", label: "Ciudad", value: city, defaultValue: "Todas", options: withCounts("city", [...new Set([...cities, ...offers.map((offer) => offer.city)])]), onChange: setCity },
    { key: "area", label: "Área", value: area, defaultValue: "Todas", options: withCounts("area", [...new Set([...areas, ...offers.map((offer) => offer.area)])]), onChange: setArea },
    { key: "modality", label: "Modalidad", value: modality, defaultValue: "Todas", options: withCounts("modality", modalities), onChange: setModality },
    { key: "sort", label: "Ordenar por", value: sort, defaultValue: "recent", options: SORT_OPTIONS, onChange: (value) => setSort(value as Sort) },
  ];

  // Fichas por tipo con su contador; "Empleo público" solo aparece si hay ofertas de ese tipo.
  const typePool = offers.filter((offer) => matches(offer, "offerType"));
  const typeTiles = TYPE_TILES
    .map((tile) => ({ ...tile, count: tile.value === "Todas" ? typePool.length : typePool.filter((offer) => offer.offerType === tile.value).length }))
    .filter((tile) => tile.value !== "EMPLEO_PUBLICO" || tile.count > 0 || offerType === tile.value);

  const activeChips: { key: string; text: string; remove: () => void }[] = filters
    .filter((filter) => filter.value !== filter.defaultValue)
    .map((filter) => ({
      key: filter.key,
      text: `${filter.label}: ${filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}`,
      remove: () => filter.onChange(filter.defaultValue),
    }));
  if (offerType !== "Todas") {
    activeChips.push({ key: "offerType", text: `Tipo: ${OFFER_TYPE_LABELS[offerType as keyof typeof OFFER_TYPE_LABELS] ?? offerType}`, remove: () => setOfferType("Todas") });
  }
  if (onlySaved) activeChips.push({ key: "saved", text: "Solo guardadas", remove: () => setOnlySaved(false) });
  const resultKey = [city, area, modality, offerType, sort, onlySaved, search].join("|");

  const firstName = state.currentUser?.nombreCompleto?.split(" ")[0] ?? "estudiante";
  const inReview = state.applications.filter((item) => item.status === "En revisión").length;
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <NavBar role="student" navigate={navigate} activeScreen="student-dashboard" userName={state.currentUser?.nombreCompleto ?? "Estudiante"} />
      <main className="container catalog-vivo">
        <section className="hero-card catalog-hero">
          <div className="dots catalog-hero-dots" aria-hidden="true" />
          <div className="catalog-hero-main">
            <p className="eyebrow inverse">Prácticas universitarias</p>
            <h1 className="display">Hola, {firstName}. Tu próxima <span className="highlight">oportunidad</span> está aquí.</h1>
            <p className="catalog-hero-lead">Ofertas verificadas por la universidad, ordenadas según tu programa y tus habilidades.</p>
            <form className="catalog-search" role="search" onSubmit={submitSearch}>
              <IconSearch size={22} className="catalog-search-icon" />
              <input aria-label="Buscar por cargo o empresa" placeholder="Buscar por cargo o empresa" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="submit" className="catalog-search-button">Buscar</button>
            </form>
          </div>
          {state.token && (
            <div className="catalog-hero-ardy">
              {recommendedCount !== null && (
                <ArdyBubble
                  title={recommendedCount === 1 ? "¡Encontré 1 oferta para ti!" : `¡Encontré ${recommendedCount} ofertas para ti!`}
                  text="Ordenadas según tu programa y tus habilidades."
                />
              )}
              <ul className="catalog-hero-pills" aria-label="Tu actividad">
                <li><strong>{saved.length}</strong> {saved.length === 1 ? "guardada" : "guardadas"}</li>
                <li><strong>{inReview}</strong> en revisión</li>
              </ul>
            </div>
          )}
        </section>

        <section className="type-explore" aria-labelledby="type-explore-title">
          <h2 id="type-explore-title">Explora por tipo</h2>
          <div className="type-tiles">
            {typeTiles.map((tile) => {
              const Icon = tile.icon;
              const pressed = offerType === tile.value;
              return (
                <button key={tile.value} type="button" aria-pressed={pressed} className={pressed ? "type-tile is-active" : "type-tile"} onClick={() => { setOfferType(tile.value); setOpenFilter(null); }}>
                  <span className={`type-tile-icon type-tile-icon-${tile.tone}`} aria-hidden="true"><Icon size={24} /></span>
                  <span className="type-tile-text">
                    <strong>{tile.label}</strong>
                    <small>{tile.count === 1 ? "1 oferta" : `${tile.count} ofertas`}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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
            <IconBookmark size={18} filled={onlySaved} />
            Solo guardadas ({saved.length})
          </button>
          {activeChips.length > 0 && (
            <div className="active-filters">
              <span className="active-filters-label">Filtros activos:</span>
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" className="filter-chip" aria-label={`Quitar filtro ${chip.text}`} onClick={chip.remove}>
                  {chip.text}
                  <IconClose size={14} />
                </button>
              ))}
              <button type="button" className="text-button active-filters-clear" onClick={clear}>Limpiar filtros</button>
            </div>
          )}
        </div>

        <div className="catalog-heading">
          <h2 ref={resultsRef} tabIndex={-1}>{openCount === 1 ? "1 oferta abierta" : `${openCount} ofertas abiertas`}</h2>
          <p className="muted">Ofertas publicadas por organizaciones registradas en SIPU</p>
        </div>

        {loadError && <div className="form-error" role="alert">{loadError}</div>}
        {filtered.length ? (
          <div className="offer-grid-vivo" key={resultKey}>
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
          <div className="empty-vivo">
            <ArdyMark className="empty-vivo-ardy" />
            <h2>No encontramos ofertas</h2>
            <p>Ardy siguió buscando, pero nada coincide. Prueba quitando algunos filtros.</p>
            <button className="button primary" onClick={clear}>Limpiar filtros</button>
          </div>
        )}
      </main>
    </div>
  );
}

function OfferCard({ offer, applied, saved, onSave, onOpen }: { offer: CatalogOffer; applied: boolean; saved: boolean; onSave: () => void; onOpen: () => void }) {
  return (
    <article className="panel-card interactive vivo-offer">
      <div className="vivo-offer-top">
        <TypeBadge type={offer.offerType} />
        <DueBadge closeDate={offer.closeDate} />
        <button
          type="button"
          className={saved ? "vivo-save is-saved" : "vivo-save"}
          aria-pressed={saved}
          aria-label={`${saved ? "Quitar de guardadas" : "Guardar oferta"}: ${offer.title}`}
          onClick={onSave}
        >
          <IconBookmark size={18} filled={saved} />
        </button>
      </div>
      <button className="vivo-offer-main" onClick={onOpen} aria-label={`Ver oferta ${offer.title} en ${offer.company}`}>
        <span className="vivo-offer-head">
          <span className="vivo-company-mark" aria-hidden="true">{offer.logo}</span>
          <span className="vivo-offer-title">
            <strong>{offer.title}</strong>
            <span className="vivo-offer-company">{offer.company}{offer.verified && <IconVerified />}</span>
          </span>
        </span>
        {applied && <span className="vivo-applied"><IconCheck size={14} />Ya te postulaste</span>}
        <span className="vivo-chips">
          <span><IconPin size={14} />{offer.city}</span>
          <span><IconMonitor size={14} />{offer.modality}</span>
          <span>{offer.area}</span>
        </span>
        {offer.affinity !== undefined && <ProgressMeter value={offer.affinity} label="Afinidad con tu perfil" />}
        <span className="vivo-offer-foot">
          <span className="vivo-salary"><small>Remuneración</small><strong>{offer.salary}</strong></span>
          <span className="vivo-go" aria-hidden="true"><IconArrowRight /></span>
        </span>
      </button>
    </article>
  );
}

function salaryNumber(value: string) { return Number(value.replace(/\D/g, "")); }
