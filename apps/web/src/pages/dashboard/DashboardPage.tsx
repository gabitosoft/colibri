import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-lg font-semibold text-gray-900">Colibri</span>
          {tenant && (
            <span className="ml-2 text-sm text-gray-500">/ {tenant.name}</span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Hello, {user?.name} 👋
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          You are signed in as <strong>{user?.role}</strong> in{' '}
          <strong>{tenant?.name}</strong>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['Users', 'Settings', 'Analytics'].map((label) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow cursor-pointer"
            >
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-400 mt-1">Coming soon</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
