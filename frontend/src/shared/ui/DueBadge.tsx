import { daysUntil, isValidDate } from "../lib/offers";
import { IconCheck, IconClock, IconClose } from "./icons";

// Estado de cierre de una oferta. El texto siempre dice el estado; el color solo lo refuerza.
export function dueState(closeDate: unknown): { tone: "soon" | "open" | "closed"; text: string } {
  if (!isValidDate(closeDate)) return { tone: "open", text: "Abierta" };
  const days = daysUntil(closeDate);
  if (days < 0) return { tone: "closed", text: "Cerrada" };
  if (days <= 14) {
    return { tone: "soon", text: days === 0 ? "Cierra hoy" : days === 1 ? "Cierra en 1 día" : `Cierra en ${days} días` };
  }
  return { tone: "open", text: "Abierta" };
}

const ICONS = { soon: IconClock, open: IconCheck, closed: IconClose };

export default function DueBadge({ closeDate, className = "" }: { closeDate: unknown; className?: string }) {
  const { tone, text } = dueState(closeDate);
  const Icon = ICONS[tone];
  return (
    <span className={`due-badge due-badge-${tone} ${className}`}>
      <Icon size={14} />
      {text}
    </span>
  );
}
