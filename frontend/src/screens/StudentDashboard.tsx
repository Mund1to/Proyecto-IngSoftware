import { useEffect, useMemo, useState } from "react";
import { AppState, Offer, Screen } from "../App";
import NavBar from "../components/NavBar";
import ArdyMark from "../components/ArdyMark";
import { api } from "../lib/api";
import { companyInitials, formatSalary, toNumberOrZero } from "../lib/offers";

type Props = { state: AppState; navigate: (screen: Screen, extra?: Partial<AppState>) => void };
type Sort = "recent" | "closing" | "salary";

const cities = ["Todas", "Bogotá", "Medellín", "Cali", "Sopó, Cundinamarca"];
const areas = ["Todas", "Tecnología", "Marketing", "Contabilidad", "Recursos Humanos", "Producción"];
const modalities = ["Todas", "Presencial", "Remota", "Híbrida"];

const toUiOffer = (offer: any): Offer => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: (offer.modalidad ?? "Híbrida") as Offer["modality"],
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? new Date().toISOString(),
  salary: formatSalary(offer.remuneracion),
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
  offerType: offer.tipo,
  verified: Boolean(offer.verificada),
  duration: offer.duracion,
  schedule: offer.horario,
  salaryMin: offer.remuneracion === null ? null : toNumberOrZero(offer.remuneracion),
  salaryMax: offer.remuneracion_maxima === null ? null : toNumberOrZero(offer.remuneracion_maxima),
});

export default function StudentDashboard({ state, navigate }: Props) {
  const [city, setCity] = useState("Todas");
  const [area, setArea] = useState("Todas");
  const [modality, setModality] = useState("Todas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [saved, setSaved] = useState<number[]>([]);
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

  const filtered = useMemo(() => offers.filter((offer) =>
    (city === "Todas" || offer.city === city) &&
    (area === "Todas" || offer.area === area) &&
    (modality === "Todas" || offer.modality === modality) &&
    (!search || `${offer.title} ${offer.company}`.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => sort === "closing"
    ? +new Date(a.closeDate) - +new Date(b.closeDate)
    : sort === "salary"
      ? salaryNumber(b.salary) - salaryNumber(a.salary)
      : b.id - a.id), [area, city, modality, search, sort, offers]);

  const applied = new Set(state.applications.map((item) => item.offerId));
  const openCount = filtered.filter((offer) => +new Date(offer.closeDate) >= Date.now()).length;
  const hasFilters = city !== "Todas" || area !== "Todas" || modality !== "Todas" || Boolean(search);
  const clear = () => { setCity("Todas"); setArea("Todas"); setModality("Todas"); setSearch(""); };

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
            <Filter label="Ciudad" value={city} options={cities} onChange={setCity} />
            <Filter label="Área" value={area} options={[...new Set([...areas, ...offers.map((offer) => offer.area)])]} onChange={setArea} />
            <Filter label="Modalidad" value={modality} options={modalities} onChange={setModality} />
            <Filter label="Ordenar por" value={sort} options={["recent", "closing", "salary"]} labels={["Más recientes", "Fecha de cierre", "Mayor remuneración"]} onChange={(value) => setSort(value as Sort)} />
            {hasFilters && <button className="button secondary clear-filters" onClick={clear}>Limpiar filtros</button>}
          </div>

          <div className="catalog-heading">
            <div><p className="eyebrow">Resultados</p><h2>{openCount} ofertas abiertas</h2></div>
            <p className="muted">Ofertas publicadas por organizaciones registradas en SIPU</p>
          </div>

          {loadError && <div className="form-error" role="alert">{loadError}</div>}
          {filtered.length ? (
            <div className="offer-grid">
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

function Filter({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: string[]; onChange: (value: string) => void }) {
  return <label className="filter"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option, index) => <option key={option} value={option}>{labels?.[index] ?? option}</option>)}</select></label>;
}

function OfferCard({ offer, applied, saved, onSave, onOpen }: { offer: Offer; applied: boolean; saved: boolean; onSave: () => void; onOpen: () => void }) {
  const days = Math.ceil((+new Date(offer.closeDate) - Date.now()) / 86400000);
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
          <div><dt>Área</dt><dd>{offer.area}</dd></div>
          <div><dt>Remuneración</dt><dd>{offer.salary} COP</dd></div>
        </dl>
        <div className="offer-footer"><span>Fecha límite: {formatDate(offer.closeDate)}</span><strong>Ver detalle →</strong></div>
      </button>
    </article>
  );
}

function salaryNumber(value: string) { return Number(value.replace(/\D/g, "")); }
export function formatDate(value: string) { return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)).replace(".", ""); }
