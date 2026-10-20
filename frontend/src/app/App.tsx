import { useCallback, useEffect, useMemo, useState } from "react";
import { SESSION_EXPIRED_EVENT } from "../shared/api/client";
import type { ApiUser } from "../shared/api/account";
import { authApi } from "../features/auth/auth.api";
import { profileApi } from "../features/profile/profile.api";
import { applicationsApi } from "../features/applications/applications.api";
import { verificationsApi } from "../features/verifications/verifications.api";
import { mapApiApplications } from "../features/applications/applications.model";
import ErrorBoundary from "./ErrorBoundary";
import { SCREENS } from "./routes";
import { mapUserToSession, resolveRole, SessionContext } from "./session";
import { HOME_SCREEN, type AppState, type Screen } from "./types";

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

    profileApi.getCurrentUser(token)
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
