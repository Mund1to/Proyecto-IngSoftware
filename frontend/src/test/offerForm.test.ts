// Reglas del formulario de ofertas por pasos (Fase 8), sin pantalla.
import { describe, expect, it } from "vitest";
import {
  addDays,
  changeOfferType,
  draftFromOffer,
  draftQuality,
  draftWarnings,
  emptyDraft,
  errorsForStep,
  looksLikeGibberish,
  mapApiErrors,
  meaningfulDescription,
  toPayload,
  validateDraft,
  type OfferDraft,
} from "../features/offers/offer-form/offerForm.model";
import { descriptionTemplate } from "../features/offers/offer-form/offerForm.catalogs";
import { offerSalaryLabel, toUiOffer } from "../features/offers/offers.model";

const goodDescription = "Apoyarás al equipo de desarrollo en la construcción de interfaces web, la integración con servicios internos y las pruebas de nuevas funcionalidades.";

const complete = (overrides: Partial<OfferDraft> = {}): OfferDraft => ({
  ...emptyDraft("rrhh@empresa.co"),
  title: "Practicante de desarrollo web",
  area: "Tecnología",
  description: goodDescription,
  skills: ["React", "SQL"],
  salary: "1300000",
  ...overrides,
});

describe("formulario de ofertas: validación", () => {
  it("una oferta completa no tiene errores", () => {
    expect(validateDraft(complete())).toEqual({});
  });

  it("rechaza títulos y descripciones sin sentido", () => {
    expect(validateDraft(complete({ title: "aaaa" })).title).toBeTruthy();
    expect(validateDraft(complete({ title: "X1" })).title).toBeTruthy();
    expect(validateDraft(complete({ description: "sasadasd" })).description).toMatch(/mínimo 10 palabras/);
    expect(validateDraft(complete({ description: Array(12).fill("sasadasd").join(" ") })).description).toMatch(/al azar/);
    expect(looksLikeGibberish("xkcd qwrt pfft brrr zzzz mmmm")).toBe(true);
    expect(looksLikeGibberish(goodDescription)).toBe(false);
  });

  it("los encabezados de la guía no cuentan como descripción", () => {
    const template = descriptionTemplate("PRACTICA");
    expect(meaningfulDescription(template)).toBe("");
    expect(validateDraft(complete({ description: template })).description).toBeTruthy();
    expect(validateDraft(complete({ description: `${template}${goodDescription}` })).description).toBeUndefined();
  });

  it("aplica las reglas de cada tipo de oferta", () => {
    expect(validateDraft(complete({ experience: "DE_3_A_5" })).experience).toMatch(/práctica/);
    expect(validateDraft(complete({ paid: true, salary: "" })).salary).toBeTruthy();
    expect(validateDraft(complete({ paid: false, salary: "" })).salary).toBeUndefined();

    const job = complete({ offerType: "EMPLEO", salary: "", workSchedule: "" });
    expect(Object.keys(validateDraft(job)).sort()).toEqual(["salary", "workSchedule"]);
    expect(validateDraft(complete({ offerType: "EMPLEO", workSchedule: "TIEMPO_COMPLETO", salary: "3000000", salaryMax: "2000000" })).salaryMax).toBeTruthy();

    expect(validateDraft(complete({ offerType: "FORMACION", salary: "" }))).toEqual({});
  });

  it("valida habilidades, fecha de cierre y correo", () => {
    expect(validateDraft(complete({ skills: [] })).skills).toBeTruthy();
    expect(validateDraft(complete({ closeDate: addDays(new Date(), -1) })).closeDate).toBeTruthy();
    expect(validateDraft(complete({ closeDate: addDays(new Date(), 400) })).closeDate).toMatch(/un año/);
    expect(validateDraft(complete({ contact: "no-es-correo" })).contact).toBeTruthy();
  });

  it("agrupa los errores por paso y traduce los de la API", () => {
    const errors = validateDraft(complete({ title: "", skills: [], contact: "" }));
    expect(Object.keys(errorsForStep(errors, "offer"))).toEqual(["title"]);
    expect(Object.keys(errorsForStep(errors, "profile"))).toEqual(["skills"]);
    expect(Object.keys(errorsForStep(errors, "publish"))).toEqual(["contact"]);
    expect(mapApiErrors({ descripcion: "Corta", habilidades: "Falta" })).toEqual({ description: "Corta", skills: "Falta" });
  });

  it("avisa de salarios sospechosamente bajos sin bloquear", () => {
    expect(draftWarnings(complete({ salary: "3333" })).salary).toMatch(/muy bajo/);
    expect(validateDraft(complete({ salary: "3333" })).salary).toBeUndefined();
  });

  it("mide la calidad de la oferta y sugiere mejoras", () => {
    const low = draftQuality(complete({ skills: ["React"], benefits: [] }));
    const high = draftQuality(complete({ skills: ["React", "SQL", "Git"], benefits: ["Capacitación"], programs: ["Ingeniería de Sistemas"], description: `${goodDescription} ${goodDescription}` }));
    expect(high.percent).toBe(100);
    expect(low.percent).toBeLessThan(high.percent);
    expect(low.tips.some((tip) => tip.includes("3 habilidades"))).toBe(true);
  });
});

