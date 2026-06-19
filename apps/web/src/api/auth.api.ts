import { api } from '../lib/axios';

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload),
  ssoExchange: (ticket: string) => api.post('/auth/sso/exchange', { ticket }),
  me: () => api.get('/auth/me'),
};
