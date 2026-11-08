// Pruebas extremas de la interfaz: cada rol en cada pantalla con una API que
// responde vacío, basura, errores, HTML o nada; enlaces con # imposibles;
// almacenamiento dañado y usuarios que hacen clic como locos. La regla es que la
// app nunca muestre la pantalla de error ni ejecute HTML recibido de la API.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";
import { ROLE_ROUTES, routeFromHash } from "../app/hashRoutes";
import type { Role } from "../app/types";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';

const USERS: Record<Role | "funcionario", unknown> = {
  student: { id: 2, email: "sara@x.co", nombreCompleto: "Sara Ruiz", roles: ["USUARIO"], perfiles: [{ tipo: "ESTUDIANTE" }] },
  company: { id: 3, email: "rh@x.co", nombreCompleto: "Recursos Humanos", roles: ["USUARIO"], perfiles: [{ tipo: "ORGANIZACION", razonSocial: "Datos SAS" }] },
  external: { id: 4, email: "carla@x.co", nombreCompleto: "Carla Ruiz", roles: ["USUARIO"], perfiles: [{ tipo: "CANDIDATO_EXTERNO" }] },
  admin: { id: 1, email: "admin@x.co", nombreCompleto: "Ana Admin", roles: ["USUARIO", "ADMINISTRADOR"], perfiles: [{ tipo: "ESTUDIANTE" }] },
  funcionario: { id: 5, email: "func@x.co", nombreCompleto: "Fabio Funcionario", roles: ["USUARIO", "FUNCIONARIO_PUBLICO"], perfiles: [{ tipo: "ESTUDIANTE" }] },
};

// Oferta con todo lo que puede salir mal en un campo.
const absurdOffer = (id: number) => ({
  id: String(id),
  titulo: id % 3 === 0 ? XSS : id % 3 === 1 ? "🔥".repeat(300) : "a".repeat(5000),
  descripcion: id % 2 ? null : XSS,
  tipo: ["EMPLEO", "PRACTICA", "FORMACION", "EMPLEO_PUBLICO", "INVENTADO", null][id % 6],
  estado: ["PUBLICADA", "BORRADOR", "CANCELADA", "RARO", null][id % 5],
  modalidad: ["Remota", "H�brida", null, 42, ""][id % 5],
  ubicacion: [null, "", "Bogot�", XSS][id % 4],
  area: null,
  requisitos: id % 2 ? "no soy una lista" : [null, 3, { a: 1 }, "SQL"],
  habilidades: id % 2 ? null : ["", "a".repeat(1000)],
  idiomas: id % 2 ? "inglés" : [{ idioma: null, nivel: 7 }],
  beneficios: { raro: true },
  fecha_cierre: ["nunca", null, "2000-01-01", "9999-12-31T00:00:00Z", 0][id % 5],
  remuneracion: ["mucho", -1, 1e308, null, NaN][id % 5],
  remuneracion_maxima: -5,
  vacantes: "dos",
  empresa: id % 2 ? null : XSS,
  verificada: "quizás",
  afinidad: id % 2 ? 250 : -40,
  total_postulaciones: "muchas",
  created_at: "ayer",
});

const absurdApplication = (id: number) => ({
  id: String(id),
  oferta_id: String(id),
  oferta_titulo: XSS,
  oferta_tipo: "INVENTADO",
  oferta_estado: id % 2 ? "CANCELADA" : null,
  empresa: null,
  estado: ["ENVIADA", "EN_REVISION", "PRESELECCIONADA", "ACEPTADA", "RECHAZADA", "RETIRADA", "MARCIANA", null][id % 8],
  created_at: id % 2 ? "nunca" : null,
  carta_presentacion: XSS,
  entrevista: id % 2 ? { fecha: "mañana", modalidad: "TELEPATIA", lugar: "javascript:alert(1)", duracionMinutos: -3 } : "no",
  eventos: id % 2 ? "no es lista" : [{ id: 1, tipo: "ALIEN", fecha: null, mensaje: XSS, autorRol: "MARCIANO" }, null],
  candidato: XSS,
  candidato_nombre: null,
  email: "a".repeat(400),
  habilidades: { no: "lista" },
  calificacion: 99,
  tiene_cv: "sí",
  cv_nombre: XSS,
});

type Mode = "vacía" | "nulos" | "absurda" | "enorme" | "error 500" | "HTML" | "sin red" | "401";
const MODES: Mode[] = ["vacía", "nulos", "absurda", "enorme", "error 500", "HTML", "sin red", "401"];

