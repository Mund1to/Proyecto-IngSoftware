import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, SESSION_EXPIRED_EVENT, type ApiUser, type StoredFile } from "./lib/api";
import { mapApplicationStatus, type ApplicationStatus, type OfferType } from "./lib/offers";
import { isAdminUser, SessionContext } from "./lib/session";
import AuthScreen from "./screens/AuthScreen";
import StudentDashboard from "./screens/StudentDashboard";
import OfferDetail from "./screens/OfferDetail";
import StudentProfile from "./screens/StudentProfile";
import StudentApplications from "./screens/StudentApplications";
import CompanyDashboard from "./screens/CompanyDashboard";
import CompanyApplicants from "./screens/CompanyApplicants";
import CompanyProfile from "./screens/CompanyProfile";
import CompanyVerification from "./screens/CompanyVerification";
import Convocatorias from "./screens/Convocatorias";
import EmploymentStats from "./screens/EmploymentStats";
import AdminUsers from "./screens/AdminUsers";
import ExternalDashboard from "./screens/ExternalDashboard";
import ExternalJobDetail from "./screens/ExternalJobDetail";
import ExternalProfile from "./screens/ExternalProfile";
import ExternalApplications from "./screens/ExternalApplications";

export type Role = "student" | "company" | "external" | "admin";

export type Screen =
  | "auth"
  | "student-dashboard"
  | "offer-detail"
  | "student-profile"
  | "student-applications"
  | "company-dashboard"
  | "company-applicants"
  | "company-profile"
  | "company-verification"
  | "convocatorias"
  | "employment-stats"
  | "admin-users"
  | "external-dashboard"
  | "external-job-detail"
  | "external-profile"
  | "external-applications";

export type UserSession = {
  id: number;
  email: string;
  nombreCompleto: string;
  telefono?: string | null;
  universidad?: string | null;
  programaAcademico?: string | null;
  semestre?: number | string | null;
  codigoEstudiante?: string | null;
  fechaGraduacionEstimada?: string | null;
  resumen?: string | null;
  ubicacion?: string | null;
  disponibilidad?: string | null;
  cvUrl?: string | null;
  organizacionNombre?: string | null;
  organizacionVerificada?: boolean;
  identificacionFiscal?: string | null;
  sitioWeb?: string | null;
  descripcionOrganizacion?: string | null;
  profileTypes: string[];
  roles: string[];
  archivos?: StoredFile[];
};

export type Offer = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: "Presencial" | "Remota" | "Híbrida";
  closeDate: string;
  salary: string;
  description: string;
  requirements: string[];
  applicants?: number;
  offerType?: OfferType;
  status?: string;
  verified?: boolean;
  duration?: string | null;
  schedule?: string | null;
  contactEmail?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
};

export type JobType = "Práctica" | "Tiempo completo" | "Medio tiempo" | "Contrato" | "Freelance" | "Formación";

export type Job = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: "Presencial" | "Remota" | "Híbrida";
  type: JobType;
  closeDate: string;
  salaryMin: number;
  salaryMax: number;
  experience: string;
  description: string;
  requirements: string[];
  benefits: string[];
  applicants: number;
};

export type Application = {
  id: number;
  offerId: number;
  offerTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus;
};

export type JobApplication = {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus | "Entrevista";
};

export const HOME_SCREEN: Record<Role, Screen> = {
  student: "student-dashboard",
  company: "company-dashboard",
  external: "external-dashboard",
  admin: "employment-stats",
};

// Los roles institucionales tienen prioridad: un administrador ve el panel de
// administración aunque su cuenta se haya creado como estudiante.
export const resolveRole = (user: Pick<UserSession, "profileTypes" | "roles">): Role => {
  if (isAdminUser(user.roles)) return "admin";
  if (user.profileTypes.includes("ORGANIZACION")) return "company";
  if (user.profileTypes.includes("CANDIDATO_EXTERNO")) return "external";
  return "student";
};

