import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

function getTokenCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith('token='))
    ?.slice('token='.length);
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
      window.location.replace(
        `https://portal.gabitosoft.cloud/login?returnTo=${encodeURIComponent(returnTo)}&appSlug=colibri`,
      );
    }
    return Promise.reject(err);
  },
);
