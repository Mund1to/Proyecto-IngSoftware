import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { type AppState } from "../App";
import AuthScreen from "./AuthScreen";
import CompanyDashboard from "./CompanyDashboard";
import EmploymentStats from "./EmploymentStats";
import ExternalDashboard from "./ExternalDashboard";
import OfferDetail from "./OfferDetail";
import StudentDashboard from "./StudentDashboard";

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

  it("filtra por tipo con las pestañas y por ciudad con el menú, con contadores", async () => {
    const course = { ...brokenOffer, id: "2", titulo: "Curso de datos", tipo: "FORMACION", ubicacion: "Ibagué", empresa: "Academia" };
    const job = { ...brokenOffer, id: "3", titulo: "Analista", tipo: "EMPLEO", ubicacion: "Ibagué", empresa: "Datos SAS" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, offers: [brokenOffer, course, job] })));

    render(<ExternalDashboard state={baseState} navigate={vi.fn()} />);
    await screen.findByText("Curso de datos");
    expect(screen.getByText("vacantes encontradas")).toBeTruthy();

    const formacion = within(screen.getByRole("group", { name: "Tipo de vacante" })).getByRole("button", { name: /Formación/ });
    expect(formacion.textContent).toContain("1");
    fireEvent.click(formacion);
    expect(formacion.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Analista")).toBeNull();
    expect(screen.getByText("vacante encontrada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quitar filtro Tipo: Formación" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
    fireEvent.click(screen.getByRole("button", { name: /^Ciudad/ }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Ciudad" })).getByRole("option", { name: /Ibagué/ }));
    expect(screen.getByRole("button", { name: /^Ciudad/ }).textContent).toContain("Ciudad: Ibagué");
    expect(screen.queryByText("Práctica de prueba")).toBeNull();
    expect(screen.getByText("Analista")).toBeTruthy();
  });
});

describe("StudentDashboard: filtros desplegables", () => {
  const studentState: AppState = {
    ...baseState,
    screen: "student-dashboard",
    role: "student",
    currentUser: { id: 2, email: "e@x.co", nombreCompleto: "Eva Díaz", profileTypes: ["ESTUDIANTE"], roles: ["USUARIO"] },
  };
  const offer = (id: number, titulo: string, ubicacion: string) => ({
    ...brokenOffer, id: String(id), titulo, ubicacion, modalidad: "Presencial", empresa: `Empresa ${id}`,
  });

  const renderDashboard = async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse(200, {
      ok: true, offers: [offer(1, "Práctica en Ibagué", "Ibagué"), offer(2, "Práctica en Cali", "Cali"), offer(3, "Empleo en Ibagué", "Ibagué")],
    })));
    render(<StudentDashboard state={studentState} navigate={vi.fn()} />);
    await screen.findByText("Práctica en Cali");
  };

  it("filtra por ciudad con el menú, muestra el chip y lo quita", async () => {
    await renderDashboard();

    const trigger = screen.getByRole("button", { name: /Ciudad/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const option = within(screen.getByRole("listbox", { name: "Ciudad" })).getByRole("option", { name: /Ibagué/ });
    expect(option.textContent).toContain("2");
    fireEvent.click(option);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar filtro Ciudad: Ibagué" })).toBeTruthy();
    expect(screen.queryByText("Práctica en Cali")).toBeNull();
    expect(screen.getByText("Práctica en Ibagué")).toBeTruthy();
    expect(screen.getByText("2 ofertas abiertas")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Ciudad: Ibagué" }));
    expect(screen.getByRole("button", { name: /Ciudad/ }).textContent).toContain("Todas");
    expect(screen.queryByText("Filtros activos:")).toBeNull();
    expect(screen.getByText("Práctica en Cali")).toBeTruthy();
  });

  it("filtra con las fichas de tipo y muestra la afinidad solo si la API la envía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse(200, {
      ok: true,
      offers: [
        { ...offer(1, "Práctica en Ibagué", "Ibagué"), tipo: "PRACTICA", affinity: 80 },
        { ...offer(2, "Curso de SQL", "Cali"), tipo: "FORMACION" },
      ],
    })));
    render(<StudentDashboard state={studentState} navigate={vi.fn()} />);
    await screen.findByText("Curso de SQL");

    expect(screen.getByText("¡Encontré 2 ofertas para ti!")).toBeTruthy();
    const bars = screen.getAllByRole("progressbar", { name: "Afinidad con tu perfil" });
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute("aria-valuenow")).toBe("80");

    const formacion = screen.getByRole("button", { name: /Formación\s*1 oferta/ });
    fireEvent.click(formacion);
    expect(formacion.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Práctica en Ibagué")).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar filtro Tipo: Formación" })).toBeTruthy();
  });

  it("cierra el menú con Escape", async () => {
    await renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Ciudad/ }));
    const listbox = screen.getByRole("listbox", { name: "Ciudad" });
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(listbox, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Ciudad/ }).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("OfferDetail", () => {
  const detailOffer = {
    id: 9, title: "Curso de datos", company: "Academia", logo: "AC", city: "Ibagué", area: "Tecnología", modality: "Remota" as const,
    closeDate: new Date(Date.now() + 5 * 86400000).toISOString(), salary: "A convenir", description: "Aprende SQL.",
    requirements: ["SQL, Power BI"], offerType: "FORMACION" as const, verified: true, affinity: 73,
  };

  it("muestra afinidad, compara habilidades con el perfil y calcula el avance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {
      ok: true,
      details: { education: [{ titulo: "Ingeniería", institucion: "Unibagué", periodo: "2022" }], experience: [], skills: [{ categoria: "Datos", nombre: "sql" }] },
    })));
    render(<OfferDetail state={{ ...baseState, role: "student", screen: "offer-detail", selectedOffer: detailOffer }} navigate={vi.fn()} applyToOffer={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Afinidad con tu perfil: 73%" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Inscribirme/ })).toBeTruthy();
    expect(await screen.findByText("Tienes 1 de 2 en tu perfil")).toBeTruthy();
    expect(screen.getByText("(ya está en tu perfil)", { exact: false })).toBeTruthy();
    expect(screen.getByText("(no está en tu perfil)", { exact: false })).toBeTruthy();
    // Solo educación y habilidades de 5 secciones: 40 %.
    expect(screen.getByRole("progressbar", { name: "Perfil completado" }).getAttribute("aria-valuenow")).toBe("40");
  });

  it("oculta la afinidad y el consejo de Ardy si no hay datos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { message: "error" })));
    const { affinity: _omit, ...withoutAffinity } = detailOffer;
    render(<OfferDetail state={{ ...baseState, role: "student", screen: "offer-detail", selectedOffer: { ...withoutAffinity, offerType: "PRACTICA" } }} navigate={vi.fn()} applyToOffer={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Postularme/ })).toBeTruthy();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(screen.queryByRole("img", { name: /Afinidad/ })).toBeNull();
    expect(screen.queryByText("Consejo de Ardy")).toBeNull();
  });
});

