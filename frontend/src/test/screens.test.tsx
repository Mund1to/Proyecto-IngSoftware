import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";
import { type AppState } from "../app/types";
import AdminUsers from "../features/admin/AdminUsers";
import AuthScreen from "../features/auth/AuthScreen";
import CompanyApplicants from "../features/applications/CompanyApplicants";
import CompanyDashboard from "../features/offers/CompanyDashboard";
import CompanyProfile from "../features/profile/CompanyProfile";
import CompanyVerification from "../features/verifications/CompanyVerification";
import EmploymentStats from "../features/stats/EmploymentStats";
import ExternalDashboard from "../features/offers/ExternalDashboard";
import OfferDetail from "../features/offers/OfferDetail";
import StudentDashboard from "../features/offers/StudentDashboard";

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
  id: "1", titulo: "Oferta de prueba", descripcion: "Desarrollo", tipo: "EMPLEO", estado: "PUBLICADA",
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

    expect(await screen.findByText("Oferta de prueba")).toBeTruthy();
    expect(screen.getAllByText("Híbrida").length).toBeGreaterThan(0);
  });

  it("no muestra prácticas: son solo para estudiantes", async () => {
    const practice = { ...brokenOffer, id: "9", titulo: "Práctica solo estudiantes", tipo: "PRACTICA" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, offers: [brokenOffer, practice] })));

    render(<ExternalDashboard state={baseState} navigate={vi.fn()} />);

    expect(await screen.findByText("Oferta de prueba")).toBeTruthy();
    expect(screen.queryByText("Práctica solo estudiantes")).toBeNull();
    expect(within(screen.getByRole("group", { name: "Tipo de vacante" })).queryByRole("button", { name: /Práctica/ })).toBeNull();
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
    expect(screen.queryByText("Oferta de prueba")).toBeNull();
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

  it("el panel de notificaciones se cierra con un clic fuera o con Escape", async () => {
    await renderDashboard();
    const bell = screen.getByRole("button", { name: /Notificaciones/ });

    fireEvent.click(bell);
    const panel = screen.getByRole("dialog", { name: "Notificaciones" });
    fireEvent.mouseDown(panel);
    expect(screen.getByRole("dialog", { name: "Notificaciones" })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Notificaciones" })).toBeNull();

    fireEvent.click(bell);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Notificaciones" })).toBeNull();
    expect(document.activeElement).toBe(bell);
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

describe("AdminUsers: cambio de contraseña", () => {
  it("marca la solicitud pendiente y asigna una contraseña generada", async () => {
    const person = { id: 8, email: "pedro@x.co", nombre_completo: "Pedro Olvido", activo: true, created_at: "2026-10-01", roles: ["USUARIO"], profile_types: ["CANDIDATO_EXTERNO"], solicitud_contrasena: "2026-10-10T15:00:00.000Z" };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(url.includes("/password")
      ? jsonResponse(200, { ok: true, message: "Contraseña actualizada.", user: { ...person, solicitud_contrasena: null }, sent: init?.body })
      : jsonResponse(200, { ok: true, users: [person] })));
    vi.stubGlobal("fetch", fetchMock);
    const adminState: AppState = { ...baseState, role: "admin", screen: "admin-users", currentUser: { id: 1, email: "admin@x.co", nombreCompleto: "Ana Admin", profileTypes: ["ESTUDIANTE"], roles: ["USUARIO", "ADMINISTRADOR"] } };
    render(<AdminUsers state={adminState} navigate={vi.fn()} />);

    expect(await screen.findByText(/Pidió cambiar su contraseña/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    const dialog = screen.getByRole("dialog", { name: "Cambiar contraseña" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generar una segura" }));
    const generated = (within(dialog).getByLabelText("Nueva contraseña") as HTMLInputElement).value;
    expect(generated).toMatch(/^(?=.*[A-Z])(?=.*\d).{8,}$/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByText(/Contraseña de Pedro Olvido actualizada/)).toBeTruthy();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/admin/users/8/password"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ password: generated });
    expect(screen.queryByText(/Pidió cambiar su contraseña/)).toBeNull();
  });
});

describe("CompanyApplicants: etapas", () => {
  it("avanza al postulante de Nueva a En revisión y a Entrevista", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(url.includes("/status")
      ? jsonResponse(200, { ok: true })
      : jsonResponse(200, { ok: true, applications: [{ id: 5, estado: "ENVIADA", postulante_nombre: "Sara Estudiante", perfil_tipo: "ESTUDIANTE", created_at: "2026-10-10T00:00:00.000Z" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const offer = { id: 4, title: "Práctica QA", company: "TS", logo: "TS", city: "Ibagué", area: "TI", modality: "Remota" as const, closeDate: "", salary: "", description: "", requirements: [] };
    const state: AppState = { ...baseState, role: "company", screen: "company-applicants", selectedCompanyOffer: offer };
    const updateCandidateStatus = vi.fn().mockResolvedValue(undefined);
    render(<CompanyApplicants state={state} navigate={vi.fn()} updateCandidateStatus={updateCandidateStatus} />);

    fireEvent.click(await screen.findByRole("button", { name: "Pasar a revisión: Sara Estudiante" }));
    fireEvent.click(await screen.findByRole("button", { name: "Citar a entrevista: Sara Estudiante" }));
    expect(await screen.findByRole("button", { name: "Aceptar: Sara Estudiante" })).toBeTruthy();

    const bodies = fetchMock.mock.calls.filter(([url]) => String(url).includes("/status")).map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.map((body) => body.estado ?? body.status)).toEqual(["EN_REVISION", "PRESELECCIONADA"]);
    expect(updateCandidateStatus).not.toHaveBeenCalled();
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

    expect(await screen.findByText("Oferta de prueba")).toBeTruthy();
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

describe("CompanyProfile: verificación documental", () => {
  const requisitos = {
    tipos: [
      { tipo: "RUT", etiqueta: "RUT (Registro Único Tributario)", obligatorio: true },
      { tipo: "CAMARA_COMERCIO", etiqueta: "Certificado de Cámara de Comercio", obligatorio: true },
      { tipo: "OTRO", etiqueta: "Otro documento de soporte", obligatorio: false },
    ],
    formatos: ["application/pdf", "image/png", "image/jpeg"],
    maxBytes: 5 * 1024 * 1024,
    maxDocumentos: 10,
    maxMensaje: 1000,
  };
  const rut = { id: 7, tipo: "RUT", nombre: "rut.pdf", mime: "application/pdf", tamano: 2048, createdAt: "2026-10-16T10:00:00.000Z" };
  const camara = { id: 8, tipo: "CAMARA_COMERCIO", nombre: "camara.pdf", mime: "application/pdf", tamano: 4096, createdAt: "2026-10-17T10:00:00.000Z" };
  const base = { estado: "SIN_SOLICITUD", verificada: false, solicitud: null, bloqueada: false, requisitos };
  const companyState: AppState = {
    ...baseState,
    role: "company",
    screen: "company-profile",
    currentUser: { id: 3, email: "rrhh@acme.co", nombreCompleto: "Ana Gómez", organizacionNombre: "Acme SAS", identificacionFiscal: "900123", profileTypes: ["ORGANIZACION"], roles: ["USUARIO"] },
  };

  const renderProfile = () => render(
    <CompanyProfile state={companyState} navigate={vi.fn()} updateOrganizationProfile={vi.fn()} changePassword={vi.fn()} refreshCurrentUser={vi.fn()} />,
  );

  it("adjunta el documento que falta y envía la solicitud", async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.includes("/verifications/me/documents")) {
        return Promise.resolve(jsonResponse(201, { ok: true, document: camara, verification: { ...base, documentos: [rut, camara], faltantes: [], puedeEnviar: true } }));
      }
      if (url.endsWith("/verifications/me/request") && options?.method === "POST") {
        return Promise.resolve(jsonResponse(201, {
          ok: true,
          verification: { ...base, estado: "PENDIENTE", bloqueada: true, documentos: [rut, camara], faltantes: [], puedeEnviar: false,
            solicitud: { id: 1, estado: "PENDIENTE", mensaje: "Gracias", observaciones: null, enviadaPorEmpresa: true, enviadaAt: "2026-10-17T12:00:00.000Z", revisadaAt: null, revisor: null } },
        }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, verification: { ...base, documentos: [rut], faltantes: ["CAMARA_COMERCIO"], puedeEnviar: false } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderProfile();

    const section = await screen.findByRole("region", { name: "Verificación de la empresa" });
    const requirements = within(section).getByRole("list", { name: "Requisitos para enviar la solicitud" });
    expect(within(requirements).getByText(/Certificado de Cámara de Comercio/).textContent).toContain("pendiente");
    expect((within(section).getByRole("combobox", { name: "Tipo de documento" }) as HTMLSelectElement).value).toBe("CAMARA_COMERCIO");
    expect((within(section).getByRole("button", { name: "Enviar solicitud de verificación" }) as HTMLButtonElement).disabled).toBe(true);

    // Un formato no admitido se rechaza sin llamar a la API.
    const input = within(section).getByLabelText("Archivo del documento");
    fireEvent.change(input, { target: { files: [new File(["x"], "nota.txt", { type: "text/plain" })] } });
    expect(within(section).getByRole("alert").textContent).toContain("PDF, PNG, JPG");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/documents"))).toBe(false);

    fireEvent.change(input, { target: { files: [new File(["%PDF-1.4"], "camara.pdf", { type: "application/pdf" })] } });
    expect(await within(section).findByText("camara.pdf")).toBeTruthy();
    const upload = fetchMock.mock.calls.find(([url]) => String(url).includes("/documents"))!;
    expect(String(upload[0])).toContain("tipo=CAMARA_COMERCIO");
    expect((upload[1]!.headers as Headers).get("X-File-Name")).toBe("camara.pdf");

    fireEvent.change(within(section).getByLabelText("Mensaje para el revisor (opcional)"), { target: { value: "Gracias" } });
    fireEvent.click(within(section).getByRole("button", { name: "Enviar solicitud de verificación" }));
    expect(await within(section).findByText("En revisión")).toBeTruthy();
    const sent = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/verifications/me/request") && options?.method === "POST")!;
    expect(JSON.parse(String(sent[1]!.body))).toEqual({ mensaje: "Gracias" });
    expect(within(section).queryByRole("button", { name: "Eliminar camara.pdf" })).toBeNull();
    expect(within(section).getByRole("button", { name: "Retirar solicitud" })).toBeTruthy();
  });

  it("muestra el motivo del rechazo y permite enviar de nuevo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {
      ok: true,
      verification: { ...base, estado: "RECHAZADA", documentos: [rut, camara], faltantes: [], puedeEnviar: true,
        solicitud: { id: 2, estado: "RECHAZADA", mensaje: null, observaciones: "El RUT no es legible.", enviadaPorEmpresa: true, enviadaAt: "2026-10-15T12:00:00.000Z", revisadaAt: "2026-10-16T12:00:00.000Z", revisor: "Admin" } },
    })));
    renderProfile();

    const section = await screen.findByRole("region", { name: "Verificación de la empresa" });
    expect(within(section).getByText("El RUT no es legible.")).toBeTruthy();
    expect(within(section).getByText("Rechazada")).toBeTruthy();
    expect((within(section).getByRole("button", { name: "Enviar de nuevo" }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(section).getByRole("button", { name: "Eliminar rut.pdf" })).toBeTruthy();
  });
});

describe("CompanyVerification: bandeja de solicitudes", () => {
  // jsdom no implementa las URL de objetos; se simulan solo en este bloque.
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => Object.assign(URL, { createObjectURL, revokeObjectURL }));

  const adminState: AppState = {
    ...baseState,
    role: "admin",
    screen: "company-verification",
    currentUser: { id: 9, email: "admin@x.co", nombreCompleto: "Admin", profileTypes: ["ESTUDIANTE"], roles: ["USUARIO", "ADMINISTRADOR"] },
  };
  const pendingRequest = {
    id: 21, estado: "PENDIENTE", mensaje: "Adjuntamos RUT vigente.", observaciones: null,
    documentos: [{ id: 7, tipo: "RUT", nombre: "rut.pdf", mime: "application/pdf", tamano: 2048 }],
    enviadaAt: "2026-10-16T10:00:00.000Z", revisadaAt: null, revisor: null,
    organizacion: { id: 4, razonSocial: "Acme SAS", identificacionFiscal: "900123", sitioWeb: "https://acme.co", descripcion: null, verificada: false },
    solicitante: { nombre: "Ana Gómez", email: "rrhh@acme.co", telefono: null },
  };

  it("abre documentos y rechaza con motivo obligatorio", async () => {
    let pending = [pendingRequest];
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.includes("/verifications/documents/")) {
        return Promise.resolve(new Response(new Blob(["%PDF"]), { status: 200, headers: { "content-type": "application/pdf" } }));
      }
      if (url.includes("/verifications/requests/21") && options?.method === "PATCH") {
        pending = [];
        return Promise.resolve(jsonResponse(200, { ok: true, request: { id: 21, estado: "RECHAZADA" }, organization: { verificada: false } }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, requests: pending, total: pending.length, page: 1, limit: 10 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => tab));
    URL.createObjectURL = vi.fn(() => "blob:documento");
    URL.revokeObjectURL = vi.fn();

    render(<CompanyVerification state={adminState} navigate={vi.fn()} />);

    const card = await screen.findByRole("article", { name: "Acme SAS" });
    expect(within(card).getByText("Adjuntamos RUT vigente.")).toBeTruthy();
    expect(within(card).getByText(/rrhh@acme\.co/)).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain("estado=PENDIENTE");

    fireEvent.click(within(card).getByRole("button", { name: "Ver rut.pdf de Acme SAS" }));
    await waitFor(() => expect(tab.location.href).toBe("blob:documento"));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/verifications/documents/7"))).toBe(true);

    fireEvent.click(within(card).getByRole("button", { name: "Rechazar verificación de Acme SAS" }));
    const dialog = screen.getByRole("dialog", { name: "Rechazar verificación" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rechazar verificación" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("mínimo 10 caracteres");

    fireEvent.change(within(dialog).getByLabelText("Motivo del rechazo"), { target: { value: "El RUT no corresponde al NIT." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rechazar verificación" }));

    expect(await screen.findByText("No hay solicitudes pendientes. ¡Todo al día!")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Acme SAS: solicitud rechazada");
    const decision = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(JSON.parse(String(decision[1]!.body))).toEqual({ estado: "RECHAZADA", observaciones: "El RUT no corresponde al NIT." });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("retira la verificación de una organización verificada con su propio texto", async () => {
    const verified = { organizacion_id: 5, razon_social: "Bancolombia", identificacion_fiscal: null, sitio_web: null, verificada: true, verificacion_estado: "APROBADA", observaciones: null, verificacion_fecha: null, documentos_count: 0 };
    const pending = { ...verified, organizacion_id: 6, razon_social: "Nueva SAS", verificada: false, verificacion_estado: null };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.includes("/verifications/organizations/5") && options?.method === "PATCH") {
        return Promise.resolve(jsonResponse(200, { ok: true, organization: { verificada: false }, verificationStatus: "RECHAZADA" }));
      }
      if (url.endsWith("/verifications/organizations")) return Promise.resolve(jsonResponse(200, { ok: true, organizations: [verified, pending] }));
      return Promise.resolve(jsonResponse(200, { ok: true, requests: [], total: 0, page: 1, limit: 10 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompanyVerification state={adminState} navigate={vi.fn()} />);
    await screen.findByText("No hay solicitudes pendientes. ¡Todo al día!");
    fireEvent.click(screen.getByRole("button", { name: "Organizaciones" }));

    // Una organización sin verificar conserva el texto de rechazo.
    fireEvent.click(await screen.findByRole("button", { name: "Rechazar verificación de Nueva SAS" }));
    expect(screen.getByRole("dialog", { name: "Rechazar verificación" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Retirar verificación de Bancolombia" }));
    const dialog = screen.getByRole("dialog", { name: "Retirar verificación" });
    expect(within(dialog).getByText(/dejará de estar verificada/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Retirar verificación" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("motivo del retiro");

    fireEvent.change(within(dialog).getByLabelText("Motivo del retiro"), { target: { value: "La matrícula mercantil fue cancelada." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retirar verificación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const patch = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ estado: "RECHAZADA", observaciones: "La matrícula mercantil fue cancelada." });
    expect(screen.getByRole("status").textContent).toContain("Bancolombia: verificación retirada");
  });

  it("muestra el historial con el revisor y las observaciones", async () => {
    const reviewed = { ...pendingRequest, id: 22, estado: "APROBADA", revisor: "Laura Díaz", revisadaAt: "2026-10-17T09:00:00.000Z", observaciones: "Documentos vigentes." };
    const fetchMock = vi.fn((url: string) => Promise.resolve(jsonResponse(200, {
      ok: true, requests: url.includes("estado=TODAS") ? [reviewed] : [], total: url.includes("estado=TODAS") ? 1 : 0, page: 1, limit: 10,
    })));
    vi.stubGlobal("fetch", fetchMock);

    render(<CompanyVerification state={adminState} navigate={vi.fn()} />);
    await screen.findByText("No hay solicitudes pendientes. ¡Todo al día!");

    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    const card = await screen.findByRole("article", { name: "Acme SAS" });
    expect(within(card).getByText(/Revisada por Laura Díaz/)).toBeTruthy();
    expect(within(card).getByText("Documentos vigentes.")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /Aprobar/ })).toBeNull();
  });
});

describe("NavBar: solicitudes pendientes", () => {
  it("muestra al administrador cuántas solicitudes esperan revisión", async () => {
    localStorage.setItem("sipu-token", "admin-token");
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/profile/me")) {
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          user: { id: 1, email: "admin@x.co", nombreCompleto: "Admin", roles: ["USUARIO", "ADMINISTRADOR"], perfiles: [{ tipo: "ESTUDIANTE" }] },
        }));
      }
      if (url.endsWith("/verifications/requests/summary")) return Promise.resolve(jsonResponse(200, { ok: true, pendientes: 3 }));
      return Promise.resolve(jsonResponse(200, { ok: true, stats: { totals: {}, offersByType: [], offersByArea: [], offersByCity: [], topOrganizations: [], applicationsByMonth: [] } }));
    }));

    render(<App />);
    expect(await screen.findByRole("button", { name: "Solicitudes, 3 pendientes" })).toBeTruthy();
  });
});
