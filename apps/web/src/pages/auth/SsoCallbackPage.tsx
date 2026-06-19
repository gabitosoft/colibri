import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// The portal redirects here with ?ticket=...; we hand it straight to the
// backend which exchanges it, plants the cookie, and bounces to /devices.
export default function SsoCallbackPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    const ticket = params.get('ticket');
    if (!ticket) return;
    window.location.replace(`/api/auth/callback?ticket=${encodeURIComponent(ticket)}`);
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
