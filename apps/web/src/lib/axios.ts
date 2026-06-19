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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const returnTo = `${window.location.origin}/sso/callback`;
      const url = new URL(`${PORTAL_URL}/login`);
      url.searchParams.set('returnTo', returnTo);
      url.searchParams.set('appSlug', APP_SLUG);
      window.location.replace(url.toString());
    }
    return Promise.reject(err);
  },
);
