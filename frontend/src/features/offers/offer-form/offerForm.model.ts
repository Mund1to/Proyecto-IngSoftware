// Estado, reglas y conversión del formulario de ofertas por pasos. Funciones
// puras: se prueban sin pantalla (test/offerForm.test.ts). Las reglas repiten las
// de publicationErrors del backend (offers.validation.js) y agregan ayudas propias
// del formulario, como ignorar los encabezados de la plantilla de descripción.
import type { Modality, OfferType, ExperienceLevel, WorkSchedule, OfferLanguage, Offer } from "../offers.model";
import { PRACTICE_EXPERIENCE } from "../offers.model";
import { AREAS, CITIES, DESCRIPTION_TEMPLATES, REMOTE_CITY } from "./offerForm.catalogs";

// Deben coincidir con OFFER_LIMITS del backend; test/contracts.test.ts lo comprueba.
export const OFFER_LIMITS = {
  titleMin: 4,
  titleMax: 120,
  descriptionMinChars: 60,
  descriptionMinWords: 10,
  descriptionMax: 5000,
  skillsMin: 1,
  skillsMax: 15,
  skillMinChars: 2,
  skillMaxChars: 40,
  programsMax: 10,
  languagesMax: 5,
  benefitsMax: 10,
  requirementsMax: 10,
  requirementMinChars: 3,
  requirementMaxChars: 200,
  vacanciesMax: 50,
  semesterMax: 10,
  salaryMax: 100000000,
  closeMaxDays: 365,
} as const;

// Un pago mensual por debajo de este valor probablemente es un error de digitación.
export const LOW_SALARY_WARNING = 200000;

export type OfferDraft = {
  offerType: OfferType;
  title: string;
  area: string;
  description: string;
  vacancies: number;
  programs: string[];
  minSemester: number | null;
  experience: ExperienceLevel;
  skills: string[];
  languages: OfferLanguage[];
  requirements: string[];
  modality: Modality;
  city: string;
  workSchedule: WorkSchedule | "";
  duration: string;
  schedule: string;
  // Solo práctica: si ofrece apoyo económico.
  paid: boolean;
  salary: string;
  salaryMax: string;
  benefits: string[];
  closeDate: string;
  contact: string;
};

