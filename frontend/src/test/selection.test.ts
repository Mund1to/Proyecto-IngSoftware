// Proceso de selección (Fase 8): modelo de postulantes, historial, calendario y
// contrato de etapas con el backend.
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JavaScript del backend sin tipos
import { allowedTransitions as backendTransitions, INTERVIEW_MODES, transitionError } from "../../../backend/src/modules/applications/applications.domain.js";
import { allowedTransitions, boardColumns, daysAgo, mapApplicant, skillMatch, sortApplicants, STAGES, transitionBlockedReason, type Applicant } from "../features/applications/applicants.model";
import { describeEvent, INTERVIEW_MODE_LABELS, lastCompanyMessage, mapApiApplications, type ApplicationEvent } from "../features/applications/applications.model";
import { buildIcs } from "../shared/lib/calendar";

const event = (overrides: Partial<ApplicationEvent>): ApplicationEvent => ({
  id: 1, tipo: "ESTADO", estadoAnterior: "ENVIADA", estadoNuevo: "EN_REVISION", mensaje: null, privado: false, entrevista: null,
  fecha: "2026-10-10T00:00:00.000Z", autorRol: "EMPRESA", ...overrides,
});

describe("contrato del proceso de selección con el backend", () => {
  it("las mismas etapas permitidas y los mismos motivos de bloqueo", () => {
    for (const type of ["PRACTICA", "EMPLEO", "FORMACION"]) {
      for (const from of STAGES) {
        expect(allowedTransitions(from, type), `${type} ${from}`).toEqual(backendTransitions(from, type));
        for (const to of STAGES) {
          expect(transitionBlockedReason(from, to, type), `${type} ${from} -> ${to}`).toBe(transitionError(from, to, type));
        }
      }
    }
  });

  it("modalidades de entrevista", () => {
    expect(Object.keys(INTERVIEW_MODE_LABELS).sort()).toEqual([...INTERVIEW_MODES].sort());
  });
});

describe("modelo de postulantes", () => {
  const row = {
    id: "5", estado: "PRESELECCIONADA", postulante_nombre: "Sara Ruiz", perfil_tipo: "CANDIDATO_EXTERNO", habilidades: ["SQL", "Node.js"],
    tiene_cv: true, cv_nombre: "cv.pdf", cv_tamano: 1000, cv_origen: "PERFIL", calificacion: 3, carta_presentacion: "Postulación a Analista",
    entrevista: { fecha: "2026-11-10T20:00:00.000Z", modalidad: "PRESENCIAL", lugar: "Calle 1", duracionMinutos: 30 },
    eventos: [{ id: 3, tipo: "NOTA", mensaje: "Buena", privado: true, fecha: "2026-10-11T00:00:00Z", autorRol: "EMPRESA", autor: "Ana" }],
  };

  it("convierte la fila de la API y oculta el texto automático antiguo", () => {
    const applicant = mapApplicant(row);
    expect(applicant).toMatchObject({ id: 5, status: "PRESELECCIONADA", profileType: "CANDIDATO_EXTERNO", rating: 3, coverLetter: "" });
    expect(applicant.cv).toMatchObject({ nombre: "cv.pdf", origen: "PERFIL" });
    expect(applicant.interview).toMatchObject({ modalidad: "PRESENCIAL", lugar: "Calle 1", duracionMinutos: 30 });
    expect(applicant.events[0]).toMatchObject({ tipo: "NOTA", privado: true, autor: "Ana" });
  });

  it("calcula la coincidencia de habilidades y ordena", () => {
    expect(skillMatch(["sql", "Python"], ["SQL", "Node.js"])).toEqual({ matched: ["SQL"], missing: ["Node.js"], percent: 50 });
    expect(skillMatch(["SQL"], []).percent).toBeNull();
    const a = { ...mapApplicant(row), id: 1, skills: ["SQL"], rating: 5, appliedAt: "2026-10-01T00:00:00Z" } as Applicant;
    const b = { ...mapApplicant(row), id: 2, skills: ["SQL", "Node.js"], rating: 1, appliedAt: "2026-10-05T00:00:00Z" } as Applicant;
    expect(sortApplicants([a, b], "recent").map((item) => item.id)).toEqual([2, 1]);
    expect(sortApplicants([a, b], "match", ["SQL", "Node.js"]).map((item) => item.id)).toEqual([2, 1]);
    expect(sortApplicants([b, a], "rating").map((item) => item.id)).toEqual([1, 2]);
  });

  it("el tablero de formación no tiene columna de entrevista", () => {
    expect(boardColumns("PRACTICA").map((column) => column.title)).toEqual(["Nuevas", "En revisión", "Entrevista", "Seleccionados", "Descartados"]);
    expect(boardColumns("FORMACION").map((column) => column.title)).toEqual(["Nuevas", "En revisión", "Inscritos", "Descartados"]);
  });

  it("indica hace cuánto se postuló", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(daysAgo("2026-11-02T08:00:00Z", now)).toBe("hoy");
    expect(daysAgo("2026-11-01T08:00:00Z", now)).toBe("hace 1 día");
    expect(daysAgo("2026-10-28T08:00:00Z", now)).toBe("hace 5 días");
  });
});

