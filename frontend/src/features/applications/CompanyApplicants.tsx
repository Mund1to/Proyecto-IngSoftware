// Proceso de selección de la empresa (Fase 8): tablero por etapas (con arrastrar
// y soltar y menú "Mover a" accesible por teclado), vista de lista, panel del
// candidato con la hoja de vida enviada, coincidencia de habilidades, historial,
// notas internas y calificación, y diálogos para citar, seleccionar o descartar.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { AppState, Navigate } from "../../app/types";
import NavBar from "../../app/NavBar";
import ArdyMark from "../../shared/ui/ArdyMark";
import TypeBadge from "../offers/TypeBadge";
import { IconArrowRight, IconCalendar, IconCheck, IconClose, IconFile, IconGrid, IconLock, IconMail, IconMenu, IconPin, IconSearch, IconUser } from "../../shared/ui/icons";
import { offersApi } from "../offers/offers.api";
import { toUiOffer, type Offer } from "../offers/offers.model";
import { formatDate } from "../../shared/lib/format";
import { formatSize } from "../../shared/lib/files";
import { applicationsApi, type StageChange } from "./applications.api";
import { INTERVIEW_MODE_LABELS, describeEvent, formatInterviewDate, toEvents } from "./applications.model";
import {
  STAGE_LABELS,
  allowedTransitions,
  boardColumns,
  daysAgo,
  initials,
  isTrainingOffer,
  mapApplicant,
  skillMatch,
  sortApplicants,
  transitionBlockedReason,
  type Applicant,
  type SortKey,
  type Stage,
} from "./applicants.model";
import StageDialog, { type DialogMode } from "./StageDialog";

type Props = { state: AppState; navigate: Navigate };
type Toast = { text: string; tone: "ok" | "error" } | null;

const STAGE_TONE: Record<Stage, string> = { ENVIADA: "sent", EN_REVISION: "review", PRESELECCIONADA: "interview", ACEPTADA: "accepted", RECHAZADA: "rejected", RETIRADA: "withdrawn" };

// Siguiente paso natural de cada etapa (botón principal del panel del candidato).
const PRIMARY_ACTION: Partial<Record<Stage, (training: boolean) => Stage>> = {
  ENVIADA: () => "EN_REVISION",
  EN_REVISION: (training) => (training ? "ACEPTADA" : "PRESELECCIONADA"),
  PRESELECCIONADA: () => "ACEPTADA",
  ACEPTADA: () => "EN_REVISION",
  RECHAZADA: () => "EN_REVISION",
};

// Texto de la acción para pasar a cada etapa.
function moveLabel(current: Stage, target: Stage, training: boolean): string {
  if (target === "PRESELECCIONADA") return current === "PRESELECCIONADA" ? "Reprogramar entrevista" : "Citar a entrevista";
  if (target === "EN_REVISION") return current === "ACEPTADA" || current === "RECHAZADA" ? "Reabrir proceso" : current === "PRESELECCIONADA" ? "Volver a revisión" : "Empezar revisión";
  if (target === "ACEPTADA") return training ? "Aceptar inscripción" : "Seleccionar";
  if (target === "RECHAZADA") return "Descartar";
  return STAGE_LABELS[target];
}

