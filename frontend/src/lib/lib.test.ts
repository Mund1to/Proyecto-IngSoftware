import { afterEach, describe, expect, it, vi } from "vitest";
import { mapApiApplications, mapUserToSession, resolveRole, toJobApplications } from "../App";
import { api, ApiError, PRODUCTION_API_URL, request, resolveApiBaseUrl, SESSION_EXPIRED_EVENT } from "./api";
import { daysUntil, formatDate, mapApplicationStatus, normalizeModality } from "./offers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("resolveApiBaseUrl", () => {
  it("usa VITE_API_URL sin barra final", () => {
    expect(resolveApiBaseUrl("https://api.test/api/", true)).toBe("https://api.test/api");
  });

  it("en producción nunca cae en localhost", () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe(PRODUCTION_API_URL);
    expect(resolveApiBaseUrl("  ", true)).toBe(PRODUCTION_API_URL);
  });

  it("en desarrollo usa la API local", () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe("http://localhost:3000/api");
  });
});

describe("request", () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("devuelve el JSON y envía el token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/x", {}, "tok")).resolves.toEqual({ ok: true });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propaga el mensaje y el estado de error de la API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { message: "Duplicado" })));
    await expect(request("/x")).rejects.toMatchObject({ message: "Duplicado", status: 409 });
  });

  it("emite el evento de sesión expirada ante un 401 autenticado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { message: "Token vencido" })));
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    await expect(request("/x", {}, "tok")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it("no emite el evento en un login fallido (sin token)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { message: "Credenciales inválidas." })));
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    await expect(api.login({ email: "a@b.co", password: "x" })).rejects.toThrow("Credenciales inválidas.");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it("explica un fallo de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/x")).rejects.toThrow(/No se pudo conectar con el servidor/);
  });

  it("corta la petición si el servidor no responde a tiempo", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));

    const pending = request("/lento");
    const assertion = expect(pending).rejects.toThrow(/tardó demasiado/);
    await vi.advanceTimersByTimeAsync(70000);
    await assertion;
  });
});

describe("utilidades de ofertas", () => {
  it("normalizeModality tolera variantes y texto dañado", () => {
    expect(normalizeModality("H�brida")).toBe("Híbrida");
    expect(normalizeModality("remoto")).toBe("Remota");
    expect(normalizeModality("PRESENCIAL")).toBe("Presencial");
    expect(normalizeModality(undefined)).toBe("Híbrida");
  });

  it("formatDate no lanza con fechas inválidas", () => {
    expect(formatDate("")).toBe("Sin fecha");
    expect(formatDate("no-es-fecha", "—")).toBe("—");
    expect(formatDate("2026-12-31T00:00:00.000Z")).toMatch(/2026/);
  });

  it("daysUntil trata la ausencia de fecha como abierta", () => {
    expect(daysUntil(null)).toBe(Number.POSITIVE_INFINITY);
    expect(daysUntil(new Date(Date.now() - 2 * 86400000).toISOString())).toBeLessThan(0);
  });

  it("mapApplicationStatus traduce todos los estados", () => {
    expect(mapApplicationStatus("PRESELECCIONADA")).toBe("En revisión");
    expect(mapApplicationStatus("RETIRADA")).toBe("Retirada");
    expect(mapApplicationStatus("ENVIADA")).toBe("Enviada");
  });
});

describe("sesión", () => {
  it("deduce los tipos de perfil aunque el login no los envíe", () => {
    const session = mapUserToSession({
      id: 3, email: "e@x.co", nombreCompleto: "Empresa", roles: ["USUARIO"], profileTypes: [],
      perfiles: [{ tipo: "ORGANIZACION", razonSocial: "ACME", verificada: true }],
    });
    expect(session.profileTypes).toEqual(["ORGANIZACION"]);
    expect(session.organizacionNombre).toBe("ACME");
    expect(resolveRole(session)).toBe("company");
  });

  it("prioriza el rol institucional", () => {
    expect(resolveRole({ profileTypes: ["ESTUDIANTE"], roles: ["USUARIO", "FUNCIONARIO_PUBLICO"] })).toBe("admin");
    expect(resolveRole({ profileTypes: ["CANDIDATO_EXTERNO"], roles: ["USUARIO"] })).toBe("external");
    expect(resolveRole({ profileTypes: ["ESTUDIANTE"], roles: ["USUARIO"] })).toBe("student");
  });

  it("conserva todas las postulaciones sin importar el tipo de oferta", () => {
    const applications = mapApiApplications([
      { id: 1, oferta_id: 10, oferta_tipo: "PRACTICA", estado: "ACEPTADA", created_at: "2026-10-01T10:00:00Z" },
      { id: 2, oferta_id: 11, oferta_tipo: "EMPLEO", estado: "RETIRADA", created_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(applications[0]).toEqual({ id: 1, offerId: 10, offerTitle: "Oferta", company: "Empresa", appliedDate: "2026-10-01", status: "Aceptada" });
    expect(toJobApplications(applications)).toHaveLength(2);
    expect(toJobApplications(applications)[1]).toMatchObject({ jobId: 11, status: "Retirada" });
  });
});