function chaosBody(mode: Mode) {
  if (mode === "nulos") {
    return { ok: true, offers: null, applications: null, users: null, convocatorias: null, requests: null, organizations: null, stats: null, details: null, verification: null, pendientes: null, summary: null };
  }
  if (mode === "absurda" || mode === "enorme") {
    const count = mode === "enorme" ? 400 : 12;
    const offers = Array.from({ length: count }, (_, i) => absurdOffer(i + 1));
    const applications = Array.from({ length: count }, (_, i) => absurdApplication(i + 1));
    return {
      ok: true, offers, applications, total: "muchos",
      users: Array.from({ length: count }, (_, i) => ({ id: i, email: XSS, nombre_completo: null, roles: "ADMIN", activo: "tal vez", profile_types: null })),
      convocatorias: Array.from({ length: count }, (_, i) => ({ id: i, titulo: XSS, fecha_inicio: "nunca", fecha_fin: -1, total_ofertas: "x" })),
      requests: [{ id: 1, estado: "RARO", organizacion: XSS, documentos: "no" }],
      organizations: [{ id: 1, razon_social: XSS, verificada: "no sé" }],
      stats: { totals: { ofertas: "x" }, offersByType: [{ tipo: null, total: "x" }], offersByArea: null, offersByCity: [{}], topOrganizations: "no", applicationsByMonth: [{ mes: "nunca", total: -1 }] },
      details: { education: "x", experience: [null], skills: { a: 1 } },
      verification: { estado: "MARCIANO", documentos: null, solicitud: "no" },
      pendientes: "muchos",
      summary: { pendientes: -1 },
    };
  }
  return { ok: true };
}

// API caótica: la sesión carga bien (si no, no se llega a la pantalla) y todo lo
// demás responde según el modo.
function chaosApi(user: unknown, mode: Mode) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/profile/me")) return json(200, { ok: true, user });
    if (mode === "sin red") throw new TypeError("Failed to fetch");
    if (mode === "error 500") return json(500, { ok: false, message: "Error interno del servidor." });
    if (mode === "401") return json(401, { ok: false, message: "El token no es válido o ha expirado." });
    if (mode === "HTML") return new Response("<html><body>502 Bad Gateway</body></html>", { status: 502, headers: { "content-type": "text/html" } });
    return json(200, chaosBody(mode));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function settle(ms = 30) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function expectNoCrash(context: string) {
  expect(screen.queryByText("Algo salió mal al mostrar esta pantalla"), context).toBeNull();
  expect((window as unknown as { __xss?: number }).__xss, `${context}: se ejecutó HTML de la API`).toBeUndefined();
  expect(document.querySelector('img[src="x"]'), `${context}: se insertó una imagen de la API`).toBeNull();
  expect(document.querySelector("main script, #root script, body > div script"), `${context}: se insertó un script`).toBeNull();
}

