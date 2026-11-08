// Modelo de ofertas en el frontend: tipos, etiquetas y la conversión de las filas
// de la API (claves en español: titulo, descripcion...) al formato de las pantallas.
// Las pantallas también toleran nombres alternativos en inglés.
import { companyInitials, formatSalary, toNumberOrZero } from "../../shared/lib/format";

export type Modality = "Presencial" | "Remota" | "Híbrida";

// Convierte cualquier variante ("hibrido", "REMOTO", "H�brida") a una de las tres
// modalidades conocidas. Un valor desconocido rompía las tarjetas del catálogo.
export function normalizeModality(value: unknown): Modality {
  const simple = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (simple.startsWith("presencial")) return "Presencial";
  if (simple.startsWith("remot") || simple === "virtual") return "Remota";
  return "Híbrida";
}

// Debe coincidir con OFFER_TYPES del backend (src/modules/offers/offers.domain.js);
// test/contracts.test.ts lo comprueba.
export type OfferType = "PRACTICA" | "EMPLEO" | "EMPLEO_PUBLICO" | "FORMACION";

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  PRACTICA: "Práctica",
  EMPLEO: "Empleo",
  EMPLEO_PUBLICO: "Empleo público",
  FORMACION: "Formación",
};

export const offerTypeLabel = (value: unknown) => OFFER_TYPE_LABELS[value as OfferType] ?? "Oferta";

// Quién ve cada tipo de oferta. Las prácticas son solo para estudiantes de la
// universidad; el resto también llega a la bolsa de profesionales externos.
export const EXTERNAL_OFFER_TYPES: OfferType[] = ["EMPLEO", "EMPLEO_PUBLICO", "FORMACION"];
export const isExternalOfferType = (value: unknown) => EXTERNAL_OFFER_TYPES.includes(value as OfferType);
export const OFFER_AUDIENCE: Record<OfferType, string> = {
  PRACTICA: "Solo estudiantes de la universidad.",
  EMPLEO: "Estudiantes, egresados y profesionales externos.",
  EMPLEO_PUBLICO: "Estudiantes, egresados y profesionales externos.",
  FORMACION: "Estudiantes, egresados y profesionales externos.",
};

// Fase 8: requisitos y condiciones como opciones. Deben coincidir con
// EXPERIENCE_LEVELS, WORK_SCHEDULES y LANGUAGE_LEVELS del backend
// (src/modules/offers/offers.domain.js); test/contracts.test.ts lo comprueba.
export type ExperienceLevel = "NINGUNA" | "MENOS_1" | "DE_1_A_2" | "DE_3_A_5" | "MAS_5";
export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  NINGUNA: "Sin experiencia",
  MENOS_1: "Menos de 1 año",
  DE_1_A_2: "1 a 2 años",
  DE_3_A_5: "3 a 5 años",
  MAS_5: "Más de 5 años",
};
// Una práctica es para estudiantes: no puede exigir más de un año.
export const PRACTICE_EXPERIENCE: ExperienceLevel[] = ["NINGUNA", "MENOS_1"];

export type WorkSchedule = "TIEMPO_COMPLETO" | "MEDIO_TIEMPO" | "POR_HORAS" | "FLEXIBLE";
export const WORK_SCHEDULE_LABELS: Record<WorkSchedule, string> = {
  TIEMPO_COMPLETO: "Tiempo completo",
  MEDIO_TIEMPO: "Medio tiempo",
  POR_HORAS: "Por horas",
  FLEXIBLE: "Horario flexible",
};

export type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "NATIVO";
export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  A1: "A1 · Principiante",
  A2: "A2 · Básico",
  B1: "B1 · Intermedio",
  B2: "B2 · Intermedio alto",
  C1: "C1 · Avanzado",
  C2: "C2 · Dominio",
  NATIVO: "Nativo",
};
export type OfferLanguage = { idioma: string; nivel: LanguageLevel };

const label = <T extends string>(labels: Record<T, string>, value: unknown) =>
  (typeof value === "string" && value in labels ? labels[value as T] : null);
export const experienceLabel = (value: unknown) => label(EXPERIENCE_LABELS, value);
export const workScheduleLabel = (value: unknown) => label(WORK_SCHEDULE_LABELS, value);
export const languageLevelLabel = (value: unknown) => label(LANGUAGE_LEVEL_LABELS, value) ?? String(value ?? "");

const money = (value: number) => `$${value.toLocaleString("es-CO")}`;

// Remuneración según el tipo: la práctica puede no tener apoyo económico, el
// empleo muestra su rango y la formación no tiene salario.
export function offerSalaryLabel(type: unknown, min: unknown, max: unknown): string {
  const low = Number(min) > 0 ? Number(min) : null;
  const high = Number(max) > 0 ? Number(max) : null;
  if (type === "FORMACION") return "No aplica";
  if (type === "PRACTICA") return low ? `${money(low)}/mes` : "Sin apoyo económico";
  if (low && high && high > low) return `${money(low)} – ${money(high)}/mes`;
  return low ? `${money(low)}/mes` : "A convenir";
}

