import type { ApiUser } from '../../shared/api/account';
import { json, request } from '../../shared/api/client';

type SessionResponse = { ok: boolean; token: string; user: ApiUser };

export const authApi = {
  // También sirve para despertar el servidor mientras el usuario escribe.
  health: () => request<{ status: string }>(`/health`),

  register: (payload: Record<string, unknown>) =>
    request<SessionResponse>(`/auth/register`, json('POST', payload)),

  login: (payload: Record<string, unknown>) =>
    request<SessionResponse>(`/auth/login`, json('POST', payload)),

  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>(`/auth/forgot-password`, json('POST', { email })),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean; message: string }>(`/auth/reset-password`, json('POST', { token, password })),
};
