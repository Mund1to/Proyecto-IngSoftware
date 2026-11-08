// Contrato entre frontend y backend: las constantes que ambos lados repiten
// deben coincidir. Se importan solo módulos puros del backend (sin base de
// datos), así que la prueba corre igual en local y en CI.
import { describe, expect, it } from "vitest";
import {
  EXTERNAL_OFFER_TYPES as BACKEND_EXTERNAL_TYPES,
  EXPERIENCE_LEVELS,
  LANGUAGE_LEVELS,
  MODALITIES,
  OFFER_LIMITS as BACKEND_OFFER_LIMITS,
  OFFER_TYPES,
  PRACTICE_EXPERIENCE_LEVELS,
  WORK_SCHEDULES,
  // @ts-expect-error módulo JavaScript del backend sin tipos
} from "../../../backend/src/modules/offers/offers.domain.js";
// @ts-expect-error módulo JavaScript del backend sin tipos
import { APPLICATION_STATUSES } from "../../../backend/src/modules/applications/applications.domain.js";
// @ts-expect-error módulo JavaScript del backend sin tipos
import { DOCUMENT_TYPES, MIN_REJECTION_REASON_LENGTH } from "../../../backend/src/modules/verifications/verifications.rules.js";
// @ts-expect-error módulo JavaScript del backend sin tipos
import { isStrongPassword as backendIsStrongPassword } from "../../../backend/src/core/security/password.js";
import {
  EXPERIENCE_LABELS,
  EXTERNAL_OFFER_TYPES,
  LANGUAGE_LEVEL_LABELS,
  normalizeModality,
  OFFER_TYPE_LABELS,
  PRACTICE_EXPERIENCE,
  WORK_SCHEDULE_LABELS,
} from "../features/offers/offers.model";
import { OFFER_LIMITS } from "../features/offers/offer-form/offerForm.model";
import { mapApplicationStatus } from "../features/applications/applications.model";
import { DOCUMENT_TYPE_LABELS, MIN_REJECTION_REASON } from "../features/verifications/verification";
import { isStrongPassword } from "../shared/lib/password";

const sorted = (values: Iterable<string>) => [...values].sort();

describe("contrato con el backend", () => {
  it("tipos de oferta y quién los ve", () => {
    expect(sorted(Object.keys(OFFER_TYPE_LABELS))).toEqual(sorted(OFFER_TYPES));
    expect(sorted(EXTERNAL_OFFER_TYPES)).toEqual(sorted(BACKEND_EXTERNAL_TYPES));
  });

  it("opciones y límites del formulario de ofertas (Fase 8)", () => {
    expect(sorted(Object.keys(EXPERIENCE_LABELS))).toEqual(sorted(EXPERIENCE_LEVELS));
    expect(sorted(PRACTICE_EXPERIENCE)).toEqual(sorted(PRACTICE_EXPERIENCE_LEVELS));
    expect(sorted(Object.keys(WORK_SCHEDULE_LABELS))).toEqual(sorted(WORK_SCHEDULES));
    expect(sorted(Object.keys(LANGUAGE_LEVEL_LABELS))).toEqual(sorted(LANGUAGE_LEVELS));
    expect(OFFER_LIMITS).toEqual(BACKEND_OFFER_LIMITS);
  });

  it("modalidades", () => {
    for (const modality of MODALITIES as string[]) {
      expect(normalizeModality(modality)).toBe(modality);
    }
  });

  it("cada estado de postulación tiene su texto (solo ENVIADA cae en el valor por defecto)", () => {
    const labels = (APPLICATION_STATUSES as string[]).map((status) => mapApplicationStatus(status));
    expect(new Set(labels).size).toBe(APPLICATION_STATUSES.length);
    expect(mapApplicationStatus("ENVIADA")).toBe("Enviada");
  });

  it("tipos de documento y motivo mínimo de rechazo de la verificación", () => {
    expect(sorted(Object.keys(DOCUMENT_TYPE_LABELS))).toEqual(sorted(Object.keys(DOCUMENT_TYPES)));
    expect(MIN_REJECTION_REASON).toBe(MIN_REJECTION_REASON_LENGTH);
  });

  it("regla de contraseña", () => {
    for (const sample of ["Clave1234", "Corta1", "sinmayuscula1", "SinNumeroAqui", "", "ABCDEFG1", "abcdefg1", "Aa1" + "x".repeat(69), "Aa1" + "x".repeat(70), "Ññ1" + "ñ".repeat(40)]) {
      expect(isStrongPassword(sample), sample).toBe(backendIsStrongPassword(sample));
    }
  });
});
