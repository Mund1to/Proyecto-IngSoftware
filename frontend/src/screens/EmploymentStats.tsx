import { ReactNode, useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { IconBriefcase, IconBuilding, IconCheck, IconUser } from "../components/icons";
import { api } from "../lib/api";
import { companyInitials } from "../lib/offers";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

type Totals = Record<string, string | number>;
type Row = { tipo?: string; area?: string; ubicacion?: string; razon_social?: string; mes?: string; total: string | number };
type Stats = {
  totals: Totals;
  offersByType: Row[];
  offersByArea: Row[];
  offersByCity: Row[];
  topOrganizations: Row[];
  applicationsByMonth: Row[];
};

const labelMap: Record<string, string> = {
  total_ofertas: "Ofertas totales",
  ofertas_publicadas: "Ofertas publicadas",
  total_postulaciones: "Postulaciones",
  postulaciones_aceptadas: "Postulaciones aceptadas",
  total_organizaciones: "Organizaciones",
  organizaciones_verificadas: "Organizaciones verificadas",
  total_estudiantes: "Estudiantes",
  total_candidatos_externos: "Candidatos externos",
};

// Tipos de oferta en la dona: etiqueta y color (siempre acompañados de texto y porcentaje).
const TYPE_META: Record<string, { label: string; color: string }> = {
  PRACTICA: { label: "Prácticas", color: "#155eef" },
  EMPLEO: { label: "Empleos", color: "#123b70" },
  FORMACION: { label: "Formación", color: "#4d87ff" },
  EMPLEO_PUBLICO: { label: "Empleo público", color: "#9dbbf3" },
};

// Los tres indicadores grandes que tienen valor propio; el resto de totals va en la fila de mini indicadores.
const MAIN_KEYS = ["ofertas_publicadas", "total_postulaciones", "total_organizaciones"];

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const hasValue = (totals: Totals, key: string) => totals[key] !== undefined && totals[key] !== null;

// Últimos 6 meses (incluido el actual) con 0 en los meses sin postulaciones.
function lastSixMonths(rows: Row[]) {
  const byMonth = new Map(rows.map((row) => [String(row.mes), num(row.total)]));
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const short = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(date).replace(".", "");
    const long = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(date);
    return { key, label: short.charAt(0).toUpperCase() + short.slice(1), long, value: byMonth.get(key) ?? 0 };
  });
}

// #21 HU-17: indicadores agregados de empleo (Fase 4).
export default function EmploymentStats({ state, navigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.token) {
      setLoading(false);
      return;
    }
    api.getEmploymentStats(state.token)
      .then((response) => {
        setStats(response.stats);
        setError("");
      })
      .catch((err) => {
        setStats(null);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas.");
      })
      .finally(() => setLoading(false));
  }, [state.token]);

  return (
    <div className="app-shell">
      <NavBar role="admin" navigate={navigate} activeScreen="employment-stats" userName={state.currentUser?.nombreCompleto ?? "Funcionario"} />

      <main className="container stats-vivo">
        <div className="stats-head">
          <p className="eyebrow">Observatorio SIPU</p>
          <h1 className="display">Estadísticas de <span className="highlight on-light">empleo</span></h1>
          <p className="muted">Indicadores agregados del sistema. No incluye datos personales.</p>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        {loading ? (
          <div className="panel-card stats-empty" role="status">Cargando estadísticas...</div>
        ) : !stats ? (
          <div className="panel-card stats-empty">No hay estadísticas disponibles.</div>
        ) : (
          <StatsBody stats={stats} />
        )}
      </main>
    </div>
  );
}

