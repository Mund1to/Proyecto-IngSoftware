import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api } from "../lib/api";

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

const shortLabel: Record<string, string> = {
  PRACTICA: "Prácticas",
  EMPLEO: "Empleos",
  EMPLEO_PUBLICO: "Empleo público",
  FORMACION: "Formación",
};

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

  const maxBar = (rows: Row[]) => Math.max(1, ...rows.map((row) => Number(row.total) || 0));

  const Bars = ({ rows, labelKey }: { rows: Row[]; labelKey: keyof Row }) => {
    const max = maxBar(rows);
    return (
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[#64748b]">Sin datos.</p>
        ) : rows.map((row, index) => {
          const label = shortLabel[String(row[labelKey])] ?? String(row[labelKey] ?? "Sin dato");
          const value = Number(row.total) || 0;
          return (
            <div key={`${label}-${index}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-[#1e293b]">{label}</span>
                <span className="text-[#64748b] tabular">{value}</span>
              </div>
              <div className="h-2.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: "linear-gradient(90deg, #0d2240 0%, #163456 100%)" }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-6">
      <h2 className="font-bold text-[#0d2240] mb-4">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="admin" navigate={navigate} activeScreen="employment-stats" userName={state.currentUser?.nombreCompleto ?? "Funcionario"} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2240] mb-1">Estadísticas de empleo</h1>
        <p className="text-[#64748b] text-sm mb-6">Indicadores agregados del sistema. No incluye datos personales.</p>

        {error && <div className="form-error mb-5" role="alert">{error}</div>}

        {loading ? (
          <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16 text-[#64748b] text-sm">Cargando estadísticas...</div>
        ) : !stats ? (
          <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16 text-[#64748b] text-sm">No hay estadísticas disponibles.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {Object.entries(stats.totals).map(([key, value]) => (
                <div key={key} className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-5">
                  <p className="text-2xl font-bold text-[#0d2240] tabular">{String(value)}</p>
                  <p className="text-xs text-[#64748b] mt-1 font-medium">{labelMap[key] ?? key}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Ofertas por tipo"><Bars rows={stats.offersByType} labelKey="tipo" /></Panel>
              <Panel title="Ofertas por área"><Bars rows={stats.offersByArea} labelKey="area" /></Panel>
              <Panel title="Ofertas por ciudad"><Bars rows={stats.offersByCity} labelKey="ubicacion" /></Panel>
              <Panel title="Postulaciones por mes"><Bars rows={stats.applicationsByMonth} labelKey="mes" /></Panel>
              <Panel title="Organizaciones con más ofertas">
                <div className="space-y-3">
                  {stats.topOrganizations.length === 0 ? (
                    <p className="text-sm text-[#64748b]">Sin datos.</p>
                  ) : stats.topOrganizations.map((row, index) => (
                    <div key={`${row.razon_social}-${index}`} className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#1e293b]">{row.razon_social}</span>
                      <span className="text-[#64748b] tabular">{row.total} ofertas</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
