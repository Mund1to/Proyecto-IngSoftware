// Enlaces con # para cada pantalla (por ejemplo #estadisticas o #oferta/12).
// La URL refleja la pantalla actual, se puede recargar o compartir y el botón
// Atrás del navegador vuelve a la pantalla anterior. Los roles comparten nombres
// (#ofertas), pero cada uno los resuelve a su propia pantalla.
import type { Role, Screen } from "./types";

export const ROLE_ROUTES: Record<Role, Record<string, Screen>> = {
  student: {
    ofertas: "student-dashboard",
    oferta: "offer-detail",
    postulaciones: "student-applications",
    perfil: "student-profile",
  },
  company: {
    ofertas: "company-dashboard",
    postulantes: "company-applicants",
    empresa: "company-profile",
  },
  external: {
    ofertas: "external-dashboard",
    vacante: "external-job-detail",
    postulaciones: "external-applications",
    perfil: "external-profile",
  },
  admin: {
    estadisticas: "employment-stats",
    solicitudes: "company-verification",
    convocatorias: "convocatorias",
    usuarios: "admin-users",
  },
};

// Pantallas de detalle: su enlace lleva el id de la oferta (#oferta/12).
export const DETAIL_SCREENS: Screen[] = ["offer-detail", "external-job-detail"];

export type HashRoute = { screen: Screen; id?: number };

// "#oferta/12" -> { screen: "offer-detail", id: 12 }. Devuelve null si el enlace
// no existe para el rol o si a un detalle le falta un id válido.
export function routeFromHash(hash: string, role: Role): HashRoute | null {
  const [name, rawId] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  const screen = ROLE_ROUTES[role][name ?? ""];
  if (!screen) return null;

  if (!DETAIL_SCREENS.includes(screen)) return { screen };
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? { screen, id } : null;
}

// Pantalla (y oferta abierta, si es un detalle) -> "#oferta/12". Vacío si la
// pantalla no tiene enlace, como la de acceso.
export function hashForScreen(screen: Screen, detailId?: number | null): string {
  for (const routes of Object.values(ROLE_ROUTES)) {
    const name = Object.keys(routes).find((key) => routes[key] === screen);
    if (!name) continue;
    if (DETAIL_SCREENS.includes(screen)) return detailId ? `#${name}/${detailId}` : "";
    return `#${name}`;
  }
  return "";
}
