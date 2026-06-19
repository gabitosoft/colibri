import { create } from 'zustand';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthTenant {
  id: string;
  slug: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  setAuth: (token: string, user: AuthUser, tenant: AuthTenant) => void;
}

// Token lives in the `token` cookie (set by the backend SSO callback).
// This store is hydrated from the cookie JWT by ProtectedRoute on each render
// so the rest of the app can read user/tenant without extra API calls.
export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  tenant: null,
  setAuth: (token, user, tenant) => set({ token, user, tenant }),
}));
