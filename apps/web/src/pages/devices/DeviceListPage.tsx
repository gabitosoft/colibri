import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useDevicesStore } from '../../stores/devices.store';
import { useAuthStore } from '../../stores/auth.store';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import Toast from '../../components/ui/Toast';

export default function DeviceListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, tenant, logout } = useAuthStore();
  const { devices, loading, fetchDevices, addDevice, removeDevice } = useDevicesStore();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [newDevice, setNewDevice] = useState<{ name: string; deviceKey: string } | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const device = await addDevice(form.name, form.description || undefined);
      setNewDevice({ name: device.name, deviceKey: device.deviceKey });
      setForm({ name: '', description: '' });
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(t('devices.removeConfirm', { name }))) return;
    await removeDevice(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">Colibri</span>
          {tenant && <span className="text-sm text-gray-400">/ {tenant.name}</span>}
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('devices.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('devices.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {t('devices.add')}
          </button>
        </div>

        {/* New device key banner */}
        {newDevice && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800 mb-1">
              {t('devices.keyBanner.created', { name: newDevice.name })}
            </p>
            <p className="text-xs text-green-700 mb-2">{t('devices.keyBanner.hint')}</p>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white border border-green-200 px-3 py-2 text-xs font-mono text-gray-800 break-all">
                    {newDevice.deviceKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newDevice.deviceKey);
                      setToast(t('devices.keyBanner.copied'));
                    }}
                    className="shrink-0 rounded-lg border border-green-300 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    {t('devices.keyBanner.copy')}
                  </button>
                </div>
              </div>
              <div className="shrink-0 rounded-lg bg-white border border-green-200 p-2">
                <QRCodeSVG value={newDevice.deviceKey} size={96} />
              </div>
            </div>
            <button onClick={() => setNewDevice(null)} className="mt-2 text-xs text-green-600 hover:underline">
              {t('devices.keyBanner.dismiss')}
            </button>
          </div>
        )}

        {/* Add device modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('devices.form.title')}</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.form.name')}</label>
                  <input
                    type="text"
                    placeholder={t('devices.form.namePlaceholder')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('devices.form.description')}{' '}
                    <span className="text-gray-400">{t('devices.form.descriptionOptional')}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('devices.form.descriptionPlaceholder')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('devices.form.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t('devices.form.creating') : t('devices.form.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Device list */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('devices.loading')}</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">{t('devices.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div className="cursor-pointer flex-1" onClick={() => navigate(`/devices/${device.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{device.name}</span>
                    {!device.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {t('devices.inactive')}
                      </span>
                    )}
                  </div>
                  {device.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{device.description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1 font-mono">{device.deviceKey.slice(0, 12)}…</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={() => navigate(`/devices/${device.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {t('devices.viewHistory')}
                  </button>
                  <button
                    onClick={() => handleRemove(device.id, device.name)}
                    className="text-sm text-red-400 hover:text-red-600"
                  >
                    {t('devices.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
