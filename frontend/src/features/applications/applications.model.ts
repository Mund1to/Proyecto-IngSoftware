// Modelo de postulaciones en el frontend: estados y conversión de las filas de la API.

export type ApplicationStatus = "Enviada" | "En revisión" | "Entrevista" | "Aceptada" | "Rechazada" | "Retirada";

// Estado del backend (postulaciones.estado) al texto que ve el candidato.
// PRESELECCIONADA es la etapa de entrevista en el flujo de la empresa.
export function mapApplicationStatus(status?: string): ApplicationStatus {
  switch (status) {
    case "EN_REVISION":
      return "En revisión";
    case "PRESELECCIONADA":
      return "Entrevista";
    case "ACEPTADA":
      return "Aceptada";
    case "RECHAZADA":
      return "Rechazada";
    case "RETIRADA":
      return "Retirada";
    default:
      return "Enviada";
  }
}

export type Application = {
  id: number;
  offerId: number;
  offerTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus;
};

// La misma postulación con los nombres que usan las pantallas del profesional externo.
export type JobApplication = {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus | "Entrevista";
};

// Todas las postulaciones del candidato, sin importar el tipo de oferta: un
// estudiante puede postularse a un empleo y un externo a una práctica.
export const mapApiApplications = (items: any[]): Application[] => items.map((item) => ({
  id: Number(item.id),
  offerId: Number(item.oferta_id),
  offerTitle: item.oferta_titulo ?? "Oferta",
  company: item.empresa ?? "Empresa",
  appliedDate: String(item.created_at ?? new Date().toISOString()).slice(0, 10),
  status: mapApplicationStatus(item.estado),
}));

export const toJobApplications = (applications: Application[]): JobApplication[] => applications.map((item) => ({
  id: item.id,
  jobId: item.offerId,
  jobTitle: item.offerTitle,
  company: item.company,
  appliedDate: item.appliedDate,
  status: item.status,
}));
