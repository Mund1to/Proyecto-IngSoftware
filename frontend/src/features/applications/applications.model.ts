// Modelo de postulaciones en el frontend: estados, historial del proceso de
// selección, entrevista y hoja de vida enviada, y la conversión de las filas de la API.
import type { OfferType } from "../offers/offers.model";

export type ApplicationStatus = "Enviada" | "En revisión" | "Entrevista" | "Aceptada" | "Rechazada" | "Retirada";

// Estado del backend (postulaciones.estado) al texto que ve el candidato.
// PRESELECCIONADA es la etapa de entrevista en el flujo de la empresa.
export function mapApplicationStatus(status?: string): ApplicationStatus {
  switch (status) {
    case "EN_REVISION":
      return "En revisión";
    case "PRESELECCIONADA":
      return "Entrevista";
    case "ACEPTADA":
      return "Aceptada";
    case "RECHAZADA":
      return "Rechazada";
    case "RETIRADA":
      return "Retirada";
    default:
      return "Enviada";
  }
}

// Debe coincidir con INTERVIEW_MODES del backend (applications.domain.js).
export type InterviewMode = "PRESENCIAL" | "VIRTUAL" | "TELEFONICA";
export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  TELEFONICA: "Telefónica",
};

export type Interview = { fecha: string; modalidad: InterviewMode; lugar: string | null; duracionMinutos: number | null };

export type ApplicationEventType = "POSTULACION" | "ESTADO" | "ENTREVISTA" | "NOTA" | "RETIRO" | "CV" | "OFERTA";
export type ApplicationEvent = {
  id: number;
  tipo: ApplicationEventType;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  mensaje: string | null;
  privado: boolean;
  entrevista: Interview | null;
  fecha: string;
  autorRol: "CANDIDATO" | "EMPRESA";
  // Solo lo recibe la empresa: quién de su equipo hizo el cambio.
  autor?: string | null;
};

export type SentCv = { nombre: string; tamano: number; origen: "PERFIL" | "PROPIO"; fecha: string };

export type Application = {
  id: number;
  offerId: number;
  offerTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus;
  offerType?: OfferType;
  // Estado de la oferta (CANCELADA si la empresa la mandó a la papelera).
  offerStatus?: string;
  coverLetter?: string | null;
  // Hoja de vida enviada con la postulación (null si se envió sin ella).
  cv?: SentCv | null;
  interview?: Interview | null;
  events?: ApplicationEvent[];
};

export function toInterview(value: any): Interview | null {
  if (!value || typeof value !== "object" || !value.fecha) return null;
  return {
    fecha: String(value.fecha),
    modalidad: (value.modalidad ?? "VIRTUAL") as InterviewMode,
    lugar: value.lugar ?? null,
    duracionMinutos: value.duracionMinutos == null ? null : Number(value.duracionMinutos),
  };
}

export const toEvents = (value: unknown): ApplicationEvent[] => (Array.isArray(value)
  ? value.map((event: any) => ({
    id: Number(event.id),
    tipo: event.tipo,
    estadoAnterior: event.estadoAnterior ?? null,
    estadoNuevo: event.estadoNuevo ?? null,
    mensaje: event.mensaje ?? null,
    privado: Boolean(event.privado),
    entrevista: toInterview(event.entrevista),
    fecha: String(event.fecha ?? ""),
    autorRol: event.autorRol === "CANDIDATO" ? "CANDIDATO" : "EMPRESA",
    ...(event.autor !== undefined ? { autor: event.autor } : {}),
  }))
  : []);

export function toSentCv(item: any): SentCv | null {
  if (!item?.tiene_cv) return null;
  return { nombre: item.cv_nombre ?? "hoja-de-vida.pdf", tamano: Number(item.cv_tamano ?? 0), origen: item.cv_origen === "PROPIO" ? "PROPIO" : "PERFIL", fecha: String(item.cv_fecha ?? item.created_at ?? "") };
}

// Todas las postulaciones del candidato, sin importar el tipo de oferta: un
// estudiante puede postularse a un empleo y un externo a una práctica.
export const mapApiApplications = (items: any[]): Application[] => items.map((item) => ({
  id: Number(item.id),
  offerId: Number(item.oferta_id),
  offerTitle: item.oferta_titulo ?? "Oferta",
  company: item.empresa ?? "Empresa",
  appliedDate: String(item.created_at ?? new Date().toISOString()).slice(0, 10),
  status: mapApplicationStatus(item.estado),
  offerType: item.oferta_tipo,
  ...(item.oferta_estado ? { offerStatus: String(item.oferta_estado) } : {}),
  coverLetter: item.carta_presentacion ?? null,
  cv: toSentCv(item),
  interview: toInterview(item.entrevista),
  events: toEvents(item.eventos),
}));

// Fecha y hora de una entrevista en Colombia: "martes, 10 de noviembre, 3:00 p. m.".
export function formatInterviewDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(date);
}

// Título de un evento del historial según quién lo lee.
export function describeEvent(event: ApplicationEvent, viewer: "candidate" | "company"): string {
  const mine = viewer === "candidate";
  switch (event.tipo) {
    case "POSTULACION":
      return mine ? "Te postulaste" : "Se postuló";
    case "RETIRO":
      return mine ? "Retiraste la postulación" : "El candidato retiró la postulación";
    case "CV":
      return mine ? "Cambiaste la hoja de vida enviada" : "El candidato cambió la hoja de vida enviada";
    case "NOTA":
      return "Nota interna";
    case "OFERTA":
      return mine ? "La empresa canceló la oferta" : "Oferta cancelada";
    case "ENTREVISTA":
      if (event.estadoAnterior === "PRESELECCIONADA") return "Entrevista reprogramada";
      return mine ? "Te citaron a entrevista" : "Citado a entrevista";
    default: {
      const reopened = event.estadoNuevo === "EN_REVISION" && (event.estadoAnterior === "ACEPTADA" || event.estadoAnterior === "RECHAZADA");
      if (reopened) return mine ? "La empresa reabrió tu proceso" : "Proceso reabierto";
      if (event.estadoNuevo === "EN_REVISION" && event.estadoAnterior === "PRESELECCIONADA") return mine ? "Volviste a la etapa de revisión" : "Regresó a revisión";
      switch (event.estadoNuevo) {
        case "EN_REVISION":
          return mine ? "La empresa empezó a revisar tu postulación" : "Pasó a revisión";
        case "ACEPTADA":
          return mine ? "¡Fuiste seleccionado!" : "Candidato aceptado";
        case "RECHAZADA":
          return mine ? "La empresa no continuará con tu postulación" : "Candidato descartado";
        default:
          return "Cambio de etapa";
      }
    }
  }
}

// Último mensaje de la empresa para el candidato (si lo hay). El motivo de una
// oferta cancelada se muestra aparte, en el aviso de cancelación.
export const lastCompanyMessage = (events: ApplicationEvent[] = []) =>
  [...events].reverse().find((event) => event.autorRol === "EMPRESA" && !event.privado && event.mensaje && event.tipo !== "OFERTA");
