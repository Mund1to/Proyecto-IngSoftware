// Íconos SVG de trazo que se repiten en las pantallas (diseño "vivo").
// Son decorativos: el texto o el aria-label del botón que los contiene da el nombre.
import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string; filled?: boolean };

function Icon({ d, size = 20, className = "", filled = false, children }: IconProps & { d?: string; children?: ReactNode }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>;
export const IconBell = (p: IconProps) => <Icon {...p} d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />;
export const IconExit = (p: IconProps) => <Icon {...p} d="M14 8l4 4-4 4M18 12H6M10 4H5a2 2 0 00-2 2v12a2 2 0 002 2h5" />;
export const IconMenu = (p: IconProps) => <Icon {...p} d="M4 7h16M4 12h16M4 17h16" />;
export const IconClose = (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
export const IconChevronDown = (p: IconProps) => <Icon {...p} d="M6 9l6 6 6-6" />;
export const IconArrowRight = (p: IconProps) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />;
export const IconCheck = (p: IconProps) => <Icon {...p} d="M5 12l5 5 9-10" />;
export const IconPlus = (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />;
export const IconBookmark = (p: IconProps) => <Icon {...p} d="M6 3h12v18l-6-4-6 4z" />;
export const IconPin = (p: IconProps) => <Icon {...p}><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
export const IconMonitor = (p: IconProps) => <Icon {...p} d="M4 5h16v10H4zM2 19h20" />;
export const IconClock = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const IconCalendar = (p: IconProps) => <Icon {...p} d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />;
export const IconMail = (p: IconProps) => <Icon {...p} d="M3 6h18v12H3zM3 7l9 6 9-6" />;
export const IconLock = (p: IconProps) => <Icon {...p} d="M6 11h12v9H6zM8 11V8a4 4 0 018 0v3" />;
export const IconEye = (p: IconProps) => <Icon {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const IconEyeOff = (p: IconProps) => <Icon {...p} d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s4 7 10 7a9.8 9.8 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2" />;
export const IconUser =(p: IconProps) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon>;
export const IconBuilding = (p: IconProps) => <Icon {...p} d="M4 21V5l8-2v18M12 7l8 2v12M8 9v.01M8 13v.01M8 17v.01M16 13v.01M16 17v.01M2 21h20" />;
export const IconFile = (p: IconProps) => <Icon {...p} d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />;
export const IconImage = (p: IconProps) => <Icon {...p}><path d="M4 5h16v14H4z" /><circle cx="9" cy="10" r="2" /><path d="M20 16l-5-5-8 8" /></Icon>;
export const IconGrid =(p: IconProps) => <Icon {...p} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />;
// Tipos de oferta.
export const IconGraduation = (p: IconProps) => <Icon {...p} d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5" />;
export const IconBriefcase = (p: IconProps) => <Icon {...p} d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />;
export const IconBook = (p: IconProps) => <Icon {...p} d="M4 5h7a2 2 0 012 2v12a2 2 0 00-2-2H4zM20 5h-7a2 2 0 00-2 2v12a2 2 0 012-2h7z" />;

// Check de organización verificada: círculo verde relleno con nombre accesible propio.
// Con label vacío es decorativo (cuando el texto "Organización verificada" ya está al lado).
export function IconVerified({ size = 16, label = "Organización verificada" }: { size?: number; label?: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg className="icon icon-verified" viewBox="0 0 24 24" width={size} height={size} {...a11y}>
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}