describe("formulario de ofertas: conversión", () => {
  it("cambiar de tipo corrige lo que ya no aplica", () => {
    const course = changeOfferType(complete({ experience: "MENOS_1", salary: "1300000", minSemester: 6 }), "FORMACION");
    expect(course.salary).toBe("");
    expect(course.minSemester).toBeNull();
    expect(course.duration).toBe("8 semanas");
    const practice = changeOfferType(complete({ offerType: "EMPLEO", experience: "MAS_5" }), "PRACTICA");
    expect(practice.experience).toBe("NINGUNA");
  });

  it("arma el cuerpo de la API según el tipo", () => {
    const payload = toPayload(complete({ programs: ["Ingeniería de Sistemas"], minSemester: 6, languages: [{ idioma: "Inglés", nivel: "B1" }], benefits: ["Capacitación"] }), "PUBLICADA");
    expect(payload).toMatchObject({
      tipo: "PRACTICA", estado: "PUBLICADA", titulo: "Practicante de desarrollo web", habilidades: ["React", "SQL"],
      programas: ["Ingeniería de Sistemas"], semestreMinimo: 6, experiencia: "NINGUNA", idiomas: [{ idioma: "Inglés", nivel: "B1" }],
      remuneracion: 1300000, remuneracionMaxima: null, beneficios: ["Capacitación"], contactoEmail: "rrhh@empresa.co",
    });
    expect(new Date(payload.fechaCierre!).getTime()).toBeGreaterThan(Date.now());

    expect(toPayload(complete({ paid: false }), "PUBLICADA").remuneracion).toBeNull();
    const course = toPayload(complete({ offerType: "FORMACION" }), "BORRADOR");
    expect(course).toMatchObject({ estado: "BORRADOR", remuneracion: null, experiencia: null, semestreMinimo: null });
    const job = toPayload(complete({ offerType: "EMPLEO", salary: "2.000.000", salaryMax: "3000000", minSemester: 6 }), "PUBLICADA");
    expect(job).toMatchObject({ remuneracion: 2000000, remuneracionMaxima: 3000000, semestreMinimo: null });
  });

  it("una oferta guardada vuelve al formulario y una antigua conserva sus requisitos", () => {
    const offer = toUiOffer({
      id: 3, titulo: "Analista", descripcion: goodDescription, tipo: "EMPLEO", area: "Tecnología", ubicacion: "Cali", modalidad: "Remota",
      habilidades: ["SQL"], programas: [], idiomas: [{ idioma: "Inglés", nivel: "B2" }], jornada: "TIEMPO_COMPLETO", experiencia: "DE_1_A_2",
      beneficios: ["Capacitación"], vacantes: 2, remuneracion: "2500000.00", remuneracion_maxima: null, requisitos: ["Viajar"], fecha_cierre: "2026-12-31T23:59:59.000Z", contacto_email: "a@b.co",
    });
    const draft = draftFromOffer(offer);
    expect(draft).toMatchObject({ offerType: "EMPLEO", skills: ["SQL"], workSchedule: "TIEMPO_COMPLETO", experience: "DE_1_A_2", vacancies: 2, salary: "2500000", requirements: ["Viajar"], closeDate: "2026-12-31", contact: "a@b.co" });

    const legacy = draftFromOffer(toUiOffer({ id: 4, titulo: "Vieja", tipo: "PRACTICA", requisitos: ["Ing. Sistemas", "JavaScript, SQL"], area: "General", remuneracion: null }));
    expect(legacy.skills).toEqual([]);
    expect(legacy.requirements).toEqual(["Ing. Sistemas", "JavaScript, SQL"]);
    expect(legacy.area).toBe("");
    expect(legacy.paid).toBe(false);
  });

  it("muestra la remuneración según el tipo", () => {
    expect(offerSalaryLabel("PRACTICA", null, null)).toBe("Sin apoyo económico");
    expect(offerSalaryLabel("FORMACION", 900000, null)).toBe("No aplica");
    expect(offerSalaryLabel("EMPLEO", 2000000, 3000000)).toMatch(/^\$2\.000\.000 – \$3\.000\.000\/mes$/);
    expect(offerSalaryLabel("EMPLEO", null, null)).toBe("A convenir");
  });
});