describe("historial de la postulación", () => {
  it("describe cada evento según quién lo lee", () => {
    expect(describeEvent(event({ tipo: "POSTULACION" }), "candidate")).toBe("Te postulaste");
    expect(describeEvent(event({ tipo: "ENTREVISTA", estadoAnterior: "EN_REVISION" }), "candidate")).toBe("Te citaron a entrevista");
    expect(describeEvent(event({ tipo: "ENTREVISTA", estadoAnterior: "PRESELECCIONADA" }), "company")).toBe("Entrevista reprogramada");
    expect(describeEvent(event({ estadoAnterior: "RECHAZADA", estadoNuevo: "EN_REVISION" }), "company")).toBe("Proceso reabierto");
    expect(describeEvent(event({ estadoNuevo: "ACEPTADA" }), "candidate")).toBe("¡Fuiste seleccionado!");
    expect(describeEvent(event({ tipo: "RETIRO" }), "company")).toBe("El candidato retiró la postulación");
  });

  it("toma el último mensaje público de la empresa", () => {
    const events = [event({ id: 1, mensaje: "Primero" }), event({ id: 2, mensaje: "Privado", privado: true }), event({ id: 3, tipo: "POSTULACION", autorRol: "CANDIDATO", mensaje: "Mío" })];
    expect(lastCompanyMessage(events)?.mensaje).toBe("Primero");
  });

  it("lee el historial, la entrevista y la hoja de vida enviada de /applications/me", () => {
    const [application] = mapApiApplications([{
      id: 7, oferta_id: 4, estado: "PRESELECCIONADA", tiene_cv: false, entrevista: { fecha: "2026-11-10T20:00:00Z", modalidad: "VIRTUAL", lugar: "https://x.co" },
      eventos: [{ id: 1, tipo: "ENTREVISTA", estadoNuevo: "PRESELECCIONADA", privado: false, fecha: "2026-11-01", autorRol: "EMPRESA" }],
    }]);
    expect(application).toMatchObject({ status: "Entrevista", cv: null, interview: { modalidad: "VIRTUAL", duracionMinutos: null } });
    expect(application.events).toHaveLength(1);
  });
});

describe("calendario de la entrevista", () => {
  it("genera un evento iCalendar con fin según la duración y texto escapado", () => {
    const ics = buildIcs({ uid: "entrevista-7", title: "Entrevista: QA, TecnoSur", start: "2026-11-10T20:00:00.000Z", minutes: 45, location: "Calle 1; Ibagué" });
    expect(ics).toContain("DTSTART:20261110T200000Z");
    expect(ics).toContain("DTEND:20261110T204500Z");
    expect(ics).toContain("SUMMARY:Entrevista: QA\\, TecnoSur");
    expect(ics).toContain("LOCATION:Calle 1\\; Ibagué");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
