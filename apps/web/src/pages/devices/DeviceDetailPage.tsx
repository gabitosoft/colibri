import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useDevicesStore } from '../../stores/devices.store';
import { devicesApi } from '../../api/devices.api';
import type { Device } from '../../api/devices.api';
import TrackingMap from '../../components/map/TrackingMap';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import { useLocationSocket } from '../../hooks/useLocationSocket';

function hoursAgoISO(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locationHistories, fetchHistory } = useDevicesStore();

  const [device, setDevice] = useState<Device | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [preset, setPreset] = useState(0);
  const { liveRecord, connected } = useLocationSocket(id);

  const PRESETS = [
    { label: t('devices.presets.24h'), hours: 24 },
    { label: t('devices.presets.7d'), hours: 24 * 7 },
    { label: t('devices.presets.30d'), hours: 24 * 30 },
  ];

  const history = id ? locationHistories[id] : undefined;
  const records = history?.records ?? [];

  useEffect(() => {
    if (!id) return;
    devicesApi.get(id).then(({ data }) => setDevice(data)).finally(() => setLoadingDevice(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingHistory(true);
    fetchHistory(id, { from: hoursAgoISO(PRESETS[preset].hours), to: new Date().toISOString() })
      .finally(() => setLoadingHistory(false));
  }, [id, preset, fetchHistory]);

  if (loadingDevice) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">{t('devices.detail.loading')}</div>;
  }

  if (!device) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-400">{t('devices.detail.notFound')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/devices')} className="text-gray-400 hover:text-gray-700 text-sm">
            {t('devices.detail.back')}
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">{device.name}</span>
          {!device.isActive && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {t('devices.inactive')}
            </span>
          )}
        </div>
        <LanguageSwitcher />
      </nav>

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-6 gap-6">
        {/* Info row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-2">{t('devices.detail.deviceKey')}</p>
            <div className="flex items-start gap-3">
              <p className="font-mono text-xs text-gray-700 break-all flex-1">{device.deviceKey}</p>
              <div className="shrink-0 rounded border border-gray-100 p-1">
                <QRCodeSVG value={device.deviceKey} size={72} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">{t('devices.detail.totalPoints')}</p>
            <p className="text-2xl font-bold text-gray-900">{records.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">{t('devices.detail.latestRecord')}</p>
            <p className="text-sm text-gray-700">
              {records.length > 0 ? formatDate(records[records.length - 1].recordedAt) : t('devices.detail.noDate')}
            </p>
          </div>
        </div>

        {/* Time range picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">{t('devices.detail.show')}</span>
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          {loadingHistory && <span className="text-xs text-gray-400 ml-2">{t('devices.detail.loadingHistory')}</span>}
        </div>

        {/* Map */}
        <div className="h-96 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <TrackingMap records={records} liveRecord={liveRecord} connected={connected} />
        </div>

        {/* Location history table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{t('devices.detail.historyTitle')}</h2>
          </div>
          {records.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t('devices.detail.noRecords')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-left">
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.recordedAt')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.latitude')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.longitude')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.speed')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.heading')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.accuracy')}</th>
                    <th className="px-5 py-3 font-medium">{t('devices.detail.table.altitude')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...records].reverse().map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.recordedAt)}</td>
                      <td className="px-5 py-3 font-mono text-gray-700">{Number(r.latitude).toFixed(7)}</td>
                      <td className="px-5 py-3 font-mono text-gray-700">{Number(r.longitude).toFixed(7)}</td>
                      <td className="px-5 py-3 text-gray-600">{r.speed != null ? Number(r.speed).toFixed(2) : '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{r.heading != null ? Number(r.heading).toFixed(1) : '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{r.accuracy != null ? Number(r.accuracy).toFixed(0) : '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{r.altitude != null ? Number(r.altitude).toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
