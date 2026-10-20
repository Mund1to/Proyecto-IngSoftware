import { json, request } from '../../shared/api/client';

export type AdminUser = {
  id: number | string;
  email: string;
  nombre_completo: string;
  activo: boolean;
  created_at: string;
  roles: string[];
  profile_types: string[];
  // Fecha de la última solicitud de cambio de contraseña sin atender (últimos 7 días).
  solicitud_contrasena?: string | null;
};

type UserResponse = { ok: boolean; user: AdminUser };

export const adminApi = {
  getUsers: (token: string, search = '') =>
    request<{ ok: boolean; users: AdminUser[] }>(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ''}`, {}, token),

  updateUserRoles: (userId: string | number, roles: string[], token: string) =>
    request<UserResponse>(`/admin/users/${userId}/roles`, json('PUT', { roles }), token),

  updateUserActive: (userId: string | number, activo: boolean, token: string) =>
    request<UserResponse>(`/admin/users/${userId}/active`, json('PATCH', { activo }), token),

  setUserPassword: (userId: string | number, password: string, token: string) =>
    request<{ ok: boolean; message: string; user: AdminUser }>(`/admin/users/${userId}/password`, json('PUT', { password }), token),
};
