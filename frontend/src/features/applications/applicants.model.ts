// Proceso de selección visto por la empresa: etapas, columnas del tablero,
// transiciones permitidas (las mismas del backend, applications.domain.js;
// test/contracts.test.ts lo comprueba) y conversión de los postulantes de la API.
import { toEvents, toInterview, toSentCv, type ApplicationEvent, type Interview, type SentCv } from "./applications.model";

export type Stage = "ENVIADA" | "EN_REVISION" | "PRESELECCIONADA" | "ACEPTADA" | "RECHAZADA" | "RETIRADA";
export const STAGES: Stage[] = ["ENVIADA", "EN_REVISION", "PRESELECCIONADA", "ACEPTADA", "RECHAZADA", "RETIRADA"];

export const STAGE_LABELS: Record<Stage, string> = {
  ENVIADA: "Nueva",
  EN_REVISION: "En revisión",
  PRESELECCIONADA: "Entrevista",
  ACEPTADA: "Seleccionado",
  RECHAZADA: "Descartado",
  RETIRADA: "Retirada",
};

const SELECTION_PIPELINE: Record<Stage, Stage[]> = {
  ENVIADA: ["EN_REVISION", "PRESELECCIONADA", "RECHAZADA"],
  EN_REVISION: ["PRESELECCIONADA", "RECHAZADA"],
  PRESELECCIONADA: ["PRESELECCIONADA", "ACEPTADA", "RECHAZADA", "EN_REVISION"],
  ACEPTADA: ["EN_REVISION"],
  RECHAZADA: ["EN_REVISION"],
  RETIRADA: [],
};

const TRAINING_PIPELINE: Record<Stage, Stage[]> = {
  ENVIADA: ["EN_REVISION", "ACEPTADA", "RECHAZADA"],
  EN_REVISION: ["ACEPTADA", "RECHAZADA"],
  PRESELECCIONADA: ["ACEPTADA", "RECHAZADA", "EN_REVISION"],
  ACEPTADA: ["EN_REVISION"],
  RECHAZADA: ["EN_REVISION"],
  RETIRADA: [],
};

export const isTrainingOffer = (offerType: unknown) => String(offerType ?? "").toUpperCase() === "FORMACION";

export function allowedTransitions(current: Stage, offerType?: unknown): Stage[] {
  return (isTrainingOffer(offerType) ? TRAINING_PIPELINE : SELECTION_PIPELINE)[current] ?? [];
}

// Por qué no se puede pasar a `next` (el mismo texto que da la API), o null.
export function transitionBlockedReason(current: Stage, next: Stage, offerType?: unknown): string | null {
  if (allowedTransitions(current, offerType).includes(next)) return null;
  if (current === "RETIRADA") return "El candidato retiró esta postulación.";
  if (current === next) return "La postulación ya está en esa etapa.";
  if (next === "ACEPTADA" && (current === "ENVIADA" || current === "EN_REVISION")) return "Antes de aceptar a un candidato debes citarlo a entrevista.";
  if (current === "ACEPTADA" || current === "RECHAZADA") return "Esta postulación ya tiene una decisión. Vuelve a abrir el proceso (pasarla a revisión) antes de cambiarla.";
  if (next === "PRESELECCIONADA") return "Las ofertas de formación no tienen etapa de entrevista.";
  if (next === "ENVIADA") return "Una postulación no puede volver a la etapa de recibida.";
  return "Ese cambio de etapa no está permitido.";
}

// Columnas del tablero. "Descartados" agrupa rechazadas y retiradas.
export type Column = { id: string; title: string; stages: Stage[]; drop: Stage | null; tone: string; empty: string };

export function boardColumns(offerType?: unknown): Column[] {
  const training = isTrainingOffer(offerType);
  return [
    { id: "nuevas", title: "Nuevas", stages: ["ENVIADA"], drop: null, tone: "sent", empty: "Aquí llegan las postulaciones nuevas." },
    { id: "revision", title: "En revisión", stages: ["EN_REVISION"], drop: "EN_REVISION", tone: "review", empty: "Arrastra aquí a quien estés evaluando." },
    ...(training ? [] : [{ id: "entrevista", title: "Entrevista", stages: ["PRESELECCIONADA"] as Stage[], drop: "PRESELECCIONADA" as Stage, tone: "interview", empty: "Cita a entrevista a los mejores perfiles." }]),
    { id: "seleccionados", title: training ? "Inscritos" : "Seleccionados", stages: ["ACEPTADA"], drop: "ACEPTADA", tone: "accepted", empty: training ? "Acepta las inscripciones que cumplan el perfil." : "Quienes pasen la entrevista." },
    { id: "descartados", title: "Descartados", stages: ["RECHAZADA", "RETIRADA"], drop: "RECHAZADA", tone: "rejected", empty: "Candidatos descartados o que retiraron su postulación." },
  ];
}

