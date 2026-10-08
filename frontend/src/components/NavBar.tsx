import { useEffect, useState } from "react";
import { Role, Screen } from "../App";
import UniversityLogo from "./UniversityLogo";

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
    { label: "Verificación", screen: "company-verification" },
    { label: "Convocatorias", screen: "convocatorias" },
    { label: "Estadísticas", screen: "employment-stats" },
  ],
  external: [
    { label: "Ofertas", screen: "external-dashboard" },
    { label: "Mis postulaciones", screen: "external-applications" },
    { label: "Mi perfil", screen: "external-profile" },
  ],
};

const home: Record<Role, Screen> = { student: "student-dashboard", company: "company-dashboard", external: "external-dashboard" };

export default function NavBar({ role, navigate, activeScreen, userName, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const name = userName ?? (role === "student" ? "Estudiante" : role === "company" ? "Empresa" : "Candidato");
  const notificationKey = `sipu-read-notifications-${role}-${name}`;
  const [readNotifications, setReadNotifications] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationKey) ?? "[]") as number[];
    } catch {
      return [];
    }
  });
  const unreadCount = 3 - readNotifications.length;

  useEffect(() => {
    localStorage.setItem(notificationKey, JSON.stringify(readNotifications));
  }, [notificationKey, readNotifications]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="nav-logo" aria-label="Ir al inicio" onClick={() => navigate(home[role])}>
          <UniversityLogo decorative />
        </button>
        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Navegación principal">
          {links[role].map((link) => (
            <button key={link.screen} className={activeScreen === link.screen ? "active" : ""} aria-current={activeScreen === link.screen ? "page" : undefined} onClick={() => { navigate(link.screen); setOpen(false); }}>
              {link.label}
            </button>
          ))}
        </nav>
        <div className="nav-actions">
          <div className="notification-wrap">
            <button className="icon-button" aria-label={`Notificaciones, ${unreadCount} sin leer`} aria-expanded={notifications} onClick={() => setNotifications(!notifications)}>
              <BellIcon />{unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            {notifications && (
              <div className="notification-panel" role="dialog" aria-label="Notificaciones">
                <div className="notification-heading"><strong>Notificaciones</strong><button className="text-button" onClick={() => setReadNotifications([0, 1, 2])}>Marcar como leídas</button></div>
                <Notification id={0} read={readNotifications.includes(0)} title="Tu postulación está en revisión" detail="Bancolombia revisó tu perfil." time="hace 12 min" onClick={() => { setReadNotifications((current) => current.includes(0) ? current : [...current, 0]); setNotifications(false); navigate(role === "student" ? "student-applications" : role === "external" ? "external-applications" : "company-dashboard"); }} />
                <Notification id={1} read={readNotifications.includes(1)} title="Nueva oferta para ti" detail="Practicante de desarrollo web." time="hace 2 h" onClick={() => { setReadNotifications((current) => current.includes(1) ? current : [...current, 1]); setNotifications(false); navigate(role === "student" ? "student-dashboard" : role === "external" ? "external-dashboard" : "company-dashboard"); }} />
                <Notification id={2} read={readNotifications.includes(2)} title="Entrevista programada" detail="Consulta los detalles del proceso." time="ayer" onClick={() => { setReadNotifications((current) => current.includes(2) ? current : [...current, 2]); setNotifications(false); navigate(role === "student" ? "student-applications" : role === "external" ? "external-applications" : "company-dashboard"); }} />
              </div>
            )}
          </div>
          <span className="user-chip">{name}</span>
          <button className="icon-button" aria-label="Cerrar sesión" onClick={() => {
            if (onLogout) {
              onLogout();
              return;
            }
            localStorage.removeItem("sipu-token");
            localStorage.removeItem("sipu-user");
            window.location.reload();
          }}><ExitIcon /></button>
          <button className="menu-button" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)}>Menú</button>
        </div>
      </div>
    </header>
  );
}

function Notification({ read, title, detail, time, onClick }: { id: number; read: boolean; title: string; detail: string; time: string; onClick: () => void }) {
  return <button className="notification" onClick={onClick} aria-label={`${title}. ${read ? "Leída" : "No leída"}`}><span className="notification-dot" style={{ opacity: read ? 0.25 : 1 }} /><span><strong>{title}</strong><small>{detail} · {time}</small></span></button>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
}

function ExitIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8l4 4-4 4M18 12H6M10 4H5a2 2 0 00-2 2v12a2 2 0 002 2h5" /></svg>;
}