export default function CompanyApplicants({ state, navigate }: Props) {
  const offer = state.selectedCompanyOffer;
  const company = state.currentUser?.organizacionNombre ?? state.currentUser?.nombreCompleto ?? "Empresa";
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [myOffers, setMyOffers] = useState<Offer[] | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ mode: DialogMode; applicantId: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const training = isTrainingOffer(offer?.offerType);
  // Oferta en la papelera: se consulta el historial, pero el proceso queda en pausa.
  const paused = offer?.status === "CANCELADA";
  const offerSkills = offer?.skills ?? [];
  const vacancies = offer?.vacancies ?? 1;

  // Sin oferta seleccionada (entrada desde el menú) se listan las ofertas propias.
  useEffect(() => {
    if (offer || !state.token) return;
    offersApi.getMyOffers(state.token)
      .then((response) => setMyOffers((response.offers ?? []).map(toUiOffer)))
      .catch((error) => {
        setMyOffers([]);
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar tus ofertas.");
      });
  }, [offer, state.token]);

  useEffect(() => {
    if (!offer || !state.token) return;
    setApplicants(null);
    applicationsApi.getApplicationsForOffer(String(offer.id), state.token)
      .then((response) => setApplicants((response.applications ?? []).map(mapApplicant)))
      .catch((error) => {
        setApplicants([]);
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las postulaciones.");
      });
  }, [offer, state.token]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const list = applicants ?? [];
  const accepted = list.filter((item) => item.status === "ACEPTADA").length;
  const columns = useMemo(() => boardColumns(offer?.offerType), [offer?.offerType]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? list.filter((item) => `${item.name} ${item.career} ${item.skills.join(" ")}`.toLowerCase().includes(term))
      : list;
    return sortApplicants(filtered, sort, offerSkills);
  }, [list, query, sort, offerSkills]);

  const replaceApplicant = (id: number, changes: Partial<Applicant>) =>
    setApplicants((current) => (current ?? []).map((item) => item.id === id ? { ...item, ...changes } : item));

  const changeStage = useCallback(async (applicant: Applicant, target: Stage, change: StageChange = {}) => {
    if (!state.token) return;
    setBusy(true);
    setDialogError("");
    try {
      const response = await applicationsApi.updateApplicationStatus(applicant.id, target, state.token, change);
      const updated = response.application ?? {};
      const [event] = toEvents(updated.evento ? [updated.evento] : []);
      replaceApplicant(applicant.id, {
        status: (updated.estado ?? target) as Stage,
        interview: updated.entrevista === undefined ? applicant.interview : updated.entrevista ? { ...updated.entrevista } : null,
        events: event ? [...applicant.events, { ...event, autorRol: "EMPRESA", autor: state.currentUser?.nombreCompleto ?? null }] : applicant.events,
      });
      setDialog(null);
      setToast({ text: `${applicant.name}: ${moveLabel(applicant.status, target, training).toLowerCase()} listo.${target !== "EN_REVISION" ? " Le avisamos por correo." : ""}`, tone: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cambiar la etapa.";
      if (dialog) setDialogError(message);
      else setToast({ text: message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [state.token, state.currentUser?.nombreCompleto, training, dialog]);

  // Pedir un cambio de etapa: algunas transiciones abren un diálogo con lo que necesitan.
  const requestMove = (applicant: Applicant, target: Stage) => {
    if (paused) {
      setToast({ text: "La oferta está cancelada. Restáurala desde tu panel para continuar con el proceso.", tone: "error" });
      return;
    }
    const blocked = transitionBlockedReason(applicant.status, target, offer?.offerType);
    if (blocked) {
      setToast({ text: blocked, tone: "error" });
      return;
    }
    setDialogError("");
    if (target === "PRESELECCIONADA") setDialog({ mode: "interview", applicantId: applicant.id });
    else if (target === "ACEPTADA") setDialog({ mode: "accept", applicantId: applicant.id });
    else if (target === "RECHAZADA") setDialog({ mode: "reject", applicantId: applicant.id });
    else if (applicant.status === "ACEPTADA" || applicant.status === "RECHAZADA") setDialog({ mode: "reopen", applicantId: applicant.id });
    else void changeStage(applicant, target);
  };

  const dialogApplicant = dialog ? list.find((item) => item.id === dialog.applicantId) ?? null : null;
  const openApplicant = openId ? list.find((item) => item.id === openId) ?? null : null;

  const onDrop = (event: DragEvent, column: (typeof columns)[number]) => {
    event.preventDefault();
    setDropTarget(null);
    const id = Number(event.dataTransfer.getData("text/plain") || dragging);
    setDragging(null);
    const applicant = list.find((item) => item.id === id);
    if (!applicant || !column.drop || column.stages.includes(applicant.status)) return;
    requestMove(applicant, column.drop);
  };

  const navBar = <NavBar role="company" navigate={navigate} activeScreen="company-applicants" userName={company} />;

  if (!offer) {
    return (
      <div className="app-shell">
        {navBar}
        <main className="container applicants-page">
          <h1 className="display applicants-picker-title">Postulantes</h1>
          <p className="muted">Elige una oferta para gestionar su proceso de selección.</p>
          {loadError && <div className="form-error" role="alert">{loadError}</div>}
          {myOffers === null ? (
            <p className="muted" role="status">Cargando ofertas...</p>
          ) : myOffers.length === 0 ? (
            <div className="empty-vivo">
              <ArdyMark className="empty-vivo-ardy" />
              <h2>Aún no has publicado ofertas</h2>
              <button className="button primary" onClick={() => navigate("company-dashboard")}>Crear una oferta</button>
            </div>
          ) : (
            <ul className="applicants-offer-picker">
              {myOffers.map((item) => (
                <li key={item.id}>
                  <button className="panel-card interactive" onClick={() => navigate("company-applicants", { selectedCompanyOffer: item, applicantFilter: "Todos" })}>
                    <TypeBadge type={item.offerType} />
                    <span><strong>{item.title}</strong><small>{item.city} · {item.modality} · Cierra {formatDate(item.closeDate, "sin fecha")}</small></span>
                    <IconArrowRight size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {navBar}
      <main className="container applicants-page">
        <button className="back-link" onClick={() => navigate("company-applicants", { selectedCompanyOffer: null })}><IconArrowRight className="back-link-icon" size={18} />Mis ofertas</button>

        <section className="hero-card applicants-hero">
          <div className="dots company-hero-dots" aria-hidden="true" />
          <div className="applicants-hero-main">
            <div className="applicants-hero-badges"><TypeBadge type={offer.offerType} /><span className="applicants-hero-close"><IconCalendar size={15} />Cierra {formatDate(offer.closeDate, "sin fecha")}</span></div>
            <h1 className="display">{offer.title}</h1>
            <p>{applicants === null ? "Cargando candidatos..." : list.length === 1 ? "1 candidato en el proceso" : `${list.length} candidatos en el proceso`}</p>
          </div>
          <div className="applicants-vacancies" role="img" aria-label={`${accepted} de ${vacancies} ${vacancies === 1 ? "vacante cubierta" : "vacantes cubiertas"}`}>
            <strong>{accepted}/{vacancies}</strong>
            <span>{training ? (vacancies === 1 ? "cupo asignado" : "cupos asignados") : (vacancies === 1 ? "vacante cubierta" : "vacantes cubiertas")}</span>
            <div className="applicants-vacancies-track"><div style={{ width: `${Math.min(100, Math.round((accepted / vacancies) * 100))}%` }} /></div>
          </div>
        </section>

        {loadError && <div className="form-error" role="alert">{loadError}</div>}
        {paused && (
          <p className="applicants-paused" role="status">Esta oferta está en <strong>Canceladas</strong>. Su proceso está en pausa: puedes revisar a los candidatos y su historial, pero no moverlos de etapa. Restáurala desde tu panel para continuar.</p>
        )}

        <div className="applicants-toolbar">
          <label className="applicants-search">
            <IconSearch size={18} />
            <input type="search" placeholder="Buscar por nombre, carrera o habilidad" aria-label="Buscar candidatos" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="applicants-sort">
            <span>Ordenar</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="recent">Más recientes</option>
              {offerSkills.length > 0 && <option value="match">Mayor coincidencia</option>}
              <option value="rating">Mejor calificados</option>
            </select>
          </label>
          <div className="applicants-view" role="group" aria-label="Vista">
            <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}><IconGrid size={16} />Tablero</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><IconMenu size={16} />Lista</button>
          </div>
        </div>

        {applicants !== null && list.length === 0 && (
          <div className="empty-vivo">
            <ArdyMark className="empty-vivo-ardy" />
            <h2>Aún no hay postulaciones</h2>
            <p>Cuando alguien se postule aparecerá en la columna Nuevas. Compartir la oferta ayuda a recibir candidatos.</p>
          </div>
        )}

        {list.length > 0 && view === "board" && (
          <div className="pipeline-board" aria-label="Tablero del proceso de selección">
            {columns.map((column) => {
              const items = visible.filter((item) => column.stages.includes(item.status));
              const draggedApplicant = dragging ? list.find((item) => item.id === dragging) : null;
              const canDrop = Boolean(draggedApplicant && column.drop && !column.stages.includes(draggedApplicant.status) && !transitionBlockedReason(draggedApplicant.status, column.drop, offer.offerType));
              return (
                <section
                  key={column.id}
                  className={`pipeline-column tone-col-${column.tone} ${dropTarget === column.id ? (canDrop ? "is-drop-ok" : "is-drop-blocked") : ""}`}
                  aria-labelledby={`col-${column.id}`}
                  onDragOver={(event) => { if (dragging) { event.preventDefault(); setDropTarget(column.id); } }}
                  onDragLeave={() => setDropTarget((current) => current === column.id ? null : current)}
                  onDrop={(event) => onDrop(event, column)}
                >
                  <header>
                    <h2 id={`col-${column.id}`}><span className={`stage-dot tone-${column.tone}`} aria-hidden="true" />{column.title}</h2>
                    <span className="pipeline-count" aria-label={`${items.length} candidatos`}>{items.length}</span>
                  </header>
                  {items.length === 0 ? <p className="pipeline-empty">{column.empty}</p> : (
                    <ul>
                      {items.map((item) => (
                        <li key={item.id}>
                          <ApplicantCard
                            applicant={item}
                            offerSkills={offerSkills}
                            training={training}
                            offerType={offer.offerType}
                            dragging={dragging === item.id}
                            locked={paused}
                            onOpen={() => setOpenId(item.id)}
                            onMove={(target) => requestMove(item, target)}
                            onDragStart={(event) => { event.dataTransfer.setData("text/plain", String(item.id)); event.dataTransfer.effectAllowed = "move"; setDragging(item.id); }}
                            onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {list.length > 0 && view === "list" && (
          <ul className="applicants-list">
            {visible.map((item) => (
              <li key={item.id}>
                <ApplicantCard applicant={item} offerSkills={offerSkills} training={training} offerType={offer.offerType} wide locked={paused}
                  onOpen={() => setOpenId(item.id)} onMove={(target) => requestMove(item, target)} />
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && visible.length === 0 && <p className="muted" role="status">Ningún candidato coincide con "{query}".</p>}
      </main>

      {openApplicant && (
        <ApplicantDrawer
          applicant={openApplicant}
          offerSkills={offerSkills}
          training={training}
          offerType={offer.offerType}
          token={state.token}
          authorName={state.currentUser?.nombreCompleto ?? company}
          onClose={() => setOpenId(null)}
          locked={paused}
          onMove={(target) => requestMove(openApplicant, target)}
          onChanged={(changes) => replaceApplicant(openApplicant.id, changes)}
          onError={(text) => setToast({ text, tone: "error" })}
        />
      )}

      {dialog && dialogApplicant && (
        <StageDialog
          mode={dialog.mode}
          applicant={dialogApplicant}
          company={company}
          isTraining={training}
          vacancies={vacancies}
          accepted={accepted}
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={(status, change) => void changeStage(dialogApplicant, status, change)}
        />
      )}

      <div className={`applicants-toast ${toast ? `is-visible is-${toast.tone}` : ""}`} role="status" aria-live="polite">
        {toast && <>{toast.tone === "ok" ? <IconCheck size={18} /> : <IconClose size={18} />}{toast.text}</>}
      </div>
    </div>
  );
}

type CardProps = {
  applicant: Applicant;
  offerSkills: string[];
  training: boolean;
  offerType?: string;
  wide?: boolean;
  // Sin menú ni arrastre (oferta cancelada).
  locked?: boolean;
  dragging?: boolean;
  onOpen: () => void;
  onMove: (target: Stage) => void;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: () => void;
};

function ApplicantCard({ applicant, offerSkills, training, offerType, wide, locked, dragging, onOpen, onMove, onDragStart, onDragEnd }: CardProps) {
  const match = skillMatch(applicant.skills, offerSkills);
  const options = locked ? [] : allowedTransitions(applicant.status, offerType).filter((target) => target !== "PRESELECCIONADA" || applicant.status !== "PRESELECCIONADA");
  return (
    <article className={`applicant-card ${wide ? "is-wide" : ""} ${dragging ? "is-dragging" : ""} ${applicant.status === "RETIRADA" ? "is-withdrawn" : ""}`}
      draggable={Boolean(onDragStart) && !locked && applicant.status !== "RETIRADA"} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="applicant-card-head">
        <span className="applicant-avatar" aria-hidden="true">{initials(applicant.name)}</span>
        <div className="applicant-card-id">
          <button type="button" className="applicant-name" onClick={onOpen} aria-label={`Ver perfil de ${applicant.name}`}>{applicant.name}</button>
          <small>{applicant.profileType === "ESTUDIANTE" ? "Estudiante" : "Profesional"}{applicant.career ? ` · ${applicant.career}` : ""}</small>
        </div>
        {applicant.rating ? <span className="applicant-rating" aria-label={`Calificación ${applicant.rating} de 5`}>★ {applicant.rating}</span> : null}
      </div>

      <div className="applicant-card-tags">
        <span className={`stage-pill tone-pill-${STAGE_TONE[applicant.status]}`}>{applicant.status === "ACEPTADA" && training ? "Inscrito" : STAGE_LABELS[applicant.status]}</span>
        {match.percent !== null && <span className="match-pill" title={`Coincide en ${match.matched.length} de ${offerSkills.length} habilidades`}>{match.percent}% coincidencia</span>}
        {applicant.cv && <span className="cv-pill"><IconFile size={13} />CV</span>}
        <span className="applicant-age">{daysAgo(applicant.appliedAt)}</span>
      </div>

      {applicant.status === "PRESELECCIONADA" && applicant.interview && (
        <p className="applicant-interview"><IconCalendar size={14} />{formatInterviewDate(applicant.interview.fecha)}</p>
      )}

      {options.length > 0 && (
        <label className="applicant-move">
          <span className="sr-only">Mover a {applicant.name}</span>
          <select value="" aria-label={`Mover a ${applicant.name}`} onChange={(event) => { if (event.target.value) onMove(event.target.value as Stage); }}>
            <option value="">Mover a…</option>
            {options.map((target) => <option key={target} value={target}>{moveLabel(applicant.status, target, training)}</option>)}
          </select>
        </label>
      )}
    </article>
  );
}

type DrawerProps = {
  applicant: Applicant;
  offerSkills: string[];
  training: boolean;
  offerType?: string;
  token: string | null;
  authorName: string;
  onClose: () => void;
  onMove: (target: Stage) => void;
  onChanged: (changes: Partial<Applicant>) => void;
  onError: (text: string) => void;
  locked?: boolean;
};

function ApplicantDrawer({ applicant, offerSkills, training, offerType, token, authorName, onClose, onMove, onChanged, onError, locked }: DrawerProps) {
  const [tab, setTab] = useState<"cv" | "activity">("cv");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const match = skillMatch(applicant.skills, offerSkills);
  const actions = allowedTransitions(applicant.status, offerType);
  // Acción principal según la etapa; el resto queda como secundaria.
  const orderedPrimary = PRIMARY_ACTION[applicant.status]?.(training);
  const secondary = actions.filter((target) => target !== orderedPrimary);

  useEffect(() => {
    heading.current?.focus();
    // Con un diálogo abierto encima, Escape cierra solo el diálogo.
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector(".modal-backdrop")) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rate = async (value: number) => {
    if (!token) return;
    const next = applicant.rating === value ? null : value;
    onChanged({ rating: next });
    try {
      await applicationsApi.rateApplication(applicant.id, next, token);
    } catch (error) {
      onChanged({ rating: applicant.rating });
      onError(error instanceof Error ? error.message : "No se pudo guardar la calificación.");
    }
  };

  const saveNote = async () => {
    if (!token || note.trim().length < 2) return;
    setSavingNote(true);
    try {
      const response = await applicationsApi.addApplicationNote(applicant.id, note.trim(), token);
      const [event] = toEvents([response.event]);
      onChanged({ events: [...applicant.events, { ...event, privado: true, autorRol: "EMPRESA", autor: authorName }] });
      setNote("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo guardar la nota.");
    } finally {
      setSavingNote(false);
    }
  };

  const openCv = () => token && void applicationsApi.openApplicationCv(applicant.id, token).catch((error) => onError(error instanceof Error ? error.message : "No se pudo abrir la hoja de vida."));

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="applicant-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="applicant-drawer-head">
          <span className="applicant-avatar lg" aria-hidden="true">{initials(applicant.name)}</span>
          <div>
            <h2 id="drawer-title" tabIndex={-1} ref={heading}>{applicant.name}</h2>
            <p>{applicant.profileType === "ESTUDIANTE" ? "Estudiante" : "Profesional"}{applicant.career ? ` · ${applicant.career}` : ""}{applicant.semester ? ` · ${applicant.semester}° semestre` : ""}</p>
            <div className="applicant-contact">
              {applicant.email && <a href={`mailto:${applicant.email}`}><IconMail size={15} />{applicant.email}</a>}
              {applicant.phone && <a href={`tel:${applicant.phone.replace(/\s/g, "")}`}><IconUser size={15} />{applicant.phone}</a>}
              {applicant.city && <span><IconPin size={15} />{applicant.city}</span>}
            </div>
          </div>
          <button type="button" className="drawer-close" aria-label="Cerrar perfil" onClick={onClose}><IconClose size={20} /></button>
        </header>

        <div className="applicant-drawer-stage">
          <span className={`stage-pill tone-pill-${STAGE_TONE[applicant.status]}`}>{applicant.status === "ACEPTADA" && training ? "Inscrito" : STAGE_LABELS[applicant.status]}</span>
          <div className="rating" role="group" aria-label="Calificación interna">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" aria-pressed={(applicant.rating ?? 0) >= value} aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`} onClick={() => void rate(value)}>★</button>
            ))}
          </div>
        </div>

        {applicant.status === "PRESELECCIONADA" && applicant.interview && (
          <div className="drawer-interview">
            <IconCalendar size={18} />
            <span><strong>Entrevista {INTERVIEW_MODE_LABELS[applicant.interview.modalidad].toLowerCase()}</strong>{formatInterviewDate(applicant.interview.fecha)}{applicant.interview.lugar ? ` · ${applicant.interview.lugar}` : ""}</span>
          </div>
        )}

        {locked ? (
          <p className="drawer-note">La oferta está cancelada: el proceso está en pausa. Puedes consultar la hoja de vida, el historial y agregar notas.</p>
        ) : applicant.status === "RETIRADA" ? (
          <p className="drawer-note">El candidato retiró su postulación. Su historial se conserva.</p>
        ) : (
          <div className="drawer-actions">
            {orderedPrimary && actions.includes(orderedPrimary) && (
              <button type="button" className={`button primary ${orderedPrimary === "ACEPTADA" ? "success" : ""}`} onClick={() => onMove(orderedPrimary)}>{moveLabel(applicant.status, orderedPrimary, training)}</button>
            )}
            {secondary.map((target) => (
              <button key={target} type="button" className={`button secondary ${target === "RECHAZADA" ? "danger-outline" : ""}`} onClick={() => onMove(target)}>{moveLabel(applicant.status, target, training)}</button>
            ))}
          </div>
        )}

        <div className="drawer-tabs" role="tablist" aria-label="Información del candidato">
          <button type="button" role="tab" id="tab-cv" aria-selected={tab === "cv"} aria-controls="panel-cv" onClick={() => setTab("cv")}>Hoja de vida</button>
          <button type="button" role="tab" id="tab-activity" aria-selected={tab === "activity"} aria-controls="panel-activity" onClick={() => setTab("activity")}>Actividad y notas ({applicant.events.length})</button>
        </div>

        {tab === "cv" ? (
          <div className="drawer-panel" role="tabpanel" id="panel-cv" aria-labelledby="tab-cv">
            <div className="sent-cv">
              <span className="sent-cv-icon" aria-hidden="true"><IconFile size={18} /></span>
              <span className="sent-cv-text">
                {applicant.cv ? (
                  <><strong>{applicant.cv.nombre}</strong><small>{applicant.cv.origen === "PROPIO" ? "Subida para esta oferta" : "Copia de su perfil al postularse"} · {formatSize(applicant.cv.tamano)}</small></>
                ) : <><strong>Sin hoja de vida PDF</strong><small>Se postuló solo con su perfil SIPU.</small></>}
              </span>
              {applicant.cv && <button type="button" className="button secondary" onClick={openCv}>Ver hoja de vida</button>}
            </div>
            {applicant.cvUrl && <a className="text-button" href={applicant.cvUrl} target="_blank" rel="noreferrer">Abrir enlace de hoja de vida</a>}

            {applicant.coverLetter && (
              <section className="drawer-section"><h3>Mensaje del candidato</h3><blockquote className="company-message"><p>{applicant.coverLetter}</p></blockquote></section>
            )}

            {match.percent !== null && (
              <section className="drawer-section">
                <h3>Coincidencia con la oferta: {match.percent}%</h3>
                <ul className="skill-chips">
                  {match.matched.map((skill) => <li key={skill} className="skill-chip has"><IconCheck size={14} />{skill}</li>)}
                  {match.missing.map((skill) => <li key={skill} className="skill-chip missing">{skill}<span className="sr-only"> (no la tiene)</span></li>)}
                </ul>
              </section>
            )}

            <section className="drawer-section">
              <h3>Habilidades</h3>
              {applicant.skills.length ? <ul className="skill-chips">{applicant.skills.map((skill) => <li key={skill} className="skill-chip">{skill}</li>)}</ul> : <p className="muted">No registró habilidades.</p>}
            </section>
            <section className="drawer-section">
              <h3>Formación</h3>
              {applicant.university && <p><strong>{applicant.career || "Programa no reportado"}</strong> · {applicant.university}</p>}
              {applicant.education.length ? applicant.education.map((item, index) => <p key={index}><strong>{item.titulo}</strong> · {item.institucion} · {item.periodo}</p>) : !applicant.university && <p className="muted">No registró formación.</p>}
            </section>
            <section className="drawer-section">
              <h3>Experiencia</h3>
              {applicant.experience.length ? applicant.experience.map((item, index) => (
                <div key={index} className="drawer-experience"><strong>{item.cargo} · {item.empresa}</strong><small>{item.periodo}</small>{item.descripcion && <p>{item.descripcion}</p>}</div>
              )) : <p className="muted">No registró experiencia.</p>}
            </section>
            {(applicant.summary || applicant.availability) && (
              <section className="drawer-section">
                <h3>Resumen</h3>
                {applicant.summary && <p>{applicant.summary}</p>}
                {applicant.availability && <p className="muted">Disponibilidad: {applicant.availability}</p>}
              </section>
            )}
            <p className="drawer-footnote">Datos con los que se postuló el {formatDate(applicant.appliedAt)}. El contacto es el vigente del perfil.</p>
          </div>
        ) : (
          <div className="drawer-panel" role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
            <div className="note-composer">
              <label htmlFor="note-text" className="vf-label"><IconLock size={15} /> Nota interna</label>
              <textarea id="note-text" rows={3} maxLength={1000} value={note} placeholder="Solo la ve tu equipo. Ej.: Buen nivel técnico, validar disponibilidad." onChange={(event) => setNote(event.target.value)} />
              <button type="button" className="button secondary" disabled={savingNote || note.trim().length < 2} onClick={() => void saveNote()}>{savingNote ? "Guardando..." : "Guardar nota"}</button>
            </div>
            <ol className="timeline">
              {[...applicant.events].reverse().map((event) => (
                <li key={event.id} className={`timeline-item timeline-${event.tipo.toLowerCase()} ${event.privado ? "is-private" : ""}`}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{event.privado && <IconLock size={13} />}{describeEvent(event, "company")}</strong>
                    <time dateTime={event.fecha}>{formatDate(event.fecha)}{event.autor ? ` · ${event.autor}` : ""}</time>
                    {event.entrevista && <p>{formatInterviewDate(event.entrevista.fecha)} · {INTERVIEW_MODE_LABELS[event.entrevista.modalidad]}{event.entrevista.lugar ? ` · ${event.entrevista.lugar}` : ""}</p>}
                    {event.mensaje && <p className="timeline-message">{event.tipo === "CV" ? event.mensaje : `“${event.mensaje}”`}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
