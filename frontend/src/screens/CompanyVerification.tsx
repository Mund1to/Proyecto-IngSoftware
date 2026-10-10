import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api } from "../lib/api";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

type Organization = {
  organizacion_id: number;
  razon_social: string;
  identificacion_fiscal: string | null;
  sitio_web: string | null;
  verificada: boolean;
  verificacion_estado: string | null;
  observaciones: string | null;
  verificacion_fecha: string | null;
};

const statusStyle: Record<string, string> = {
  APROBADA: "bg-[#eaf7f0] text-[var(--success)] border-[#b7e4c7]",
  RECHAZADA: "bg-[#fef3f2] text-[var(--danger)] border-[#fecdca]",
  PENDIENTE: "bg-[#fff4df] text-[var(--warning)] border-[#f5d9a8]",
};

// #17 HU-13: panel para revisar y aprobar la verificación de organizaciones.
export default function CompanyVerification({ state, navigate }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = () => {
    if (!state.token) return;
    setLoading(true);
    api.getOrganizations(state.token)
      .then((response) => {
        setOrganizations(response.organizations ?? []);
        setError("");
      })
      .catch((err) => {
        setOrganizations([]);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las organizaciones.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [state.token]);

  const changeStatus = async (organizationId: number, status: "APROBADA" | "RECHAZADA") => {
    if (!state.token) return;
    const observaciones = status === "RECHAZADA" ? window.prompt("Motivo del rechazo (opcional)") ?? undefined : undefined;
    setUpdatingId(organizationId);
    setError("");
    try {
      const response = await api.updateOrganizationVerification(organizationId, status, state.token, observaciones);
      setOrganizations((current) => current.map((org) => org.organizacion_id === organizationId
        ? { ...org, verificada: response.organization?.verificada ?? status === "APROBADA", verificacion_estado: status, observaciones: observaciones ?? org.observaciones }
        : org));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la verificación.");
    } finally {
      setUpdatingId(null);
    }
  };

  const verifiedCount = organizations.filter((org) => org.verificada).length;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="admin" navigate={navigate} activeScreen="company-verification" userName={state.currentUser?.nombreCompleto ?? "Administrador"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="display text-3xl text-[var(--navy)]">Verificación de organizaciones</h1>
            <p className="text-[var(--muted)] text-sm mt-1">{verifiedCount} de {organizations.length} organizaciones verificadas.</p>
          </div>
          <button onClick={load} className="text-sm font-semibold text-[var(--navy)] border border-[#d3e0f5] rounded-xl px-4 py-2 hover:bg-white">
            Actualizar
          </button>
        </div>

        {error && <div className="form-error mb-5" role="alert">{error}</div>}

        {loading ? (
          <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16 text-[var(--muted)] text-sm">Cargando organizaciones...</div>
        ) : organizations.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16">
            <p className="text-[var(--muted)] text-sm">No hay organizaciones registradas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => {
              const status = org.verificacion_estado ?? (org.verificada ? "APROBADA" : "PENDIENTE");
              return (
                <div key={org.organizacion_id} className="bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-bold text-[var(--navy)] flex items-center gap-2">
                        {org.razon_social}
                        {org.verificada && <span className="text-[var(--success)] text-sm font-semibold">✓ Verificada</span>}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-[var(--muted)]">
                        {org.identificacion_fiscal && <span>NIT: {org.identificacion_fiscal}</span>}
                        {org.sitio_web && <a className="text-[var(--primary)] underline" href={org.sitio_web} target="_blank" rel="noreferrer">{org.sitio_web}</a>}
                      </div>
                      {org.observaciones && <p className="text-sm text-[#475467] mt-3">{org.observaciones}</p>}
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold border flex-shrink-0 ${statusStyle[status] ?? statusStyle.PENDIENTE}`}>
                      {status}
                    </span>
                  </div>

                  <div className="flex gap-3 mt-5 pt-4 border-t border-[#e3eaf5]">
                    <button
                      disabled={updatingId === org.organizacion_id || org.verificada}
                      onClick={() => void changeStatus(org.organizacion_id, "APROBADA")}
                      className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #157347, #1f8a57)" }}
                    >
                      {org.verificada ? "✓ Ya verificada" : "Aprobar verificación"}
                    </button>
                    <button
                      disabled={updatingId === org.organizacion_id || (!org.verificada && status === "RECHAZADA")}
                      onClick={() => void changeStatus(org.organizacion_id, "RECHAZADA")}
                      className="flex-1 py-2.5 text-sm font-bold text-[var(--danger)] border border-[#fecdca] rounded-xl hover:bg-[#fef3f2] disabled:opacity-40"
                    >
                      Rechazar
                    </button>
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