export type Applicant = {
  id: number;
  name: string;
  email: string;
  phone: string;
  profileType: "ESTUDIANTE" | "CANDIDATO_EXTERNO";
  career: string;
  semester: number | null;
  university: string;
  city: string;
  availability: string;
  summary: string;
  cvUrl: string;
  cv: SentCv | null;
  coverLetter: string;
  education: { titulo: string; institucion: string; periodo: string }[];
  experience: { cargo: string; empresa: string; periodo: string; descripcion?: string | null }[];
  skills: string[];
  appliedAt: string;
  status: Stage;
  interview: Interview | null;
  rating: number | null;
  events: ApplicationEvent[];
};

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export const mapApplicant = (item: any): Applicant => ({
  id: Number(item.id),
  name: text(item.postulante_nombre) || "Candidato",
  email: text(item.postulante_email),
  phone: text(item.postulante_telefono),
  profileType: item.perfil_tipo === "CANDIDATO_EXTERNO" ? "CANDIDATO_EXTERNO" : "ESTUDIANTE",
  career: text(item.programa_academico),
  semester: item.semestre ? Number(item.semestre) : null,
  university: text(item.universidad),
  city: text(item.candidato_ubicacion),
  availability: text(item.disponibilidad),
  summary: text(item.resumen),
  cvUrl: text(item.cv_url),
  cv: toSentCv(item),
  coverLetter: text(item.carta_presentacion).startsWith("Postulación a ") ? "" : text(item.carta_presentacion),
  education: Array.isArray(item.educacion) ? item.educacion : [],
  experience: Array.isArray(item.experiencia) ? item.experiencia : [],
  skills: Array.isArray(item.habilidades) ? item.habilidades.map(String) : [],
  appliedAt: text(item.created_at),
  status: (STAGES.includes(item.estado) ? item.estado : "ENVIADA") as Stage,
  interview: toInterview(item.entrevista),
  rating: item.calificacion == null ? null : Number(item.calificacion),
  events: toEvents(item.eventos),
});

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Coincidencia de habilidades del candidato con las de la oferta (null si la
// oferta no tiene habilidades para comparar).
export function skillMatch(candidateSkills: string[], offerSkills: string[] = []): { matched: string[]; missing: string[]; percent: number | null } {
  if (offerSkills.length === 0) return { matched: [], missing: [], percent: null };
  const mine = candidateSkills.map(plain).filter(Boolean);
  const has = (skill: string) => mine.some((value) => value === plain(skill) || value.includes(plain(skill)) || plain(skill).includes(value));
  const matched = offerSkills.filter(has);
  return { matched, missing: offerSkills.filter((skill) => !has(skill)), percent: Math.round((matched.length / offerSkills.length) * 100) };
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "C";

// Días desde la postulación, en texto: "hoy", "hace 1 día", "hace 5 días".
export function daysAgo(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  return days <= 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export type SortKey = "recent" | "match" | "rating";

export function sortApplicants(list: Applicant[], key: SortKey, offerSkills: string[] = []): Applicant[] {
  const copy = [...list];
  if (key === "match") return copy.sort((a, b) => (skillMatch(b.skills, offerSkills).percent ?? 0) - (skillMatch(a.skills, offerSkills).percent ?? 0));
  if (key === "rating") return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return copy.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
}

// Plantillas de mensaje para el candidato según la decisión.
export const REJECTION_TEMPLATES = [
  { id: "perfil", label: "El perfil no se ajusta", text: "Gracias por tu interés. Después de revisar tu postulación, decidimos continuar con candidatos cuyo perfil se ajusta más a lo que buscamos en este momento." },
  { id: "cubierta", label: "La vacante ya se cubrió", text: "Gracias por postularte. Te contamos que la vacante ya fue cubierta. Te invitamos a seguir atento a nuestras próximas ofertas en SIPU." },
  { id: "entrevista", label: "Después de la entrevista", text: "Gracias por tu tiempo en la entrevista. En esta ocasión elegimos a otra persona para el cargo, pero valoramos mucho tu participación." },
  { id: "otro", label: "Escribir mi propio mensaje", text: "" },
];

export const interviewMessageTemplate = (name: string, company: string) =>
  `Hola ${name.split(/\s+/)[0] ?? name}, en ${company} queremos conocerte. Te esperamos en la entrevista; si no puedes asistir, escríbenos para buscar otra fecha.`;

export const acceptanceMessageTemplate = (name: string, isTraining: boolean) =>
  isTraining
    ? `Hola ${name.split(/\s+/)[0] ?? name}, tu inscripción fue aceptada. Pronto te enviaremos la información de inicio.`
    : `¡Felicitaciones, ${name.split(/\s+/)[0] ?? name}! Fuiste seleccionado. Te contactaremos en los próximos días para los siguientes pasos.`;