export const mapUserToSession = (user: ApiUser): UserSession => {
  const studentProfile = user.perfiles?.find((profile) => profile.tipo === "ESTUDIANTE");
  const externalProfile = user.perfiles?.find((profile) => profile.tipo === "CANDIDATO_EXTERNO");
  const organizationProfile = user.perfiles?.find((profile) => profile.tipo === "ORGANIZACION");
  const profileTypes = user.profileTypes?.length
    ? user.profileTypes
    : (user.perfiles ?? []).map((profile) => profile.tipo).filter((tipo): tipo is string => Boolean(tipo));

  return {
    id: Number(user.id),
    email: user.email,
    nombreCompleto: user.nombreCompleto,
    telefono: user.telefono,
    universidad: studentProfile?.universidad,
    programaAcademico: studentProfile?.programaAcademico,
    semestre: studentProfile?.semestre,
    codigoEstudiante: studentProfile?.codigoEstudiante,
    fechaGraduacionEstimada: studentProfile?.fechaGraduacionEstimada,
    resumen: externalProfile?.resumen,
    ubicacion: externalProfile?.ubicacion,
    disponibilidad: externalProfile?.disponibilidad,
    cvUrl: externalProfile?.cvUrl,
    organizacionNombre: organizationProfile?.razonSocial,
    organizacionVerificada: organizationProfile?.verificada,
    identificacionFiscal: organizationProfile?.identificacionFiscal,
    sitioWeb: organizationProfile?.sitioWeb,
    descripcionOrganizacion: organizationProfile?.descripcion,
    profileTypes: profileTypes.length ? profileTypes : ["ESTUDIANTE"],
    roles: user.roles ?? ["USUARIO"],
    archivos: user.archivos ?? [],
  };
};

// Todas las postulaciones del candidato, sin importar el tipo de oferta: un
// estudiante puede postularse a un empleo y un externo a una práctica.
export const mapApiApplications = (items: any[]): Application[] => items.map((item) => ({
  id: Number(item.id),
  offerId: Number(item.oferta_id),
  offerTitle: item.oferta_titulo ?? "Oferta",
  company: item.empresa ?? "Empresa",
  appliedDate: String(item.created_at ?? new Date().toISOString()).slice(0, 10),
  status: mapApplicationStatus(item.estado),
}));

export const toJobApplications = (applications: Application[]): JobApplication[] => applications.map((item) => ({
  id: item.id,
  jobId: item.offerId,
  jobTitle: item.offerTitle,
  company: item.company,
  appliedDate: item.appliedDate,
  status: item.status,
}));

export type AppState = {
  screen: Screen;
  role: Role | null;
  token: string | null;
  booting: boolean;
  notice: string;
  // Token de recuperación recibido en el enlace del correo (?reset=...).
  resetToken: string | null;
  currentUser: UserSession | null;
  selectedOffer: Offer | null;
  selectedJob: Job | null;
  selectedCompanyOffer: Offer | null;
  applicantFilter?: "Todos" | "En revisión" | "Aceptada" | "Rechazada";
  applications: Application[];
  jobApplications: JobApplication[];
};

function readResetToken(): string | null {
  const token = new URLSearchParams(window.location.search).get("reset");
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem("sipu-token");
  } catch {
    return null;
  }
}

