// Forma de la cuenta que devuelven /auth y /profile/me. La usan la sesión de la
// app y varias funcionalidades, por eso vive en shared y no en una sola de ellas.

export type ApiProfile = {
  id?: number;
  tipo?: string;
  visible?: boolean;
  universidad?: string | null;
  programaAcademico?: string | null;
  semestre?: number | string | null;
  codigoEstudiante?: string | null;
  fechaGraduacionEstimada?: string | null;
  razonSocial?: string | null;
  identificacionFiscal?: string | null;
  descripcion?: string | null;
  sitioWeb?: string | null;
  ubicacion?: string | null;
  resumen?: string | null;
  disponibilidad?: string | null;
  verificada?: boolean;
  cvUrl?: string | null;
};

export type ApiUser = {
  id: number;
  email: string;
  nombreCompleto: string;
  telefono?: string | null;
  activo?: boolean;
  createdAt?: string;
  roles?: string[];
  profileTypes?: string[];
  perfiles?: ApiProfile[];
  archivos?: StoredFile[];
};

export type FileKind = 'cv' | 'foto';

export type StoredFile = { tipo: 'CV' | 'FOTO'; nombre: string; mime: string; tamano: number; createdAt?: string; created_at?: string };