const textList = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []);
const languageList = (value: unknown): OfferLanguage[] => (Array.isArray(value)
  ? value.filter((item) => item && typeof item.idioma === "string").map((item) => ({ idioma: item.idioma, nivel: item.nivel }))
  : []);

// Campos estructurados de una fila de la API (vacíos en ofertas anteriores a la Fase 8).
export function structuredFields(offer: any) {
  return {
    programs: textList(offer.programas),
    minSemester: offer.semestre_minimo == null ? null : Number(offer.semestre_minimo),
    skills: textList(offer.habilidades),
    experience: (offer.experiencia ?? null) as ExperienceLevel | null,
    languages: languageList(offer.idiomas),
    workSchedule: (offer.jornada ?? null) as WorkSchedule | null,
    benefits: textList(offer.beneficios),
    vacancies: Number(offer.vacantes) > 0 ? Number(offer.vacantes) : 1,
  };
}

// Oferta tal como la muestran el catálogo del estudiante y el panel de la empresa.
export type Offer = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: Modality;
  closeDate: string;
  salary: string;
  description: string;
  requirements: string[];
  applicants?: number;
  offerType?: OfferType;
  status?: string;
  verified?: boolean;
  duration?: string | null;
  schedule?: string | null;
  contactEmail?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  // Fase 8 (opcionales para tolerar datos anteriores y pruebas).
  programs?: string[];
  minSemester?: number | null;
  skills?: string[];
  experience?: ExperienceLevel | null;
  languages?: OfferLanguage[];
  workSchedule?: WorkSchedule | null;
  benefits?: string[];
  vacancies?: number;
  // Papelera: cuándo y por qué se canceló (solo ofertas canceladas).
  cancelledAt?: string | null;
  cancelReason?: string | null;
};

// Las recomendaciones traen `affinity` (0 a 100); el catálogo público no.
export type CatalogOffer = Offer & { affinity?: number };

export type JobType = "Práctica" | "Tiempo completo" | "Medio tiempo" | "Contrato" | "Freelance" | "Formación";

// Vacante tal como la muestra la bolsa del profesional externo.
export type Job = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: Modality;
  type: JobType;
  closeDate: string;
  salaryMin: number;
  salaryMax: number;
  experience: string;
  description: string;
  requirements: string[];
  benefits: string[];
  applicants: number;
  skills?: string[];
  languages?: OfferLanguage[];
  workSchedule?: WorkSchedule | null;
  programs?: string[];
  vacancies?: number;
  offerType?: OfferType;
};

export const toUiOffer = (offer: any): CatalogOffer => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: normalizeModality(offer.modalidad ?? offer.modality),
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? "",
  salary: offer.tipo ? offerSalaryLabel(offer.tipo, offer.remuneracion, offer.remuneracion_maxima) : formatSalary(offer.remuneracion),
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
  offerType: offer.tipo,
  ...(offer.estado ? { status: offer.estado } : {}),
  verified: Boolean(offer.verificada),
  duration: offer.duracion,
  schedule: offer.horario,
  contactEmail: offer.contacto_email,
  cancelledAt: offer.cancelada_at ?? null,
  cancelReason: offer.motivo_cancelacion ?? null,
  salaryMin: offer.remuneracion == null ? null : toNumberOrZero(offer.remuneracion),
  salaryMax: offer.remuneracion_maxima == null ? null : toNumberOrZero(offer.remuneracion_maxima),
  ...structuredFields(offer),
  ...(Number.isFinite(Number(offer.affinity)) && offer.affinity !== null && offer.affinity !== undefined ? { affinity: Number(offer.affinity) } : {}),
});

export const mapOfferToJob = (offer: any): Job => ({
  id: Number(offer.id),
  title: offer.titulo ?? offer.title ?? "Oferta",
  company: offer.empresa ?? offer.company ?? "Empresa",
  logo: companyInitials(offer.empresa ?? offer.company ?? "E"),
  city: offer.ubicacion ?? offer.city ?? "Bogotá",
  area: offer.area ?? "General",
  modality: normalizeModality(offer.modalidad ?? offer.modality),
  type: offer.tipo === "PRACTICA" ? "Práctica" : offer.tipo === "FORMACION" ? "Formación" : offer.tipo === "EMPLEO_PUBLICO" ? "Contrato" : "Tiempo completo",
  closeDate: offer.fecha_cierre ?? offer.closeDate ?? "",
  salaryMin: toNumberOrZero(offer.remuneracion ?? offer.salaryMin),
  salaryMax: toNumberOrZero(offer.remuneracion_maxima ?? offer.remuneracionMaxima ?? offer.salaryMax ?? offer.remuneracion),
  experience: experienceLabel(offer.experiencia) ?? offer.duracion ?? "No especificada",
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  benefits: textList(offer.beneficios ?? offer.benefits),
  skills: textList(offer.habilidades),
  languages: languageList(offer.idiomas),
  workSchedule: (offer.jornada ?? null) as WorkSchedule | null,
  programs: textList(offer.programas),
  vacancies: Number(offer.vacantes) > 0 ? Number(offer.vacantes) : 1,
  offerType: offer.tipo,
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
});