const signedOutState = {
  token: null,
  currentUser: null,
  role: null,
  screen: "auth" as Screen,
  booting: false,
  applications: [],
  jobApplications: [],
  selectedOffer: null,
  selectedJob: null,
  selectedCompanyOffer: null,
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const resetToken = readResetToken();
    // Al abrir un enlace de recuperación se ignora la sesión guardada.
    const storedToken = resetToken ? null : readStoredToken();
    return {
      ...signedOutState,
      token: storedToken,
      // Con un token guardado se muestra una pantalla de carga mientras se valida.
      booting: Boolean(storedToken),
      notice: "",
      resetToken,
    };
  });

  const clearResetToken = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setState((current) => ({ ...current, resetToken: null }));
  };

  useEffect(() => {
    try {
      if (state.token) localStorage.setItem("sipu-token", state.token);
      else localStorage.removeItem("sipu-token");
      // La versión anterior guardaba aquí el usuario completo; ya no se usa.
      localStorage.removeItem("sipu-user");
    } catch {
      // El navegador puede bloquear el almacenamiento; la sesión sigue en memoria.
    }
  }, [state.token]);

  const logout = useCallback((notice = "") => {
    setState((current) => ({ ...current, ...signedOutState, notice }));
  }, []);

  useEffect(() => {
    const onExpired = () => logout("Tu sesión expiró. Inicia sesión nuevamente.");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  const reloadApplications = useCallback(async () => {
    if (!state.token) return;
    try {
      const response = await api.getMyApplications(state.token);
      const applications = mapApiApplications(response.applications ?? []);
      setState((current) => ({ ...current, applications, jobApplications: toJobApplications(applications) }));
    } catch (error) {
      console.error("getMyApplications failed:", error);
    }
  }, [state.token]);

  // Al recuperar una sesión guardada se valida el token y se carga el perfil.
  useEffect(() => {
    if (!state.booting || !state.token) return;
    const token = state.token;

    api.getCurrentUser(token)
      .then((data) => {
        const user = mapUserToSession(data.user);
        const role = resolveRole(user);
        setState((current) => ({ ...current, currentUser: user, role, screen: HOME_SCREEN[role], booting: false }));
      })
      .catch((error) => {
        const expired = error?.status === 401 || error?.status === 403;
        logout(expired ? "Tu sesión expiró. Inicia sesión nuevamente." : error instanceof Error ? error.message : "");
      });
  }, [state.booting, state.token, logout]);

  // Las postulaciones del candidato alimentan las insignias y notificaciones.
  useEffect(() => {
    if (state.token && (state.role === "student" || state.role === "external")) {
      void reloadApplications();
    }
  }, [state.token, state.role, reloadApplications]);

  const navigate = (screen: Screen, extra?: Partial<AppState>) => {
    setState((s) => ({ ...s, screen, ...extra }));
    window.scrollTo({ top: 0 });
  };

  const startSession = (token: string, apiUser: ApiUser) => {
    const user = mapUserToSession(apiUser);
    const role = resolveRole(user);
    setState((current) => ({
      ...current,
      ...signedOutState,
      token,
      currentUser: user,
      role,
      screen: HOME_SCREEN[role],
      notice: "",
    }));

    // Login y registro devuelven la cuenta sin el detalle de los perfiles
    // (universidad, razón social, ubicación...); se completa con /profile/me.
    api.getCurrentUser(token)
      .then((data) => setState((current) => current.token === token ? { ...current, currentUser: mapUserToSession(data.user) } : current))
      .catch((error) => console.error("getCurrentUser failed:", error));
  };

  const login = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    startSession(response.token, response.user);
  };

  const register = async (payload: Record<string, unknown>) => {
    const response = await api.register(payload);
    startSession(response.token, response.user);
  };

  const requireToken = () => {
    if (!state.token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    return state.token;
  };

  const setCurrentUser = (user: ApiUser) => {
    setState((current) => ({ ...current, currentUser: mapUserToSession(user) }));
  };

  const updateExternalProfile = async (payload: Record<string, unknown>) => {
    const response = await api.updateExternalProfile(payload, requireToken());
    setCurrentUser(response.user);
  };

  const updateStudentProfile = async (payload: Record<string, unknown>) => {
    const token = requireToken();
    await api.updateCurrentUser({ nombreCompleto: payload.nombreCompleto, telefono: payload.telefono }, token);
    const response = await api.updateStudentProfile({
      universidad: payload.universidad,
      programaAcademico: payload.programaAcademico,
      semestre: payload.semestre,
      codigoEstudiante: payload.codigoEstudiante,
      fechaGraduacionEstimada: payload.fechaGraduacionEstimada,
    }, token);
    setCurrentUser(response.user);
  };

  const updateOrganizationProfile = async (payload: Record<string, unknown>) => {
    const token = requireToken();
    await api.updateCurrentUser({ nombreCompleto: payload.nombreCompleto, telefono: payload.telefono }, token);
    const response = await api.updateOrganizationProfile({
      razonSocial: payload.razonSocial,
      identificacionFiscal: payload.identificacionFiscal,
      sitioWeb: payload.sitioWeb,
      descripcion: payload.descripcion,
    }, token);
    setCurrentUser(response.user);
  };

  // El cambio de contraseña cierra las demás sesiones y entrega un token nuevo.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await api.changePassword(currentPassword, newPassword, requireToken());
    if (response.token) setState((current) => ({ ...current, token: response.token }));
  };

  // Recarga la cuenta tras cambios que el servidor calcula (por ejemplo, archivos).
  const refreshCurrentUser = async () => {
    const response = await api.getCurrentUser(requireToken());
    setCurrentUser(response.user);
  };

  const applyToOffer = async (offer: Offer) => {
    const token = requireToken();
    if (state.applications.some((a) => a.offerId === offer.id)) return;
    await api.applyToOffer(String(offer.id), token, { cartaPresentacion: `Postulación a ${offer.title}` });
    await reloadApplications();
  };

  const applyToJob = async (job: Job) => {
    const token = requireToken();
    if (state.jobApplications.some((a) => a.jobId === job.id)) return;
    await api.applyToOffer(String(job.id), token, { cartaPresentacion: `Postulación a ${job.title}` });
    await reloadApplications();
  };

  const withdrawApplication = async (applicationId: number) => {
    await api.withdrawApplication(applicationId, requireToken());
    await reloadApplications();
  };

  const updateCandidateStatus = async (id: number, status: "Aceptada" | "Rechazada") => {
    await api.updateApplicationStatus(id, status === "Aceptada" ? "ACEPTADA" : "RECHAZADA", requireToken());
  };

  const session = useMemo(() => ({
    role: state.role,
    currentUser: state.currentUser,
    applications: state.applications,
    jobApplications: state.jobApplications,
    logout: () => logout(),
  }), [state.role, state.currentUser, state.applications, state.jobApplications, logout]);

  if (state.booting) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-6" role="status">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-[#0d2240]/15 border-t-[#0d2240] animate-spin" aria-hidden="true" />
          <p className="font-semibold text-[#0d2240]">Cargando tu sesión...</p>
          <p className="text-sm text-[#64748b] mt-1">Si el servidor estaba inactivo puede tardar hasta un minuto.</p>
        </div>
      </main>
    );
  }

  const props = {
    state, navigate, applyToOffer, applyToJob, withdrawApplication, reloadApplications, updateCandidateStatus,
    updateExternalProfile, updateStudentProfile, updateOrganizationProfile, changePassword, login, register,
    refreshCurrentUser, clearResetToken,
  };

  // Una pantalla que pide un rol distinto al de la sesión vuelve al inicio del rol.
  const screen = state.screen !== "auth" && !state.currentUser ? "auth" : state.screen;

  return (
    <SessionContext.Provider value={session}>
      <ErrorBoundary key={screen} onReset={() => navigate(state.role ? HOME_SCREEN[state.role] : "auth")}>
        {renderScreen(screen, props)}
      </ErrorBoundary>
    </SessionContext.Provider>
  );
}

