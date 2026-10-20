import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SESSION_EXPIRED_EVENT } from "../shared/api/client";
import type { ApiUser } from "../shared/api/account";
import { authApi } from "../features/auth/auth.api";
import { profileApi } from "../features/profile/profile.api";
import { applicationsApi } from "../features/applications/applications.api";
import { verificationsApi } from "../features/verifications/verifications.api";
import { mapApiApplications } from "../features/applications/applications.model";
import { offersApi } from "../features/offers/offers.api";
import { mapOfferToJob, toUiOffer } from "../features/offers/offers.model";
import ErrorBoundary from "./ErrorBoundary";
import { hashForScreen, routeFromHash, type HashRoute } from "./hashRoutes";
import { SCREENS } from "./routes";
import { mapUserToSession, resolveRole, SessionContext } from "./session";
import { HOME_SCREEN, type AppState, type Role, type Screen, type ScreenProps } from "./types";

// Estado global y acciones de la app. Cada pantalla recibe `state`, `navigate`
// y las acciones que necesita; la tabla de pantallas está en routes.tsx.

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

  // La primera pantalla tras iniciar sesión reemplaza la entrada del historial;
  // las siguientes agregan una, para que Atrás vuelva a la pantalla anterior.
  const replaceHashRef = useRef(true);

  // Abre la pantalla de un enlace con #. Un detalle (#oferta/12) carga antes la
  // oferta; si ya no está publicada, o el enlace no es del rol, va al inicio.
  // Cuenta las navegaciones: un detalle que termina de cargar después de que el
  // usuario fue a otra pantalla se descarta.
  const navigationRef = useRef(0);

  const openRoute = useCallback(async (route: HashRoute | null, role: Role) => {
    const navigation = ++navigationRef.current;
    if (!route || route.id === undefined) {
      setState((current) => current.role === role ? { ...current, screen: route?.screen ?? HOME_SCREEN[role] } : current);
      window.scrollTo({ top: 0 });
      return;
    }
    const detailId = route.id;
    try {
      const { offer } = await offersApi.getOffer(detailId);
      if (navigation !== navigationRef.current) return;
      const detail = route.screen === "external-job-detail" ? { selectedJob: mapOfferToJob(offer) } : { selectedOffer: toUiOffer(offer) };
      setState((current) => current.role === role ? { ...current, ...detail, screen: route.screen } : current);
    } catch {
      if (navigation !== navigationRef.current) return;
      replaceHashRef.current = true;
      setState((current) => current.role === role ? { ...current, screen: HOME_SCREEN[role] } : current);
    }
    window.scrollTo({ top: 0 });
  }, []);

  // Pantalla con la que empieza la sesión: la del # de la URL si es del rol
  // (por ejemplo, al recargar), o el inicio del rol. Un detalle se abre después de cargarlo.
  const startScreen = (role: Role): Screen => {
    replaceHashRef.current = true;
    const route = routeFromHash(window.location.hash, role);
    if (route?.id !== undefined) {
      void openRoute(route, role);
      return HOME_SCREEN[role];
    }
    return route?.screen ?? HOME_SCREEN[role];
  };

  const reloadApplications = useCallback(async () => {
    if (!state.token) return;
    try {
      const response = await applicationsApi.getMyApplications(state.token);
      const applications = mapApiApplications(response.applications ?? []);
      setState((current) => ({ ...current, applications }));
    } catch (error) {
      console.error("getMyApplications failed:", error);
    }
  }, [state.token]);

  // Al recuperar una sesión guardada se valida el token y se carga el perfil.
  useEffect(() => {
    if (!state.booting || !state.token) return;
    const token = state.token;
    // Si el efecto se repite (StrictMode en desarrollo), solo cuenta la última
    // respuesta; una anterior que llegue tarde no debe volver a elegir la pantalla.
    let active = true;

    profileApi.getCurrentUser(token)
      .then((data) => {
        if (!active) return;
        const user = mapUserToSession(data.user);
        const role = resolveRole(user);
        const screen = startScreen(role);
        setState((current) => ({ ...current, currentUser: user, role, screen, booting: false }));
      })
      .catch((error) => {
        if (!active) return;
        const expired = error?.status === 401 || error?.status === 403;
        logout(expired ? "Tu sesión expiró. Inicia sesión nuevamente." : error instanceof Error ? error.message : "");
      });
    return () => { active = false; };
  }, [state.booting, state.token, logout]);

  // El revisor ve en el menú cuántas solicitudes de verificación esperan decisión.
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const refreshPendingVerifications = useCallback(() => {
    if (!state.token || state.role !== "admin") {
      setPendingVerifications(0);
      return;
    }
    verificationsApi.getVerificationSummary(state.token)
      .then((response) => setPendingVerifications(Number(response.pendientes) || 0))
      .catch((error) => console.error("getVerificationSummary failed:", error));
  }, [state.token, state.role]);

  useEffect(() => {
    refreshPendingVerifications();
  }, [refreshPendingVerifications]);

  // Las postulaciones del candidato alimentan las insignias y notificaciones.
  useEffect(() => {
    if (state.token && (state.role === "student" || state.role === "external")) {
      void reloadApplications();
    }
  }, [state.token, state.role, reloadApplications]);

  // La pantalla actual se refleja en el # de la URL.
  useEffect(() => {
    if (!state.role || state.screen === "auth") return;
    const detailId = state.screen === "external-job-detail" ? state.selectedJob?.id : state.selectedOffer?.id;
    const hash = hashForScreen(state.screen, detailId);
    if (!hash) return;
    if (window.location.hash !== hash) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (replaceHashRef.current) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    }
    replaceHashRef.current = false;
  }, [state.role, state.screen, state.selectedOffer, state.selectedJob]);

  // Atrás, Adelante o un # escrito a mano cambian de pantalla.
  useEffect(() => {
    const role = state.role;
    if (!role) return;
    const onHashChange = () => {
      const route = routeFromHash(window.location.hash, role);
      // Un enlace que no es del rol se reemplaza por el inicio sin dejarlo en el historial.
      if (!route) replaceHashRef.current = true;
      void openRoute(route, role);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [state.role, openRoute]);

  const navigate = (screen: Screen, extra?: Partial<AppState>) => {
    navigationRef.current += 1;
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
      notice: "",
    }));
    const screen = startScreen(role);
    setState((current) => current.token === token ? { ...current, screen } : current);

    // Login y registro devuelven la cuenta sin el detalle de los perfiles
    // (universidad, razón social, ubicación...); se completa con /profile/me.
    profileApi.getCurrentUser(token)
      .then((data) => setState((current) => current.token === token ? { ...current, currentUser: mapUserToSession(data.user) } : current))
      .catch((error) => console.error("getCurrentUser failed:", error));
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    startSession(response.token, response.user);
  };

  const register = async (payload: Record<string, unknown>) => {
    const response = await authApi.register(payload);
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
    const response = await profileApi.updateExternalProfile(payload, requireToken());
    setCurrentUser(response.user);
  };

  const updateStudentProfile = async (payload: Record<string, unknown>) => {
    const token = requireToken();
    await profileApi.updateCurrentUser({ nombreCompleto: payload.nombreCompleto, telefono: payload.telefono }, token);
    const response = await profileApi.updateStudentProfile({
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
    await profileApi.updateCurrentUser({ nombreCompleto: payload.nombreCompleto, telefono: payload.telefono }, token);
    const response = await profileApi.updateOrganizationProfile({
      razonSocial: payload.razonSocial,
      identificacionFiscal: payload.identificacionFiscal,
      sitioWeb: payload.sitioWeb,
      descripcion: payload.descripcion,
    }, token);
    setCurrentUser(response.user);
  };

  // El cambio de contraseña cierra las demás sesiones y entrega un token nuevo.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await profileApi.changePassword(currentPassword, newPassword, requireToken());
    if (response.token) setState((current) => ({ ...current, token: response.token }));
  };

  // Recarga la cuenta tras cambios que el servidor calcula (por ejemplo, archivos).
  const refreshCurrentUser = async () => {
    const response = await profileApi.getCurrentUser(requireToken());
    setCurrentUser(response.user);
  };

  // Sirve para la oferta del estudiante (Offer) y la vacante del externo (Job).
  const applyToOffer = async (offer: { id: number; title: string }) => {
    const token = requireToken();
    if (state.applications.some((a) => a.offerId === offer.id)) return;
    await applicationsApi.applyToOffer(String(offer.id), token, { cartaPresentacion: `Postulación a ${offer.title}` });
    await reloadApplications();
  };

  const withdrawApplication = async (applicationId: number) => {
    await applicationsApi.withdrawApplication(applicationId, requireToken());
    await reloadApplications();
  };

  const updateCandidateStatus = async (id: number, status: "Aceptada" | "Rechazada") => {
    await applicationsApi.updateApplicationStatus(id, status === "Aceptada" ? "ACEPTADA" : "RECHAZADA", requireToken());
  };

  const session = useMemo(() => ({
    role: state.role,
    currentUser: state.currentUser,
    applications: state.applications,
    pendingVerifications,
    refreshPendingVerifications,
    logout: () => logout(),
  }), [state.role, state.currentUser, state.applications, pendingVerifications, refreshPendingVerifications, logout]);

  if (state.booting) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6" role="status">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-[#0d2240]/15 border-t-[#0d2240] animate-spin" aria-hidden="true" />
          <p className="font-semibold text-[var(--primary-dark)]">Cargando tu sesión...</p>
          <p className="text-sm text-[var(--muted)] mt-1">Si el servidor estaba inactivo puede tardar hasta un minuto.</p>
        </div>
      </main>
    );
  }

  const props: ScreenProps = {
    state, navigate, applyToOffer, withdrawApplication, reloadApplications, updateCandidateStatus,
    updateExternalProfile, updateStudentProfile, updateOrganizationProfile, changePassword, login, register,
    refreshCurrentUser, clearResetToken,
  };

  // Sin sesión iniciada, cualquier pantalla distinta del acceso muestra el acceso.
  const screen = state.screen !== "auth" && !state.currentUser ? "auth" : state.screen;
  const CurrentScreen = SCREENS[screen] ?? SCREENS.auth;

  return (
    <SessionContext.Provider value={session}>
      <ErrorBoundary key={screen} onReset={() => navigate(state.role ? HOME_SCREEN[state.role] : "auth")}>
        <CurrentScreen {...props} />
      </ErrorBoundary>
    </SessionContext.Provider>
  );
}