function openWithSession(hash: string) {
  window.history.replaceState(null, "", `/${hash}`);
  localStorage.setItem("sipu-token", "tok");
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  delete (window as unknown as { __xss?: number }).__xss;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
const ROLE_CASES: { role: Role; user: unknown; label: string }[] = [
  { role: "student", user: USERS.student, label: "estudiante" },
  { role: "external", user: USERS.external, label: "candidato externo" },
  { role: "company", user: USERS.company, label: "empresa" },
  { role: "admin", user: USERS.admin, label: "administrador" },
  { role: "admin", user: USERS.funcionario, label: "funcionario" },
];

describe("extremas: cada pantalla de cada rol con una API caótica", () => {
  for (const { role, user, label } of ROLE_CASES) {
    const hashes = Object.entries(ROLE_ROUTES[role]).map(([name, screenName]) => (screenName === "offer-detail" || screenName === "external-job-detail" ? `#${name}/1` : `#${name}`));
    for (const mode of MODES) {
      it(`${label} · respuesta ${mode}`, async () => {
        for (const hash of hashes) {
          chaosApi(user, mode);
          openWithSession(hash);
          render(<App />);
          await waitFor(() => expect(screen.queryByText(/Cargando tu sesión|Validando/i)).toBeNull(), { timeout: 2000 }).catch(() => {});
          await settle();
          expectNoCrash(`${label} ${hash} (${mode})`);
          cleanup();
          vi.unstubAllGlobals();
          localStorage.clear();
        }
      });
    }
  }
});

// -----------------------------------------------------------------------------
describe("extremas: enlaces con # imposibles", () => {
  const BAD_HASHES = ["#%E0%A4%A", "#%", "#%zz", "#oferta/-1", "#oferta/0", "#oferta/1.5", "#oferta/abc", "#oferta/99999999999999999999", "#oferta/1/2/3", "#<script>alert(1)</script>", "#" + "x".repeat(5000), "#../../etc/passwd", "#__proto__", "#constructor", "#toString", "#oferta/1e3", "#OFERTAS", "# ofertas"];

  it("routeFromHash nunca lanza excepciones", () => {
    for (const role of Object.keys(ROLE_ROUTES) as Role[]) {
      for (const hash of BAD_HASHES) {
        expect(() => routeFromHash(hash, role), `${role} ${hash.slice(0, 40)}`).not.toThrow();
      }
    }
  });

  it("los nombres heredados del objeto no son pantallas", () => {
    for (const role of Object.keys(ROLE_ROUTES) as Role[]) {
      for (const hash of ["#__proto__", "#constructor", "#toString", "#hasOwnProperty", "#valueOf"]) {
        expect(routeFromHash(hash, role), `${role} ${hash}`).toBeNull();
      }
    }
  });

  it("abrir la app con un # imposible lleva al inicio del rol", async () => {
    for (const hash of BAD_HASHES) {
      chaosApi(USERS.student, "vacía");
      openWithSession(hash);
      render(<App />);
      expect(await screen.findByRole("heading", { name: /Hola, Sara/ }), hash.slice(0, 40)).toBeTruthy();
      expectNoCrash(hash.slice(0, 40));
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("cambiar el # a algo imposible con la sesión abierta no rompe nada", async () => {
    chaosApi(USERS.admin, "vacía");
    openWithSession("#usuarios");
    render(<App />);
    await screen.findByRole("heading", { name: "Usuarios" });
    for (const hash of BAD_HASHES) {
      await act(async () => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      await settle(5);
      expectNoCrash(hash.slice(0, 40));
    }
  });

  it("cambiar el # cien veces seguidas no rompe nada", async () => {
    chaosApi(USERS.admin, "vacía");
    openWithSession("#usuarios");
    render(<App />);
    await screen.findByRole("heading", { name: "Usuarios" });
    const names = ["#usuarios", "#estadisticas", "#solicitudes", "#convocatorias"];
    await act(async () => {
      for (let i = 0; i < 100; i += 1) {
        window.location.hash = names[i % names.length];
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    });
    await settle(50);
    expectNoCrash("cien cambios");
  });
});

// -----------------------------------------------------------------------------
describe("extremas: almacenamiento dañado", () => {
  it("un token guardado absurdo termina en la pantalla de acceso", async () => {
    for (const token of ["undefined", "null", "", " ", "{}", "a".repeat(10000), XSS]) {
      vi.stubGlobal("fetch", vi.fn(async () => json(401, { ok: false, message: "El token no es válido o ha expirado." })));
      localStorage.setItem("sipu-token", token);
      render(<App />);
      expect(await screen.findByRole("button", { name: /Iniciar sesión|Ingresar/i }), `token ${token.slice(0, 20)}`).toBeTruthy();
      expectNoCrash(`token ${token.slice(0, 20)}`);
      cleanup();
      vi.unstubAllGlobals();
      localStorage.clear();
    }
  });

  it("notificaciones leídas con JSON dañado no rompen el menú", async () => {
    for (const value of ["{no json", "null", "42", '"texto"', '{"a":1}', "[1,2,3]"]) {
      chaosApi(USERS.student, "absurda");
      openWithSession("#ofertas");
      localStorage.setItem("sipu-read-notifications-2", value);
      render(<App />);
      await screen.findByRole("heading", { name: /Hola, Sara/ });
      await settle();
      expectNoCrash(`notificaciones ${value}`);
      cleanup();
      vi.unstubAllGlobals();
      localStorage.clear();
    }
  });

  it("un navegador que bloquea localStorage no impide usar la app", async () => {
    const blocked = () => { throw new DOMException("Bloqueado", "SecurityError"); };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { ok: true })));
    render(<App />);
    expect(await screen.findByRole("button", { name: /Iniciar sesión|Ingresar/i })).toBeTruthy();
    expectNoCrash("localStorage bloqueado");
  });
});

// -----------------------------------------------------------------------------
describe("extremas: formulario de acceso", () => {
  function loginForm() {
    const email = screen.getByLabelText(/Correo/i) as HTMLInputElement;
    const password = screen.getByLabelText(/^Contraseña/i) as HTMLInputElement;
    const submit = screen.getAllByRole("button", { name: /Iniciar sesión|Ingresar/i }).find((b) => (b as HTMLButtonElement).type === "submit") as HTMLButtonElement;
    return { email, password, submit };
  }

  it("enviar vacío no llama a la API", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const { submit } = loginForm();
    fireEvent.click(submit);
    await settle();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/login"))).toHaveLength(0);
    expectNoCrash("login vacío");
  });

  it("diez clics seguidos en Ingresar envían una sola petición", async () => {
    let resolveLogin: (value: Response) => void = () => {};
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/auth/login")) return new Promise<Response>((resolve) => { resolveLogin = resolve; });
      return Promise.resolve(json(200, { ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const { email, password, submit } = loginForm();
    fireEvent.change(email, { target: { value: "sara@x.co" } });
    fireEvent.change(password, { target: { value: "Clave1234" } });
    for (let i = 0; i < 10; i += 1) fireEvent.click(submit);
    await settle();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/login"))).toHaveLength(1);
    resolveLogin(json(401, { ok: false, message: "Credenciales inválidas." }));
    expect(await screen.findByText("Credenciales inválidas.")).toBeTruthy();
  });

  it("un correo gigante, con HTML o con espacios no rompe el formulario", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { ok: false, message: "Credenciales inválidas." })));
    render(<App />);
    const { email, password, submit } = loginForm();
    for (const value of ["a".repeat(5000) + "@x.co", XSS, "   sara@x.co   ", "😀@😀.co", "' OR 1=1--"]) {
      fireEvent.change(email, { target: { value } });
      fireEvent.change(password, { target: { value: "Clave1234" } });
      fireEvent.click(submit);
      await settle();
      expectNoCrash(`correo ${value.slice(0, 20)}`);
    }
  });

  it("si el servidor responde HTML o se cae la red, muestra un mensaje y no se rompe", async () => {
    for (const make of [
      () => Promise.resolve(new Response("<html>502</html>", { status: 502, headers: { "content-type": "text/html" } })),
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve(json(500, {})),
      () => Promise.resolve(new Response("", { status: 200 })),
      () => Promise.resolve(new Response("{roto", { status: 200, headers: { "content-type": "application/json" } })),
    ]) {
      vi.stubGlobal("fetch", vi.fn(make));
      render(<App />);
      const { email, password, submit } = loginForm();
      fireEvent.change(email, { target: { value: "sara@x.co" } });
      fireEvent.change(password, { target: { value: "Clave1234" } });
      fireEvent.click(submit);
      await settle(40);
      expectNoCrash("login con servidor caído");
      expect(screen.queryByRole("heading", { name: /Hola, Sara/ })).toBeNull();
      expect(submit.disabled).toBe(false);
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("el registro avisa de una contraseña de más de 72 caracteres", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { ok: true })));
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /Crear cuenta|Regístrate|Registrarse/i })[0]);
    const password = (await screen.findAllByLabelText(/^Contraseña/i))[0] as HTMLInputElement;
    fireEvent.change(password, { target: { value: "Aa1" + "x".repeat(80) } });
    expect(await screen.findByText(/Máximo 72 caracteres/)).toBeTruthy();
  });
});

