import { useState } from "react";
import { Role, Screen } from "../App";
import UniversityLogo from "./UniversityLogo";

type Props = { role: Role; navigate: (screen: Screen) => void; activeScreen: Screen };

const links: Record<Role, { label: string; screen: Screen }[]> = {
  student: [
    { label: "Ofertas", screen: "student-dashboard" },
    { label: "Mis postulaciones", screen: "student-applications" },
    { label: "Mi perfil", screen: "student-profile" },
  ],
  company: [
    { label: "Ofertas", screen: "company-dashboard" },
    { label: "Postulantes", screen: "company-applicants" },
  ],
  external: [
    { label: "Ofertas", screen: "external-dashboard" },
    { label: "Mis postulaciones", screen: "external-applications" },
    { label: "Mi perfil", screen: "external-profile" },
  ],
};

const home: Record<Role, Screen> = { student: "student-dashboard", company: "company-dashboard", external: "external-dashboard" };

export default function NavBar({ role, navigate, activeScreen }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const name = role === "student" ? "Laura C." : role === "company" ? "Bancolombia" : "Carlos P.";

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
            <button className="icon-button" aria-label="Notificaciones, 3 sin leer" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}>
              <BellIcon /><span className="badge">3</span>
            </button>
            {notifications && (
              <div className="notification-panel" role="dialog" aria-label="Notificaciones">
                <div className="notification-heading"><strong>Notificaciones</strong><button className="text-button">Marcar como leídas</button></div>
                <Notification title="Tu postulación está en revisión" detail="Bancolombia revisó tu perfil." time="hace 12 min" />
                <Notification title="Nueva oferta para ti" detail="Practicante de desarrollo web." time="hace 2 h" />
                <Notification title="Entrevista programada" detail="Consulta los detalles del proceso." time="ayer" />
              </div>
            )}
          </div>
          <span className="user-chip">{name}</span>
          <button className="icon-button" aria-label="Cerrar sesión" onClick={() => navigate("auth")}><ExitIcon /></button>
          <button className="menu-button" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)}>Menú</button>
        </div>
      </div>
    </header>
  );
}

function Notification({ title, detail, time }: { title: string; detail: string; time: string }) {
  return <button className="notification"><span className="notification-dot" /><span><strong>{title}</strong><small>{detail} · {time}</small></span></button>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
}

function ExitIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8l4 4-4 4M18 12H6M10 4H5a2 2 0 00-2 2v12a2 2 0 002 2h5" /></svg>;
}
