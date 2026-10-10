import { useEffect, useMemo, useState } from "react";
import { HOME_SCREEN, Role, Screen } from "../App";
import { useSession } from "../lib/session";
import UniversityLogo from "./UniversityLogo";
import { IconBell, IconExit, IconMenu } from "./icons";

type Props = { role: Role; navigate: (screen: Screen) => void; activeScreen: Screen; userName?: string; onLogout?: () => void };

const links: Record<Role, { label: string; screen: Screen }[]> = {
  student: [
    { label: "Ofertas", screen: "student-dashboard" },
    { label: "Mis postulaciones", screen: "student-applications" },
    { label: "Mi perfil", screen: "student-profile" },
  ],
  company: [
    { label: "Ofertas", screen: "company-dashboard" },
    { label: "Postulantes", screen: "company-applicants" },
    { label: "Mi empresa", screen: "company-profile" },
  ],
  external: [
    { label: "Ofertas", screen: "external-dashboard" },
    { label: "Mis postulaciones", screen: "external-applications" },
    { label: "Mi perfil", screen: "external-profile" },
  ],
  admin: [
    { label: "Estadísticas", screen: "employment-stats" },
    { label: "Verificación", screen: "company-verification" },
    { label: "Convocatorias", screen: "convocatorias" },
    { label: "Usuarios", screen: "admin-users" },
  ],
};

// Pantalla de perfil de cada rol; el administrador no tiene perfil propio.
const profileScreen: Partial<Record<Role, Screen>> = {
  student: "student-profile",
  company: "company-profile",
  external: "external-profile",
};

const initialsOf = (value: string) =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "U";

type NotificationItem = { id: string; title: string; detail: string; screen: Screen };

const statusText: Record<string, string> = {
  "En revisión": "está en revisión",
  Aceptada: "fue aceptada",
  Rechazada: "no fue seleccionada",
};

export default function NavBar({ role: requestedRole, navigate, activeScreen, userName, onLogout }: Props) {
  const session = useSession();
  // La sesión manda: un administrador ve su menú aunque la pantalla pida otro.
  const role = session.role ?? requestedRole;
  const [open, setOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const name = userName ?? session.currentUser?.nombreCompleto ?? "Usuario";
  const firstName = name.split(/\s+/).filter(Boolean)[0] ?? name;
  const ownProfile = profileScreen[role];
  const notificationKey = `sipu-read-notifications-${session.currentUser?.id ?? "anon"}`;
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  // Notificaciones reales: cambios de estado en las postulaciones del candidato.
  const notifications = useMemo<NotificationItem[]>(() => {
    const target: Screen = role === "external" ? "external-applications" : "student-applications";
    const items = role === "external"
      ? session.jobApplications.map((app) => ({ id: app.id, title: app.jobTitle, company: app.company, status: app.status }))
      : session.applications.map((app) => ({ id: app.id, title: app.offerTitle, company: app.company, status: app.status }));

    return items
      .filter((app) => statusText[app.status])
      .map((app) => ({
        id: `${app.id}-${app.status}`,
        title: `Tu postulación ${statusText[app.status]}`,
        detail: `${app.title} · ${app.company}`,
        screen: target,
      }));
  }, [role, session.applications, session.jobApplications]);

  const unreadCount = notifications.filter((item) => !readNotifications.includes(item.id)).length;

  useEffect(() => {
    try {
      localStorage.setItem(notificationKey, JSON.stringify(readNotifications));
    } catch {
      // Sin almacenamiento las notificaciones se marcan como leídas solo en memoria.
    }
  }, [notificationKey, readNotifications]);

  const markRead = (ids: string[]) => setReadNotifications((current) => [...new Set([...current, ...ids])]);
  const logout = () => (onLogout ?? session.logout)();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="nav-logo" aria-label="Ir al inicio" onClick={() => navigate(HOME_SCREEN[role])}>
          <UniversityLogo decorative />
        </button>
        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Navegación principal">
          {links[role].map((link) => (
            <button key={link.screen} className={activeScreen === link.screen ? "active" : ""} aria-current={activeScreen === link.screen ? "page" : undefined} onClick={() => { navigate(link.screen); setOpen(false); }}>
              {link.label}
            </button>
          ))}
          {/* En el celular el botón circular de salida se oculta; aquí queda accesible. */}
          <button className="nav-menu-logout" onClick={() => { setOpen(false); logout(); }}>
            <IconExit size={18} /> Cerrar sesión
          </button>
        </nav>
        <div className="nav-actions">
          <div className="notification-wrap">
            <button className="icon-button nav-circle" aria-label={`Notificaciones, ${unreadCount} sin leer`} aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)}>
              <IconBell />{unreadCount > 0 && <span className="badge" aria-hidden="true">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="notification-panel" role="dialog" aria-label="Notificaciones">
                <div className="notification-heading">
                  <strong>Notificaciones</strong>
                  {notifications.length > 0 && <button className="text-button" onClick={() => markRead(notifications.map((item) => item.id))}>Marcar como leídas</button>}
                </div>
                {notifications.length === 0 ? (
                  <p className="muted" style={{ padding: "0.75rem 1rem" }}>No tienes notificaciones nuevas.</p>
                ) : notifications.map((item) => (
                  <Notification
                    key={item.id}
                    read={readNotifications.includes(item.id)}
                    title={item.title}
                    detail={item.detail}
                    onClick={() => { markRead([item.id]); setShowNotifications(false); navigate(item.screen); }}
                  />
                ))}
              </div>
            )}
          </div>
          {ownProfile ? (
            <button className="user-chip" aria-label={`Mi perfil: ${name}`} onClick={() => { navigate(ownProfile); setOpen(false); }}>
              <span className="user-avatar" aria-hidden="true">{initialsOf(name)}</span>
              <span className="user-name">{firstName}</span>
            </button>
          ) : (
            <span className="user-chip" title={name}>
              <span className="user-avatar" aria-hidden="true">{initialsOf(name)}</span>
              <span className="user-name">{firstName}</span>
            </span>
          )}
          <button className="icon-button nav-circle nav-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}><IconExit /></button>
          <button className="menu-button nav-circle" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)}><IconMenu /></button>
        </div>
      </div>
    </header>
  );
}

function Notification({ read, title, detail, onClick }: { read: boolean; title: string; detail: string; onClick: () => void }) {
  return <button className="notification" onClick={onClick} aria-label={`${title}. ${read ? "Leída" : "No leída"}`}><span className="notification-dot" style={{ opacity: read ? 0.25 : 1 }} /><span><strong>{title}</strong><small>{detail}</small></span></button>;
}
