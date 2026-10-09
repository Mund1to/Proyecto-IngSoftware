import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { type AppState } from "../App";
import ExternalDashboard from "./ExternalDashboard";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const baseState: AppState = {
  screen: "external-dashboard",
  role: "external",
  token: "tok",
  booting: false,
  notice: "",
  resetToken: null,
  currentUser: { id: 1, email: "c@x.co", nombreCompleto: "Carla Ruiz", profileTypes: ["CANDIDATO_EXTERNO"], roles: ["USUARIO"] },
  selectedOffer: null,
  selectedJob: null,
  selectedCompanyOffer: null,
  applications: [],
  jobApplications: [],
};

// Oferta tal como existe en producción: modalidad y ciudad con codificación dañada.
const brokenOffer = {
  id: "1", titulo: "Práctica de prueba", descripcion: "Desarrollo", tipo: "PRACTICA", estado: "PUBLICADA",
  modalidad: "H�brida", ubicacion: "Bogot�", area: "General", requisitos: [], fecha_cierre: "2026-12-31T00:00:00.000Z",
  remuneracion: null, remuneracion_maxima: null, empresa: "Empresa Fase 1", verificada: false,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExternalDashboard", () => {
  it("muestra ofertas con modalidad mal codificada sin romper la pantalla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, offers: [brokenOffer] })));

    render(<ExternalDashboard state={baseState} navigate={vi.fn()} />);

    expect(await screen.findByText("Práctica de prueba")).toBeTruthy();
    expect(screen.getAllByText("Híbrida").length).toBeGreaterThan(0);
  });
});

describe("App: inicio de sesión", () => {
  it("muestra estado de carga y entra al panel según el perfil", async () => {
    let resolveLogin: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/health")) return Promise.resolve(jsonResponse(200, { status: "ok" }));
      if (url.endsWith("/auth/login")) return new Promise<Response>((resolve) => { resolveLogin = resolve; });
      if (url.endsWith("/offers")) return Promise.resolve(jsonResponse(200, { ok: true, offers: [brokenOffer] }));
      if (url.endsWith("/applications/me")) return Promise.resolve(jsonResponse(200, { ok: true, applications: [] }));
      return Promise.resolve(jsonResponse(404, { message: "no" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "carla@x.co" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Clave1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("button", { name: "Iniciando sesión..." })).toBeTruthy();

    await act(async () => {
      resolveLogin(jsonResponse(200, {
        ok: true,
        token: "nuevo-token",
        user: { id: 7, email: "carla@x.co", nombreCompleto: "Carla Ruiz", roles: ["USUARIO"], profileTypes: ["CANDIDATO_EXTERNO"] },
      }));
    });

    expect(await screen.findByText("Práctica de prueba")).toBeTruthy();
    expect(localStorage.getItem("sipu-token")).toBe("nuevo-token");
  });

  it("muestra el error de credenciales sin cerrar el formulario", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/health")
      ? jsonResponse(200, { status: "ok" })
      : jsonResponse(401, { ok: false, message: "Credenciales inválidas." }))));

    render(<App />);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "x@x.co" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "mala" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Credenciales inválidas.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeTruthy();
  });

  it("restaura una sesión guardada y la cierra si el token expiró", async () => {
    localStorage.setItem("sipu-token", "vencido");
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/health")
      ? jsonResponse(200, { status: "ok" })
      : jsonResponse(401, { ok: false, message: "El token no es válido o ha expirado." }))));

    render(<App />);
    expect(screen.getByText("Cargando tu sesión...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Tu sesión expiró. Inicia sesión nuevamente.")).toBeTruthy());
    expect(localStorage.getItem("sipu-token")).toBeNull();
  });

  it("lleva a un administrador a su panel con su propio menú", async () => {
    localStorage.setItem("sipu-token", "admin-token");
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/profile/me")) {
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          user: { id: 1, email: "admin@x.co", nombreCompleto: "Admin", roles: ["USUARIO", "ADMINISTRADOR"], perfiles: [{ tipo: "ESTUDIANTE" }] },
        }));
      }
      if (url.endsWith("/stats/employment")) {
        return Promise.resolve(jsonResponse(200, { ok: true, stats: { totals: { total_ofertas: 2 }, offersByType: [], offersByArea: [], offersByCity: [], topOrganizations: [], applicationsByMonth: [] } }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true }));
    }));

    render(<App />);
    expect(await screen.findByText("Estadísticas de empleo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usuarios" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mis postulaciones" })).toBeNull();
  });
});

describe("App: recuperación de contraseña", () => {
  it("envía el enlace desde '¿Olvidaste tu contraseña?'", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith("/health")
      ? jsonResponse(200, { status: "ok" })
      : jsonResponse(200, { ok: true, message: "Si el correo está registrado, recibirás un enlace para restablecer la contraseña." })));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@x.co" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByText(/recibirás un enlace/)).toBeTruthy();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/auth/forgot-password"));
    expect(JSON.parse(String((call as unknown as [string, RequestInit])[1].body))).toEqual({ email: "ana@x.co" });
  });

  it("abre el formulario de nueva contraseña desde el enlace del correo", async () => {
    const token = "a".repeat(64);
    window.history.replaceState(null, "", `/?reset=${token}`);
    localStorage.setItem("sipu-token", "sesion-vieja");
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith("/health")
      ? jsonResponse(200, { status: "ok" })
      : jsonResponse(200, { ok: true, message: "Contraseña restablecida. Ya puedes iniciar sesión." })));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(screen.getByText("Crea una nueva contraseña")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "Nueva12345" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Nueva12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));

    expect(await screen.findByText("Contraseña restablecida. Ya puedes iniciar sesión.")).toBeTruthy();
    expect(screen.getByText("Bienvenido de nuevo")).toBeTruthy();
    expect(window.location.search).toBe("");
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/auth/reset-password"));
    expect(JSON.parse(String((call as unknown as [string, RequestInit])[1].body))).toEqual({ token, password: "Nueva12345" });
  });
});
