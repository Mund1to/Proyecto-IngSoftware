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
  experience: offer.experiencia ?? offer.duracion ?? "No especificada",
  description: offer.descripcion ?? offer.description ?? "Sin descripción disponible.",
  requirements: Array.isArray(offer.requisitos) ? offer.requisitos : Array.isArray(offer.requirements) ? offer.requirements : [],
  benefits: Array.isArray(offer.benefits) ? offer.benefits : [],
  applicants: Number(offer.postulantes ?? offer.applicants ?? 0),
});
