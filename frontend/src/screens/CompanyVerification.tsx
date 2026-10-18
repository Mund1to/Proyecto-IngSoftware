import { useCallback, useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import VerificationDecisionModal from "../components/VerificationDecisionModal";
import { IconFile } from "../components/icons";
import {
  api,
  type RequestStatus,
  type ReviewedOrganization,
  type VerificationRequest,
} from "../lib/api";
import { formatSize } from "../lib/files";
import { formatDate } from "../lib/offers";
import { useSession } from "../lib/session";
import { TONE_CLASSES, documentTypeLabel, statusMeta } from "../lib/verification";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

type Tab = "PENDIENTES" | "HISTORIAL" | "ORGANIZACIONES";
type HistoryFilter = RequestStatus | "TODAS";
type Decision = { estado: "APROBADA" | "RECHAZADA"; revoke?: boolean; organizationName: string; confirm: (observaciones: string) => Promise<void> };

const PAGE_SIZE = 10;
const cardClass = "bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-6";
const emptyClass = "bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16 text-[var(--muted)] text-sm";

const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "TODAS", label: "Todas" },
  { value: "APROBADA", label: "Aprobadas" },
  { value: "RECHAZADA", label: "Rechazadas" },
];

// #17 HU-13 y Fase 7: bandeja de solicitudes de verificación. El revisor abre los
// documentos que envió cada empresa y aprueba o rechaza con un motivo.
export default function CompanyVerification({ state, navigate }: Props) {
  const session = useSession();
  const { refreshPendingVerifications } = session;
  const [tab, setTab] = useState<Tab>("PENDIENTES");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("TODAS");
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [organizations, setOrganizations] = useState<ReviewedOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const status = tab === "PENDIENTES" ? "PENDIENTE" : historyFilter;

  const load = useCallback(async () => {
    if (!state.token) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "ORGANIZACIONES") {
        setOrganizations((await api.getOrganizations(state.token)).organizations ?? []);
      } else {
        const response = await api.getVerificationRequests(state.token, { estado: status, page: 1, limit: PAGE_SIZE });
        setRequests(response.requests ?? []);
        setTotal(response.total ?? 0);
        setPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
    refreshPendingVerifications();
  }, [state.token, tab, status, refreshPendingVerifications]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!state.token) return;
    setLoadingMore(true);
    try {
      const response = await api.getVerificationRequests(state.token, { estado: status, page: page + 1, limit: PAGE_SIZE });
      setRequests((current) => [...current, ...(response.requests ?? [])]);
      setTotal(response.total ?? total);
      setPage(page + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar más solicitudes.");
    } finally {
      setLoadingMore(false);
    }
  };

  const openDocument = (documentId: number) => {
    if (!state.token) return;
    void api.openVerificationDocument(documentId, state.token).catch((err) => setError(err instanceof Error ? err.message : "No se pudo abrir el documento."));
  };

  const decideRequest = (request: VerificationRequest, estado: "APROBADA" | "RECHAZADA") => {
    setNotice("");
    setDecision({
      estado,
      organizationName: request.organizacion.razonSocial,
      confirm: async (observaciones) => {
        await api.decideVerificationRequest(request.id, estado, observaciones, state.token ?? "");
        setDecision(null);
        setNotice(`${request.organizacion.razonSocial}: solicitud ${estado === "APROBADA" ? "aprobada" : "rechazada"}. Se avisó a la empresa por correo.`);
        await load();
      },
    });
  };

  const decideOrganization = (organization: ReviewedOrganization, estado: "APROBADA" | "RECHAZADA") => {
    setNotice("");
    setDecision({
      estado,
      // Rechazar a una organización ya verificada equivale a retirarle la verificación.
      revoke: organization.verificada && estado === "RECHAZADA",
      organizationName: organization.razon_social,
      confirm: async (observaciones) => {
        await api.updateOrganizationVerification(organization.organizacion_id, estado, state.token ?? "", observaciones || undefined);
        setDecision(null);
        setNotice(`${organization.razon_social}: verificación ${estado === "APROBADA" ? "aprobada" : "retirada"}.`);
        await load();
      },
    });
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "PENDIENTES", label: "Pendientes", count: session.pendingVerifications },
    { id: "HISTORIAL", label: "Historial" },
    { id: "ORGANIZACIONES", label: "Organizaciones" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="admin" navigate={navigate} activeScreen="company-verification" userName={state.currentUser?.nombreCompleto ?? "Administrador"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="display text-3xl text-[var(--navy)]">Solicitudes de verificación</h1>
            <p className="text-[var(--muted)] text-sm mt-1">Revisa los documentos que envían las empresas y decide si quedan verificadas.</p>
          </div>
          <button onClick={() => void load()} className="text-sm font-semibold text-[var(--navy)] border border-[#d3e0f5] rounded-xl px-4 py-2 hover:bg-white">
            Actualizar
          </button>
        </div>

        <div className="type-tabs mb-6" role="group" aria-label="Vista de solicitudes">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={`type-tab ${tab === item.id ? "is-active" : ""}`} aria-pressed={tab === item.id} onClick={() => { setNotice(""); setTab(item.id); }}>
              {item.label}
              {item.count !== undefined && <span className="type-tab-count">{item.count}</span>}
            </button>
          ))}
        </div>

        {tab === "HISTORIAL" && (
          <div className="flex items-center gap-3 mb-5">
            <label htmlFor="history-filter" className="text-sm font-semibold text-[var(--navy)]">Mostrar</label>
            <select id="history-filter" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)} className="px-4 py-2 rounded-xl border border-[#d3e0f5] bg-white text-sm">
              {HISTORY_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </div>
        )}

        {error && <div className="form-error mb-5" role="alert">{error}</div>}
        {notice && <div className="success-panel mb-5" role="status"><p>{notice}</p></div>}

        {loading ? (
          <div className={emptyClass}>Cargando...</div>
        ) : tab === "ORGANIZACIONES" ? (
          <OrganizationList organizations={organizations} onDecide={decideOrganization} />
        ) : requests.length === 0 ? (
          <div className={emptyClass}>
            {tab === "PENDIENTES" ? "No hay solicitudes pendientes. ¡Todo al día!" : "No hay solicitudes revisadas con este filtro."}
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} onOpenDocument={openDocument} onDecide={(estado) => decideRequest(request, estado)} />
            ))}
            {requests.length < total && (
              <div className="flex justify-center">
                <button type="button" className="button secondary" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? "Cargando..." : `Cargar más (${total - requests.length} restantes)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {decision && (
        <VerificationDecisionModal
          organizationName={decision.organizationName}
          decision={decision.estado}
          revoke={decision.revoke}
          onConfirm={decision.confirm}
          onClose={() => setDecision(null)}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string | null }) {
  const meta = statusMeta(status);
  return <span className={`text-xs px-3 py-1.5 rounded-full font-bold border flex-shrink-0 ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>;
}

function RequestCard({ request, onOpenDocument, onDecide }: {
  request: VerificationRequest;
  onOpenDocument: (documentId: number) => void;
  onDecide: (estado: "APROBADA" | "RECHAZADA") => void;
}) {
  const { organizacion, solicitante } = request;
  const pending = request.estado === "PENDIENTE";
  const titleId = `request-${request.id}`;

  return (
    <article className={cardClass} aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={titleId} className="font-bold text-[var(--navy)]">{organizacion.razonSocial}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--muted)]">
            {organizacion.identificacionFiscal && <span>NIT: {organizacion.identificacionFiscal}</span>}
            {organizacion.sitioWeb && <a className="text-[var(--primary)] underline break-all" href={organizacion.sitioWeb} target="_blank" rel="noreferrer noopener">{organizacion.sitioWeb}</a>}
            <span>Enviada el {formatDate(request.enviadaAt)}</span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Contacto: {[solicitante.nombre, solicitante.email, solicitante.telefono].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusChip status={request.estado} />
      </div>

      {organizacion.descripcion && <p className="text-sm text-[#475467] mt-3 line-clamp-3">{organizacion.descripcion}</p>}

      {request.mensaje && (
        <div className="mt-4 rounded-xl bg-[#f8faff] border border-[#e3eaf5] p-3 text-sm">
          <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1">Mensaje de la empresa</p>
          <p className="text-[#475467]">{request.mensaje}</p>
        </div>
      )}

      <h4 className="text-sm font-bold text-[var(--navy)] mt-4 mb-2">Documentos ({request.documentos.length})</h4>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={`Documentos de ${organizacion.razonSocial}`}>
        {request.documentos.map((document) => (
          <li key={document.id} className="flex items-center gap-3 rounded-xl border border-[#e3eaf5] px-3 py-2.5">
            <span className="text-[var(--primary)]" aria-hidden="true"><IconFile size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--navy)]">{documentTypeLabel(document.tipo)}</p>
              <p className="text-xs text-[var(--muted)] break-all">{document.nombre} · {formatSize(document.tamano)}</p>
            </div>
            <button type="button" className="text-xs font-semibold text-[var(--primary)] hover:underline" aria-label={`Ver ${document.nombre} de ${organizacion.razonSocial}`} onClick={() => onOpenDocument(document.id)}>
              Ver
            </button>
          </li>
        ))}
      </ul>

      {!pending && (
        <div className="mt-4 text-sm text-[#475467]">
          <p className="text-xs text-[var(--muted)]">
            Revisada{request.revisor ? ` por ${request.revisor}` : ""}{request.revisadaAt ? ` el ${formatDate(request.revisadaAt)}` : ""}.
          </p>
          {request.observaciones && <p className="mt-1">{request.observaciones}</p>}
        </div>
      )}

      {pending && (
        <div className="flex gap-3 mt-5 pt-4 border-t border-[#e3eaf5]">
          <button
            type="button"
            onClick={() => onDecide("APROBADA")}
            aria-label={`Aprobar verificación de ${organizacion.razonSocial}`}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #157347, #1f8a57)" }}
          >
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => onDecide("RECHAZADA")}
            aria-label={`Rechazar verificación de ${organizacion.razonSocial}`}
            className="flex-1 py-2.5 text-sm font-bold text-[var(--danger)] border border-[#fecdca] rounded-xl hover:bg-[#fef3f2]"
          >
            Rechazar verificación
          </button>
        </div>
      )}
    </article>
  );
}

