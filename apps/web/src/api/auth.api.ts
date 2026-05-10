import { api } from '../lib/axios';

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
};