function renderScreen(screen: Screen, props: any) {
  switch (screen) {
    case "auth":                  return <AuthScreen {...props} />;
    case "student-dashboard":     return <StudentDashboard {...props} />;
    case "offer-detail":          return <OfferDetail {...props} />;
    case "student-profile":       return <StudentProfile {...props} />;
    case "student-applications":  return <StudentApplications {...props} />;
    case "company-dashboard":     return <CompanyDashboard {...props} />;
    case "company-applicants":    return <CompanyApplicants {...props} />;
    case "company-profile":       return <CompanyProfile {...props} />;
    case "company-verification":  return <CompanyVerification {...props} />;
    case "convocatorias":         return <Convocatorias {...props} />;
    case "employment-stats":      return <EmploymentStats {...props} />;
    case "admin-users":           return <AdminUsers {...props} />;
    case "external-dashboard":    return <ExternalDashboard {...props} />;
    case "external-job-detail":   return <ExternalJobDetail {...props} />;
    case "external-profile":      return <ExternalProfile {...props} />;
    case "external-applications": return <ExternalApplications {...props} />;
    default:                      return <AuthScreen {...props} />;
  }
}

// Evita la pantalla en blanco: si una vista falla al renderizar se muestra un
// aviso con la opción de volver al inicio.
class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Screen crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-6">
        <div className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-8 max-w-md text-center" role="alert">
          <h1 className="text-lg font-bold text-[#0d2240] mb-2">Algo salió mal al mostrar esta pantalla</h1>
          <p className="text-sm text-[#64748b] mb-6">Puedes volver al inicio e intentarlo de nuevo.</p>
          <button className="button primary" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }
}
