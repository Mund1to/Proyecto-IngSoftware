// Textos, estilos y validaciones de la verificación documental (Fase 7),
// compartidos por la sección de la empresa y la bandeja del revisor.
import type { VerificationDocumentType, VerificationRequirements, VerificationStatus } from "./verifications.api";

type Tone = "neutral" | "warning" | "success" | "danger";

export const VERIFICATION_STATUS_META: Record<VerificationStatus, { label: string; tone: Tone }> = {
  SIN_SOLICITUD: { label: "Sin solicitud", tone: "neutral" },
  PENDIENTE: { label: "En revisión", tone: "warning" },
  APROBADA: { label: "Verificada", tone: "success" },
  RECHAZADA: { label: "Rechazada", tone: "danger" },
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-[#f2f6fc] text-[var(--muted)] border-[#d3e0f5]",
  warning: "bg-[#fff4df] text-[var(--warning)] border-[#f5d9a8]",
  success: "bg-[#eaf7f0] text-[var(--success)] border-[#b7e4c7]",
  danger: "bg-[#fef3f2] text-[var(--danger)] border-[#fecdca]",
};

export const statusMeta = (status: string | null | undefined) =>
  VERIFICATION_STATUS_META[(status ?? "SIN_SOLICITUD") as VerificationStatus] ?? VERIFICATION_STATUS_META.SIN_SOLICITUD;

// Respaldo si el servidor no envía el catálogo; el servidor es la fuente de verdad.
export const DOCUMENT_TYPE_LABELS: Record<VerificationDocumentType, string> = {
  RUT: "RUT (Registro Único Tributario)",
  CAMARA_COMERCIO: "Certificado de Cámara de Comercio",
  CEDULA_REPRESENTANTE: "Documento del representante legal",
  OTRO: "Otro documento de soporte",
};

export const documentTypeLabel = (tipo: string, requirements?: VerificationRequirements) =>
  requirements?.tipos.find((item) => item.tipo === tipo)?.etiqueta ?? DOCUMENT_TYPE_LABELS[tipo as VerificationDocumentType] ?? tipo;

// Texto de cada requisito pendiente ('NIT' o un tipo de documento).
export const blockerLabel = (code: string, requirements?: VerificationRequirements) =>
  code === "NIT" ? "NIT o identificación fiscal en los datos de la empresa" : documentTypeLabel(code, requirements);

const FORMAT_NAMES: Record<string, string> = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WEBP" };

export const formatList = (mimes: string[]) => mimes.map((mime) => FORMAT_NAMES[mime] ?? mime).join(", ");

// Validación previa a la subida; el servidor vuelve a validar el contenido real.
export function validateVerificationFile(file: File, requirements: VerificationRequirements): string | null {
  if (!requirements.formatos.includes(file.type)) return `Selecciona un archivo ${formatList(requirements.formatos)}.`;
  if (file.size > requirements.maxBytes) return `El documento no puede superar ${requirements.maxBytes / 1024 / 1024} MB.`;
  return null;
}

export const MIN_REJECTION_REASON = 10;
