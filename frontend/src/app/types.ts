// Tipos de la navegación y del estado global de la app. Las pantallas los
// importan solo como tipos; este archivo no depende de ninguna pantalla.
import type { UserSession } from "./session";
import type { Job, Offer } from "../features/offers/offers.model";
import type { Application } from "../features/applications/applications.model";

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

// Pantalla de inicio de cada rol.
export const HOME_SCREEN: Record<Role, Screen> = {
  student: "student-dashboard",
  company: "company-dashboard",
  external: "external-dashboard",
  admin: "employment-stats",
};

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
  // Postulaciones del candidato (estudiante o profesional externo).
  applications: Application[];
};

// Cambia de pantalla; `extra` permite pasar la oferta o el filtro seleccionado.
export type Navigate = (screen: Screen, extra?: Partial<AppState>) => void;

// Lo que App entrega a todas las pantallas. Cada pantalla declara en sus Props
// solo la parte que usa; routes.tsx comprueba que sean compatibles.
export type ScreenProps = {
  state: AppState;
  navigate: Navigate;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, unknown>) => Promise<void>;
  clearResetToken: () => void;
  refreshCurrentUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateStudentProfile: (payload: Record<string, unknown>) => Promise<void>;
  updateExternalProfile: (payload: Record<string, unknown>) => Promise<void>;
  updateOrganizationProfile: (payload: Record<string, unknown>) => Promise<void>;
  // Sirve para la oferta del estudiante (Offer) y la vacante del externo (Job).
  applyToOffer: (offer: { id: number; title: string }) => Promise<void>;
  withdrawApplication: (applicationId: number) => Promise<void>;
  reloadApplications: () => Promise<void>;
  updateCandidateStatus: (id: number, status: "Aceptada" | "Rechazada") => Promise<void>;
};
