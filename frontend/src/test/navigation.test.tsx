import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";
import { hashForScreen, routeFromHash } from "../app/hashRoutes";
import { SCREENS } from "../app/routes";
import type { Screen } from "../app/types";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ADMIN = { id: 1, email: "admin@x.co", nombreCompleto: "Ana Admin", roles: ["USUARIO", "ADMINISTRADOR"], perfiles: [{ tipo: "ESTUDIANTE" }] };
const STUDENT = { id: 2, email: "sara@x.co", nombreCompleto: "Sara Ruiz", roles: ["USUARIO"], perfiles: [{ tipo: "ESTUDIANTE" }] };
const OFFER = {
  id: "7", titulo: "Práctica en datos", descripcion: "Análisis", tipo: "PRACTICA", estado: "PUBLICADA", modalidad: "Remota",
  ubicacion: "Ibagué", area: "Tecnología", requisitos: [], fecha_cierre: "2026-12-31T00:00:00.000Z",
  remuneracion: null, remuneracion_maxima: null, empresa: "Datos SAS", verificada: true,
};

// API simulada: la cuenta indicada y respuestas vacías para el resto.
function mockApi(user: unknown) {
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/profile/me")) return Promise.resolve(jsonResponse(200, { ok: true, user }));
    if (url.endsWith("/offers/7")) return Promise.resolve(jsonResponse(200, { ok: true, offer: OFFER }));
    if (url.endsWith("/stats/employment")) {
      return Promise.resolve(jsonResponse(200, { ok: true, stats: { totals: {}, offersByType: [], offersByArea: [], offersByCity: [], topOrganizations: [], applicationsByMonth: [] } }));
    }
    return Promise.resolve(jsonResponse(200, { ok: true, offers: [], applications: [], users: [], pendientes: 0, details: { education: [], experience: [], skills: [] } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function openWithSession(hash: string) {
  window.history.replaceState(null, "", `/${hash}`);
  localStorage.setItem("sipu-token", "tok");
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  // jsdom no implementa scrollTo; la app lo llama al cambiar de pantalla.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("rutas con #", () => {
  it("cada rol resuelve sus propios enlaces", () => {
    expect(routeFromHash("#estadisticas", "admin")).toEqual({ screen: "employment-stats" });
    expect(routeFromHash("#ofertas", "company")).toEqual({ screen: "company-dashboard" });
    expect(routeFromHash("#ofertas", "external")).toEqual({ screen: "external-dashboard" });
    expect(routeFromHash("#usuarios", "student")).toBeNull();
    expect(routeFromHash("#verificacion", "company")).toBeNull();
    expect(routeFromHash("", "student")).toBeNull();
  });

  it("los detalles llevan el id de la oferta", () => {
    expect(routeFromHash("#oferta/12", "student")).toEqual({ screen: "offer-detail", id: 12 });
    expect(routeFromHash("#vacante/5", "external")).toEqual({ screen: "external-job-detail", id: 5 });
    expect(routeFromHash("#oferta", "student")).toBeNull();
    expect(routeFromHash("#oferta/abc", "student")).toBeNull();
    expect(hashForScreen("offer-detail", 12)).toBe("#oferta/12");
  });

  it("toda pantalla salvo el acceso tiene enlace", () => {
    const screens = Object.keys(SCREENS) as Screen[];
    for (const screenName of screens.filter((name) => name !== "auth")) {
      expect(hashForScreen(screenName, 1), screenName).not.toBe("");
    }
    expect(hashForScreen("auth")).toBe("");
  });
});

describe("App: navegación con #", () => {
  it("escribe el # de cada pantalla y Atrás vuelve a la anterior", async () => {
    mockApi(ADMIN);
    openWithSession("");
    render(<App />);

    await screen.findByRole("heading", { name: /Estadísticas de/ });
    await waitFor(() => expect(window.location.hash).toBe("#estadisticas"));

    const menu = screen.getByRole("navigation", { name: "Navegación principal" });
    fireEvent.click(within(menu).getByRole("button", { name: "Usuarios" }));
    await screen.findByRole("heading", { name: "Usuarios" });
    expect(window.location.hash).toBe("#usuarios");

    window.location.hash = "#estadisticas";
    expect(await screen.findByRole("heading", { name: /Estadísticas de/ })).toBeTruthy();
  });

  it("al recargar abre la pantalla del #", async () => {
    mockApi(ADMIN);
    openWithSession("#usuarios");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Usuarios" })).toBeTruthy();
  });

  it("un # de otro rol lleva al inicio y se reemplaza", async () => {
    mockApi(STUDENT);
    openWithSession("#usuarios");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Hola, Sara/ })).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe("#ofertas"));
  });

  it("abre el detalle de una oferta desde su enlace", async () => {
    const fetchMock = mockApi(STUDENT);
    openWithSession("#oferta/7");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Práctica en datos" })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/offers/7"))).toBe(true);
    expect(window.location.hash).toBe("#oferta/7");
  });
});