// Vista general: todas las organizaciones, hayan enviado solicitud o no. Permite
// aprobar directamente o retirar una verificación vigente.
function OrganizationList({ organizations, onDecide }: {
  organizations: ReviewedOrganization[];
  onDecide: (organization: ReviewedOrganization, estado: "APROBADA" | "RECHAZADA") => void;
}) {
  if (organizations.length === 0) return <div className={emptyClass}>No hay organizaciones registradas.</div>;

  const verifiedCount = organizations.filter((org) => org.verificada).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{verifiedCount} de {organizations.length} organizaciones verificadas.</p>
      {organizations.map((org) => {
        const status = org.verificada ? "APROBADA" : org.verificacion_estado ?? "SIN_SOLICITUD";
        return (
          <div key={org.organizacion_id} className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-[var(--navy)]">{org.razon_social}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--muted)]">
                  {org.identificacion_fiscal && <span>NIT: {org.identificacion_fiscal}</span>}
                  {org.sitio_web && <a className="text-[var(--primary)] underline break-all" href={org.sitio_web} target="_blank" rel="noreferrer noopener">{org.sitio_web}</a>}
                  <span>{org.documentos_count ?? 0} documento(s)</span>
                </div>
                {org.observaciones && <p className="text-sm text-[#475467] mt-3">{org.observaciones}</p>}
              </div>
              <StatusChip status={status} />
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-[#e3eaf5]">
              <button
                type="button"
                disabled={org.verificada}
                onClick={() => onDecide(org, "APROBADA")}
                aria-label={`Aprobar verificación de ${org.razon_social}`}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #157347, #1f8a57)" }}
              >
                {org.verificada ? "✓ Ya verificada" : "Aprobar"}
              </button>
              <button
                type="button"
                disabled={!org.verificada && status === "RECHAZADA"}
                onClick={() => onDecide(org, "RECHAZADA")}
                aria-label={`${org.verificada ? "Retirar verificación" : "Rechazar verificación"} de ${org.razon_social}`}
                className="flex-1 py-2.5 text-sm font-bold text-[var(--danger)] border border-[#fecdca] rounded-xl hover:bg-[#fef3f2] disabled:opacity-40"
              >
                {org.verificada ? "Retirar verificación" : "Rechazar verificación"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
