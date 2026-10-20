import type { ApiUser, FileKind, StoredFile } from '../../shared/api/account';
import { binary, json, openProtectedFile, request, requestBlob } from '../../shared/api/client';

export type EducationItem = { id?: number | string; titulo: string; institucion: string; periodo: string };
export type ExperienceItem = { id?: number | string; cargo: string; empresa: string; periodo: string; descripcion?: string | null };
export type SkillItem = { id?: number | string; categoria: string; nombre: string };
export type ProfileDetails = { education: EducationItem[]; experience: ExperienceItem[]; skills: SkillItem[] };

type UserResponse = { ok: boolean; user: ApiUser };
type DetailsResponse = { ok: boolean; details: ProfileDetails };

export const profileApi = {
  getCurrentUser: (token: string) => request<UserResponse>(`/profile/me`, {}, token),

  updateCurrentUser: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/me`, json('PUT', payload), token),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    request<{ ok: boolean; message: string; token: string }>(`/profile/password`, json('PUT', { currentPassword, newPassword }), token),

  updateStudentProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/student`, json('PUT', payload), token),

  updateExternalProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/external`, json('PUT', payload), token),

  updateOrganizationProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/organization`, json('PUT', payload), token),

  // Hoja de vida estructurada: cada llamada reemplaza la lista completa.
  getProfileDetails: (token: string) => request<DetailsResponse>(`/profile/details`, {}, token),

  saveEducation: (items: EducationItem[], token: string) =>
    request<DetailsResponse>(`/profile/education`, json('PUT', { items }), token),

  saveExperience: (items: ExperienceItem[], token: string) =>
    request<DetailsResponse>(`/profile/experience`, json('PUT', { items }), token),

  saveSkills: (items: SkillItem[], token: string) =>
    request<DetailsResponse>(`/profile/skills`, json('PUT', { items }), token),

  // Archivos del perfil (hoja de vida y foto).
  uploadFile: (kind: FileKind, file: File, token: string) =>
    request<{ ok: boolean; file: StoredFile }>(`/profile/files/${kind}`, binary('PUT', file), token),

  deleteFile: (kind: FileKind, token: string) =>
    request<{ ok: boolean }>(`/profile/files/${kind}`, json('DELETE'), token),

  getFile: (kind: FileKind, token: string) => requestBlob(`/profile/files/${kind}`, token),

  openMyFile: (kind: FileKind, token: string) => openProtectedFile(`/profile/files/${kind}`, token),
};
