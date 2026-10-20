import { createContext, useContext } from "react";
import type { ApiUser, StoredFile } from "../shared/api/account";
import type { Application, JobApplication } from "../features/applications/applications.model";
import type { Role } from "./types";

// Usuario de la sesión: la cuenta con los datos de sus perfiles aplanados.
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

// Datos de sesión que necesitan componentes compartidos (barra de navegación)
// sin recibirlos por props desde cada pantalla.
export type SessionContextValue = {
  role: Role | null;
  currentUser: UserSession | null;
  applications: Application[];
  jobApplications: JobApplication[];
  // Solicitudes de verificación pendientes (solo para administradores y funcionarios).
  pendingVerifications: number;
  refreshPendingVerifications: () => void;
  logout: () => void;
};

export const SessionContext = createContext<SessionContextValue>({
  role: null,
  currentUser: null,
  applications: [],
  jobApplications: [],
  pendingVerifications: 0,
  refreshPendingVerifications: () => undefined,
  logout: () => undefined,
});

export const useSession = () => useContext(SessionContext);

export const ADMIN_ROLES = ["ADMINISTRADOR", "FUNCIONARIO_PUBLICO"];

export function isAdminUser(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => ADMIN_ROLES.includes(role));
}

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
