import axios from 'axios';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://portal.gabitosoft.cloud';
const PORTAL_COOKIE_NAME = import.meta.env.VITE_PORTAL_COOKIE_NAME ?? 'token';
const APP_SLUG = import.meta.env.VITE_APP_SLUG ?? 'colibri';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

function getTokenCookie(): string | undefined {
  const prefix = `${PORTAL_COOKIE_NAME}=`;
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(prefix))
    ?.slice(prefix.length);
}

api.interceptors.request.use((config) => {
  const token = getTokenCookie();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight silent refresh against the portal: when the shared access
// cookie has expired, the portal renews it from the httpOnly `rt` cookie.
let refreshPromise: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  try {
    await axios.post(`${PORTAL_URL}/authsvc/auth/refresh-cookie`, null, {
      withCredentials: true,
    });
    return true;
  } catch {
    return false;
  }
}

function redirectToPortalLogin() {
  const url = new URL(`${PORTAL_URL}/login`);
  url.searchParams.set('returnTo', `${window.location.origin}/sso/callback`);
  url.searchParams.set('appSlug', APP_SLUG);
  window.location.replace(url.toString());
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as
      | (typeof err.config & { _retry?: boolean })
      | undefined;
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshSession().finally(() => {
        refreshPromise = null;
      });
      if (await refreshPromise) return api(original);
      redirectToPortalLogin();
    }
    return Promise.reject(err);
  },
);
