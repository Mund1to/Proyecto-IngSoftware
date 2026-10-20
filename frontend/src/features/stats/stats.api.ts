import { request } from '../../shared/api/client';

export const statsApi = {
  getEmploymentStats: (token: string) => request<{ ok: boolean; stats: any }>(`/stats/employment`, {}, token),
};