function StatsBody({ stats }: { stats: Stats }) {
  const { totals } = stats;
  const applications = num(totals.total_postulaciones);
  const accepted = num(totals.postulaciones_aceptadas);
  const placement = applications > 0 ? Math.round((accepted / applications) * 100) : 0;
  const show = (key: string) => (hasValue(totals, key) ? num(totals[key]).toLocaleString("es-CO") : "—");

  const kpis = [
    { label: "Ofertas publicadas", value: show("ofertas_publicadas"), sub: hasValue(totals, "total_ofertas") ? `de ${show("total_ofertas")} ofertas totales` : "", icon: IconBriefcase, dark: true },
    { label: "Postulaciones", value: show("total_postulaciones"), sub: hasValue(totals, "postulaciones_aceptadas") ? `${show("postulaciones_aceptadas")} aceptadas` : "", icon: IconUser, dark: false },
    { label: "Organizaciones", value: show("total_organizaciones"), sub: hasValue(totals, "organizaciones_verificadas") ? `${show("organizaciones_verificadas")} verificadas` : "", icon: IconBuilding, dark: false },
    { label: "Tasa de colocación", value: hasValue(totals, "total_postulaciones") ? `${placement} %` : "—", sub: "postulaciones aceptadas", icon: IconCheck, dark: false },
  ];
  const minis = Object.keys(totals).filter((key) => !MAIN_KEYS.includes(key));

  // Dona por tipo.
  const typeRows = stats.offersByType.map((row) => {
    const meta = TYPE_META[String(row.tipo)] ?? { label: String(row.tipo ?? "Otro"), color: "#b9cdef" };
    return { ...meta, value: num(row.total) };
  });
  const typeTotal = typeRows.reduce((total, row) => total + row.value, 0);
  let accumulated = 0;
  const stops = typeRows.map((row) => {
    const from = accumulated;
    accumulated += typeTotal ? (row.value / typeTotal) * 100 : 0;
    return `${row.color} ${from}% ${accumulated}%`;
  }).join(", ");
  const percent = (value: number) => (typeTotal ? Math.round((value / typeTotal) * 100) : 0);

  // Columnas por mes con el mes más alto resaltado.
  const months = lastSixMonths(stats.applicationsByMonth);
  const monthMax = Math.max(1, ...months.map((month) => month.value));
  const peak = months.reduce((best, month) => (month.value > best.value ? month : best), months[0]);

  return (
    <>
      <div className="stats-kpis">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={kpi.dark ? "stats-kpi is-dark" : "panel-card stats-kpi"}>
              <span className="stats-kpi-icon" aria-hidden="true"><Icon size={24} /></span>
              <strong>{kpi.value}</strong>
              <span className="stats-kpi-label">{kpi.label}</span>
              {kpi.sub && <small>{kpi.sub}</small>}
            </div>
          );
        })}
      </div>

      {minis.length > 0 && (
        <dl className="stats-minis">
          {minis.map((key) => (
            <div key={key}>
              <dt>{labelMap[key] ?? key}</dt>
              <dd>{show(key)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="stats-row">
        <Panel title="Ofertas por tipo" className="stats-panel-type">
          {typeTotal === 0 ? <p className="muted">Sin datos.</p> : (
            <div className="stats-donut-wrap">
              <div className="stats-donut" role="img" aria-label={`Ofertas por tipo: ${typeRows.map((row) => `${row.label} ${row.value} (${percent(row.value)} %)`).join(", ")}`} style={{ background: `conic-gradient(${stops})` }}>
                <div aria-hidden="true"><strong>{typeTotal}</strong><small>ofertas</small></div>
              </div>
              <ul className="stats-legend" aria-hidden="true">
                {typeRows.map((row) => (
                  <li key={row.label}>
                    <span className="stats-legend-dot" style={{ background: row.color }} />
                    <span className="stats-legend-label">{row.label}</span>
                    <strong>{row.value}</strong>
                    <span className="stats-legend-pct">{percent(row.value)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Postulaciones por mes" aside="Últimos 6 meses" className="stats-panel-months">
          <div className="stats-columns" role="img" aria-label={`Postulaciones por mes: ${months.map((month) => `${month.long} ${month.value}`).join(", ")}`}>
            {months.map((month) => {
              const isPeak = month.value > 0 && month === peak;
              return (
                <div key={month.key} className={isPeak ? "stats-column is-peak" : "stats-column"} aria-hidden="true">
                  <strong>{month.value}</strong>
                  <span className="stats-column-bar" style={{ height: `${Math.max(4, (month.value / monthMax) * 100)}%` }} />
                  <small>{month.label}</small>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="stats-row">
        <Panel title="Ofertas por ciudad"><HorizontalBars rows={stats.offersByCity} labelKey="ubicacion" name="Ofertas por ciudad" /></Panel>
        <Panel title="Ofertas por área"><HorizontalBars rows={stats.offersByArea} labelKey="area" name="Ofertas por área" /></Panel>
        <Panel title="Organizaciones con más ofertas">
          {stats.topOrganizations.length === 0 ? <p className="muted">Sin datos.</p> : (
            <ol className="stats-ranking" aria-label="Organizaciones con más ofertas">
              {stats.topOrganizations.map((row, index) => (
                <li key={`${row.razon_social}-${index}`}>
                  <span className={index === 0 ? "stats-rank is-first" : "stats-rank"} aria-hidden="true">{index + 1}</span>
                  <span className="stats-rank-mark" aria-hidden="true">{companyInitials(String(row.razon_social ?? "O"))}</span>
                  <span className="stats-rank-name">{row.razon_social}</span>
                  <span className="stats-rank-total">{num(row.total)} {num(row.total) === 1 ? "oferta" : "ofertas"}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, aside, className = "", children }: { title: string; aside?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`panel-card stats-panel ${className}`}>
      <div className="stats-panel-head">
        <h2>{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function HorizontalBars({ rows, labelKey, name }: { rows: Row[]; labelKey: keyof Row; name: string }) {
  if (rows.length === 0) return <p className="muted">Sin datos.</p>;
  const max = Math.max(1, ...rows.map((row) => num(row.total)));
  const items = rows.map((row) => ({ label: String(row[labelKey] ?? "Sin dato"), value: num(row.total) }));
  return (
    <div className="stats-hbars" role="img" aria-label={`${name}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} aria-hidden="true">
          <div className="stats-hbar-head"><span>{item.label}</span><strong>{item.value}</strong></div>
          <div className="stats-hbar-track"><div style={{ width: `${(item.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
