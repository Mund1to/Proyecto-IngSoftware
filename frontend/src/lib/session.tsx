import { createContext, useContext } from "react";
import type { Application, JobApplication, Role, UserSession } from "../App";

// Datos de sesión que necesitan componentes compartidos (barra de navegación)
// sin recibirlos por props desde cada pantalla.
export type SessionContextValue = {
  role: Role | null;
  currentUser: UserSession | null;
  applications: Application[];
  jobApplications: JobApplication[];
  logout: () => void;
};

export const SessionContext = createContext<SessionContextValue>({
  role: null,
  currentUser: null,
  applications: [],
  jobApplications: [],
  logout: () => undefined,
});

export const useSession = () => useContext(SessionContext);

export const ADMIN_ROLES = ["ADMINISTRADOR", "FUNCIONARIO_PUBLICO"];

export function isAdminUser(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => ADMIN_ROLES.includes(role));
}