export type DraftField = keyof OfferDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const STEPS = [
  { id: "type", title: "Tipo", hint: "Qué vas a publicar" },
  { id: "offer", title: "La oferta", hint: "Título y descripción" },
  { id: "profile", title: "Perfil", hint: "A quién buscas" },
  { id: "conditions", title: "Condiciones", hint: "Modalidad y pago" },
  { id: "publish", title: "Publicación", hint: "Cierre y contacto" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

const STEP_FIELDS: Record<StepId, DraftField[]> = {
  type: ["offerType"],
  offer: ["title", "area", "description", "vacancies"],
  profile: ["programs", "minSemester", "experience", "skills", "languages", "requirements"],
  conditions: ["modality", "city", "workSchedule", "duration", "schedule", "salary", "salaryMax", "benefits"],
  publish: ["closeDate", "contact"],
};

export const stepOfField = (field: DraftField): StepId =>
  (Object.keys(STEP_FIELDS) as StepId[]).find((step) => STEP_FIELDS[step].includes(field)) ?? "offer";

// Campos de la API (errors del backend) -> campos del formulario.
const API_FIELD: Record<string, DraftField> = {
  titulo: "title",
  descripcion: "description",
  area: "area",
  ubicacion: "city",
  modalidad: "modality",
  contacto_email: "contact",
  fecha_cierre: "closeDate",
  habilidades: "skills",
  experiencia: "experience",
  remuneracion: "salary",
};
export function mapApiErrors(errors: Record<string, string> | undefined): DraftErrors {
  const mapped: DraftErrors = {};
  for (const [key, message] of Object.entries(errors ?? {})) mapped[API_FIELD[key] ?? "description"] = message;
  return mapped;
}

// Fecha local AAAA-MM-DD (toISOString usaría UTC y en la noche de Colombia daría el día siguiente).
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayIso = () => localDate(new Date());

const DEFAULT_DURATION: Record<OfferType, string> = { PRACTICA: "6 meses", EMPLEO: "Indefinida", EMPLEO_PUBLICO: "", FORMACION: "8 semanas" };

export function addDays(base: string | Date, days: number): string {
  const date = typeof base === "string" ? new Date(`${base}T12:00:00`) : new Date(base);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function emptyDraft(contact = ""): OfferDraft {
  return {
    offerType: "PRACTICA",
    title: "",
    area: "",
    description: "",
    vacancies: 1,
    programs: [],
    minSemester: null,
    experience: "NINGUNA",
    skills: [],
    languages: [],
    requirements: [],
    modality: "Híbrida",
    city: "Ibagué",
    workSchedule: "",
    duration: DEFAULT_DURATION.PRACTICA,
    schedule: "",
    paid: true,
    salary: "",
    salaryMax: "",
    benefits: [],
    closeDate: addDays(todayIso(), 30),
    contact,
  };
}

// Ajusta el borrador al cambiar de tipo: valores que ya no aplican se corrigen.
export function changeOfferType(draft: OfferDraft, offerType: OfferType): OfferDraft {
  const next = { ...draft, offerType };
  if (offerType !== "PRACTICA") next.minSemester = null;
  if (offerType === "PRACTICA" && !PRACTICE_EXPERIENCE.includes(next.experience)) next.experience = "NINGUNA";
  if (offerType === "FORMACION") {
    next.experience = "NINGUNA";
    next.salary = "";
    next.salaryMax = "";
  }
  if (offerType === "PRACTICA") next.salaryMax = "";
  // La duración sugerida de un tipo no sirve para otro (6 meses de práctica no es
  // la duración de un curso): se reemplaza solo si era la sugerencia por defecto.
  if (draft.duration === DEFAULT_DURATION[draft.offerType]) next.duration = DEFAULT_DURATION[offerType];
  return next;
}

// Oferta existente -> borrador. Las ofertas anteriores a la Fase 8 no tienen
// habilidades estructuradas: sus requisitos pasan a "requisitos adicionales".
export function draftFromOffer(offer: Offer, contact = ""): OfferDraft {
  const type = offer.offerType ?? "PRACTICA";
  return {
    ...emptyDraft(contact),
    offerType: type,
    title: offer.title ?? "",
    area: offer.area && offer.area !== "General" ? offer.area : "",
    description: offer.description && offer.description !== "Sin descripción disponible." ? offer.description : "",
    vacancies: offer.vacancies ?? 1,
    programs: offer.programs ?? [],
    minSemester: offer.minSemester ?? null,
    experience: offer.experience ?? "NINGUNA",
    skills: offer.skills ?? [],
    languages: offer.languages ?? [],
    requirements: offer.requirements ?? [],
    modality: offer.modality,
    city: offer.city ?? "",
    workSchedule: offer.workSchedule ?? "",
    duration: offer.duration ?? "",
    schedule: offer.schedule ?? "",
    paid: type !== "PRACTICA" || Number(offer.salaryMin) > 0,
    salary: Number(offer.salaryMin) > 0 ? String(Math.round(Number(offer.salaryMin))) : "",
    salaryMax: Number(offer.salaryMax) > 0 ? String(Math.round(Number(offer.salaryMax))) : "",
    benefits: offer.benefits ?? [],
    // El cierre se guarda como fin del día local; se lee de vuelta en hora local.
    closeDate: offer.closeDate && Number.isFinite(new Date(offer.closeDate).getTime()) ? localDate(new Date(offer.closeDate)) : addDays(todayIso(), 30),
    contact: offer.contactEmail ?? contact,
  };
}

const HEADINGS = new Set(Object.values(DESCRIPTION_TEMPLATES).flat().map((heading) => heading.toLowerCase()));

// Texto de la descripción sin los encabezados de la plantilla ni viñetas vacías.
export function meaningfulDescription(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "-" && !HEADINGS.has(line.toLowerCase()))
    .join(" ");
}

const words = (text: string) => text.split(/\s+/).filter((word) => /\p{L}/u.test(word));
const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;
export const digitsOnly = (value: string) => value.replace(/\D/g, "");
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// Texto que parece escrito al azar: pocas palabras distintas para su largo
// ("sasadasd sasadasd...") o palabras sin vocales ("xkcd qwrt").
export function looksLikeGibberish(text: string): boolean {
  const list = words(text.toLowerCase());
  if (list.length === 0) return false;
  const distinct = new Set(list).size;
  const withVowels = list.filter((word) => /[aeiouáéíóúü]/.test(word)).length;
  return distinct < Math.min(6, list.length) || withVowels / list.length < 0.7;
}

export const isCustomArea = (area: string) => Boolean(area) && !AREAS.includes(area);
export const isCustomCity = (city: string) => Boolean(city) && city !== REMOTE_CITY && !CITIES.includes(city);

// Errores del borrador por campo (vacío si puede publicarse).
export function validateDraft(draft: OfferDraft, now = new Date()): DraftErrors {
  const errors: DraftErrors = {};
  const L = OFFER_LIMITS;
  const title = draft.title.trim();
  const description = meaningfulDescription(draft.description);

  if (title.length < L.titleMin || letters(title) < 3 || /^(.)\1+$/i.test(title.replace(/\s/g, ""))) {
    errors.title = `Escribe un título que describa el cargo (al menos ${L.titleMin} caracteres).`;
  } else if (title.length > L.titleMax) {
    errors.title = `El título admite como máximo ${L.titleMax} caracteres.`;
  }

  if (!draft.area.trim()) errors.area = "Elige el área de la oferta.";

  if (description.length < L.descriptionMinChars || words(description).length < L.descriptionMinWords) {
    errors.description = `Cuenta qué hará la persona y qué ofreces: mínimo ${L.descriptionMinWords} palabras (${L.descriptionMinChars} caracteres).`;
  } else if (looksLikeGibberish(description)) {
    errors.description = "La descripción parece incompleta o escrita al azar. Explica la oportunidad con frases claras.";
  } else if (draft.description.length > L.descriptionMax) {
    errors.description = `La descripción admite como máximo ${L.descriptionMax} caracteres.`;
  }

  if (!Number.isInteger(draft.vacancies) || draft.vacancies < 1 || draft.vacancies > L.vacanciesMax) {
    errors.vacancies = `Indica entre 1 y ${L.vacanciesMax} vacantes.`;
  }

  if (draft.skills.length < L.skillsMin) {
    errors.skills = draft.offerType === "FORMACION"
      ? "Agrega al menos un tema que se aprenderá."
      : "Agrega al menos una habilidad que buscas.";
  } else if (draft.skills.length > L.skillsMax) {
    errors.skills = `Puedes agregar como máximo ${L.skillsMax} habilidades.`;
  }

  if (draft.offerType === "PRACTICA" && !PRACTICE_EXPERIENCE.includes(draft.experience)) {
    errors.experience = "Una práctica es para estudiantes: no puede exigir más de un año de experiencia.";
  }

  if (draft.minSemester !== null && (draft.minSemester < 1 || draft.minSemester > L.semesterMax)) {
    errors.minSemester = `El semestre debe estar entre 1 y ${L.semesterMax}.`;
  }

  if (draft.languages.some((language) => language.idioma.trim().length < 2)) {
    errors.languages = "Escribe el nombre de cada idioma.";
  }

  if (draft.requirements.some((item) => item.trim().length < L.requirementMinChars)) {
    errors.requirements = `Cada requisito debe tener al menos ${L.requirementMinChars} caracteres.`;
  }

  if (!draft.city.trim()) errors.city = "Indica la ciudad.";
  if ((draft.offerType === "EMPLEO" || draft.offerType === "EMPLEO_PUBLICO") && !draft.workSchedule) {
    errors.workSchedule = "Elige la jornada del empleo.";
  }

  const salary = Number(digitsOnly(draft.salary));
  const salaryMax = Number(digitsOnly(draft.salaryMax));
  if (draft.offerType === "PRACTICA" && draft.paid && !(salary > 0)) {
    errors.salary = "Indica el apoyo económico mensual o marca que la práctica no tiene apoyo.";
  }
  if ((draft.offerType === "EMPLEO" || draft.offerType === "EMPLEO_PUBLICO") && !(salary > 0)) {
    errors.salary = "Indica el salario mensual.";
  }
  if (salary > L.salaryMax) errors.salary = "El valor supera el máximo permitido.";
  if (draft.offerType !== "PRACTICA" && draft.offerType !== "FORMACION" && salaryMax > 0 && salaryMax < salary) {
    errors.salaryMax = "El máximo no puede ser menor que el mínimo.";
  }

  const close = new Date(`${draft.closeDate}T23:59:59`);
  if (!draft.closeDate || !Number.isFinite(close.getTime())) {
    errors.closeDate = "Indica hasta cuándo se reciben postulaciones.";
  } else if (close.getTime() <= now.getTime()) {
    errors.closeDate = "La fecha de cierre debe ser posterior a hoy.";
  } else if (close.getTime() > now.getTime() + L.closeMaxDays * 86400000) {
    errors.closeDate = "La fecha de cierre no puede ser posterior a un año.";
  }

  if (!isEmail(draft.contact)) errors.contact = "Escribe un correo de contacto válido.";

  return errors;
}

export const errorsForStep = (errors: DraftErrors, step: StepId): DraftErrors =>
  Object.fromEntries(Object.entries(errors).filter(([field]) => STEP_FIELDS[step].includes(field as DraftField))) as DraftErrors;

// Avisos que no impiden publicar.
export function draftWarnings(draft: OfferDraft): Partial<Record<DraftField, string>> {
  const salary = Number(digitsOnly(draft.salary));
  const warnings: Partial<Record<DraftField, string>> = {};
  if (salary > 0 && salary < LOW_SALARY_WARNING) warnings.salary = `¿Seguro? $${salary.toLocaleString("es-CO")} al mes es un valor muy bajo. Revisa que no falten ceros.`;
  return warnings;
}

// Calidad de la oferta: lo mínimo para publicar más lo que ayuda a recibir
// buenos candidatos. Devuelve el porcentaje y los consejos pendientes.
export function draftQuality(draft: OfferDraft): { percent: number; tips: string[] } {
  const errors = validateDraft(draft);
  const description = meaningfulDescription(draft.description);
  const checks = [
    { ok: !errors.title && !errors.area, tip: "Escribe un título claro y elige el área." },
    { ok: !errors.description, tip: "Completa la descripción de la oferta." },
    { ok: description.length >= 200, tip: "Una descripción de más de 200 caracteres recibe postulaciones más acertadas." },
    { ok: draft.skills.length >= 3, tip: "Agrega al menos 3 habilidades: mejoran la afinidad con los candidatos." },
    { ok: draft.offerType !== "PRACTICA" || draft.programs.length > 0, tip: "Indica los programas que buscas para que la oferta llegue a los estudiantes indicados." },
    { ok: draft.offerType === "FORMACION" || (draft.offerType === "PRACTICA" ? !errors.salary : Number(digitsOnly(draft.salary)) > 0), tip: "Muestra la remuneración: es lo primero que miran los candidatos." },
    { ok: draft.benefits.length > 0, tip: "Cuenta al menos un beneficio." },
    { ok: !errors.closeDate && new Date(`${draft.closeDate}T23:59:59`).getTime() - Date.now() >= 14 * 86400000, tip: "Deja al menos dos semanas para recibir postulaciones." },
    { ok: !errors.contact, tip: "Agrega un correo de contacto válido." },
  ];
  const done = checks.filter((check) => check.ok).length;
  return { percent: Math.round((done / checks.length) * 100), tips: checks.filter((check) => !check.ok).map((check) => check.tip) };
}

// Fin del día elegido en la zona del navegador, en ISO.
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).toISOString();

// Borrador -> cuerpo de POST/PATCH /offers.
export function toPayload(draft: OfferDraft, estado: "PUBLICADA" | "BORRADOR") {
  const type = draft.offerType;
  const salary = Number(digitsOnly(draft.salary));
  const salaryMax = Number(digitsOnly(draft.salaryMax));
  return {
    tipo: type,
    estado,
    titulo: draft.title.trim(),
    descripcion: draft.description.trim(),
    area: draft.area.trim() || "General",
    vacantes: draft.vacancies,
    programas: draft.programs,
    semestreMinimo: type === "PRACTICA" ? draft.minSemester : null,
    experiencia: type === "FORMACION" ? null : draft.experience,
    habilidades: draft.skills,
    idiomas: draft.languages.filter((language) => language.idioma.trim()),
    requisitos: draft.requirements.map((item) => item.trim()).filter(Boolean),
    modalidad: draft.modality,
    ubicacion: draft.city.trim(),
    jornada: draft.workSchedule || null,
    duracion: draft.duration.trim() || null,
    horario: draft.schedule.trim() || null,
    remuneracion: type === "FORMACION" || (type === "PRACTICA" && !draft.paid) || !(salary > 0) ? null : salary,
    remuneracionMaxima: (type === "EMPLEO" || type === "EMPLEO_PUBLICO") && salaryMax > 0 ? salaryMax : null,
    beneficios: draft.benefits,
    fechaCierre: draft.closeDate ? endOfDay(draft.closeDate) : null,
    contactoEmail: draft.contact.trim(),
  };
}