describe("EmploymentStats", () => {
  it("muestra indicadores, tasa de colocación y gráficos con descripción accesible", async () => {
    const thisMonth = new Date();
    const mes = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {
      ok: true,
      stats: {
        totals: { total_ofertas: 10, ofertas_publicadas: 8, total_postulaciones: 20, postulaciones_aceptadas: 5, total_organizaciones: 4, organizaciones_verificadas: 3, total_estudiantes: 30 },
        offersByType: [{ tipo: "PRACTICA", total: 6 }, { tipo: "FORMACION", total: 2 }],
        offersByArea: [{ area: "Tecnología", total: 5 }],
        offersByCity: [{ ubicacion: "Ibagué", total: 7 }],
        topOrganizations: [{ razon_social: "TecnoSur", total: 4 }],
        applicationsByMonth: [{ mes, total: 12 }],
      },
    })));
    render(<EmploymentStats state={{ ...baseState, role: "admin", screen: "employment-stats" }} navigate={vi.fn()} />);

    expect(await screen.findByText("25 %")).toBeTruthy();
    expect(screen.getByText("de 10 ofertas totales")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ofertas por tipo: Prácticas 6 (75 %), Formación 2 (25 %)" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Postulaciones por mes: .* 12$/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ofertas por ciudad: Ibagué 7" })).toBeTruthy();
    expect(screen.getByText("Estudiantes")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Organizaciones con más ofertas" })).getByText("TecnoSur")).toBeTruthy();
  });
});

describe("CompanyDashboard", () => {
  const companyState: AppState = {
    ...baseState,
    screen: "company-dashboard",
    role: "company",
    currentUser: { id: 5, email: "rrhh@ts.co", nombreCompleto: "TecnoSur", organizacionNombre: "TecnoSur", organizacionVerificada: true, profileTypes: ["ORGANIZACION"], roles: ["USUARIO"] },
  };

  it("muestra el saludo, los nuevos de la semana y la barra por etapa", async () => {
    const companyOffer = { ...brokenOffer, id: "4", titulo: "Practicante web", estado: "PUBLICADA", conteo_estados: { ENVIADA: 2, PRESELECCIONADA: 1 }, nuevos_semana: 3 };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/offers/mine")
      ? jsonResponse(200, { ok: true, offers: [companyOffer] })
      : jsonResponse(200, { ok: true, applications: [{ id: 1, estado: "ENVIADA" }, { id: 2, estado: "ENVIADA" }, { id: 3, estado: "PRESELECCIONADA" }] }))));
    render(<CompanyDashboard state={companyState} navigate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Hola, TecnoSur." })).toBeTruthy();
    expect(screen.getByText("Organización verificada")).toBeTruthy();
    expect(await screen.findByText("3 postulantes nuevos")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Postulaciones por etapa: 2 enviadas, 0 en revisión, 1 entrevista, 0 aceptadas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Publicar una nueva oferta/ })).toBeTruthy();
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

  it("cambia de vista con las pestañas y abre el registro con el perfil elegido", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" })));
    render(<AuthScreen navigate={vi.fn()} />);

    const loginTab = screen.getByRole("tab", { name: "Iniciar sesión" });
    expect(loginTab.getAttribute("aria-selected")).toBe("true");

    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: "Mostrar contraseña" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta de empresa" }));
    expect(screen.getByRole("tab", { name: "Crear cuenta" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("radio", { name: /Empresa/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Nombre de la organización")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Acceso" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Iniciar sesión" }).getAttribute("aria-selected")).toBe("true");
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
    expect(await screen.findByRole("heading", { name: "Estadísticas de empleo" })).toBeTruthy();
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