// -----------------------------------------------------------------------------
describe("extremas: la sesión expira a mitad de uso", () => {
  it("un 401 en cualquier pantalla devuelve al acceso sin romper", async () => {
    for (const { role, user, label } of ROLE_CASES) {
      chaosApi(user, "401");
      openWithSession(`#${Object.keys(ROLE_ROUTES[role])[0]}`);
      render(<App />);
      await settle(60);
      expectNoCrash(`${label} con 401`);
      cleanup();
      vi.unstubAllGlobals();
      localStorage.clear();
    }
  });
});

// -----------------------------------------------------------------------------
describe("extremas: errores de React en consola", () => {
  it("las pantallas con datos absurdos no generan avisos de claves duplicadas ni de hooks", async () => {
    for (const { role, user } of ROLE_CASES) {
      for (const [name] of Object.entries(ROLE_ROUTES[role])) {
        chaosApi(user, "absurda");
        openWithSession(name === "oferta" || name === "vacante" ? `#${name}/1` : `#${name}`);
        render(<App />);
        await settle(40);
        cleanup();
        vi.unstubAllGlobals();
        localStorage.clear();
      }
    }
    const reactWarnings = consoleError.mock.calls
      .map((args) => args.map(String).join(" "))
      .filter((text) => /same key|Rendered (more|fewer) hooks|Maximum update depth|Cannot update a component|NaN.*attribute|Received NaN/i.test(text));
    expect(reactWarnings.slice(0, 5)).toEqual([]);
  });
});
