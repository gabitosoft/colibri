import { useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';

const PORTAL_LOGIN = 'https://portal.gabitosoft.cloud/login';
const APP_ORIGIN = window.location.origin;
const SSO_CALLBACK = `${APP_ORIGIN}/sso/callback`;

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const exp = payload['exp'] as number | undefined;
  return !exp || Date.now() / 1000 < exp;
}

function redirectToPortalLogin() {
  const url = new URL(PORTAL_LOGIN);
  url.searchParams.set('returnTo', SSO_CALLBACK);
  url.searchParams.set('appSlug', 'colibri');
  window.location.replace(url.toString());
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const token = getCookie('token');
  const valid = !!token && isTokenValid(token);

  useEffect(() => {
    if (!valid) {
      redirectToPortalLogin();
      return;
    }

    // Hydrate the store from the JWT so pages can read user/tenant without
    // an extra API call.
    const payload = decodeJwtPayload(token!) as {
      sub: string;
      email: string;
      name?: string;
      tenantId: string;
      tenantSlug?: string;
      role: string;
    };

    setAuth(token!, {
      id: payload.sub,
      name: payload.name ?? payload.email,
      email: payload.email,
      role: payload.role,
    }, {
      id: payload.tenantId,
      slug: payload.tenantSlug ?? '',
      name: payload.tenantSlug ?? '',
    });
  }, [valid, token, setAuth]);

  if (!valid) return null;

  return <>{children}</>;
}
