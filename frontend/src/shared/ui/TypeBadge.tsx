import { OFFER_TYPE_LABELS, OfferType } from "../lib/offers";
import { IconBook, IconBriefcase, IconGraduation } from "./icons";

type Kind = "practica" | "empleo" | "formacion";

// Acepta el código de la API (PRACTICA, EMPLEO, EMPLEO_PUBLICO, FORMACION) o la
// etiqueta que ya usan algunas pantallas ("Práctica", "Tiempo completo", ...).
function resolveKind(type: string | undefined): Kind {
  const value = (type ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (value.startsWith("practica")) return "practica";
  if (value.startsWith("formacion")) return "formacion";
  return "empleo";
}

const ICONS = { practica: IconGraduation, empleo: IconBriefcase, formacion: IconBook };

export default function TypeBadge({ type, label, className = "" }: { type?: string; label?: string; className?: string }) {
  const kind = resolveKind(type);
  const Icon = ICONS[kind];
  const text = label ?? OFFER_TYPE_LABELS[type as OfferType] ?? type ?? "Oferta";
  return (
    <span className={`type-badge type-badge-${kind} ${className}`}>
      <Icon size={15} />
      {text}
    </span>
  );
}
