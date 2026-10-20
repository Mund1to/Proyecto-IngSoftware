// Tabla de pantallas: para agregar una, se crea el componente en su
// funcionalidad, se suma su nombre a `Screen` (types.ts) y se registra aquí.
import type { ComponentType } from "react";
import type { Screen, ScreenProps } from "./types";
import AuthScreen from "../features/auth/AuthScreen";
import StudentDashboard from "../features/offers/StudentDashboard";
import OfferDetail from "../features/offers/OfferDetail";
import CompanyDashboard from "../features/offers/CompanyDashboard";
import ExternalDashboard from "../features/offers/ExternalDashboard";
import ExternalJobDetail from "../features/offers/ExternalJobDetail";
import StudentApplications from "../features/applications/StudentApplications";
import CompanyApplicants from "../features/applications/CompanyApplicants";
import ExternalApplications from "../features/applications/ExternalApplications";
import StudentProfile from "../features/profile/StudentProfile";
import CompanyProfile from "../features/profile/CompanyProfile";
import ExternalProfile from "../features/profile/ExternalProfile";
import CompanyVerification from "../features/verifications/CompanyVerification";
import Convocatorias from "../features/convocatorias/Convocatorias";
import EmploymentStats from "../features/stats/EmploymentStats";
import AdminUsers from "../features/admin/AdminUsers";

// Cada pantalla toma de ScreenProps solo lo que necesita.
export const SCREENS: Record<Screen, ComponentType<ScreenProps>> = {
  "auth": AuthScreen,
  "student-dashboard": StudentDashboard,
  "offer-detail": OfferDetail,
  "student-profile": StudentProfile,
  "student-applications": StudentApplications,
  "company-dashboard": CompanyDashboard,
  "company-applicants": CompanyApplicants,
  "company-profile": CompanyProfile,
  "company-verification": CompanyVerification,
  "convocatorias": Convocatorias,
  "employment-stats": EmploymentStats,
  "admin-users": AdminUsers,
  "external-dashboard": ExternalDashboard,
  "external-job-detail": ExternalJobDetail,
  "external-profile": ExternalProfile,
  "external-applications": ExternalApplications,
};
