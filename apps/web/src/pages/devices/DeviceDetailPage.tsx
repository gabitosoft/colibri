import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDevicesStore } from '../../stores/devices.store';
import { devicesApi } from '../../api/devices.api';
import type { Device } from '../../api/devices.api';
import TrackingMap from '../../components/map/TrackingMap';

const PRESETS = [
  { label: 'Last 24 h', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
  { label: 'Last 30 days', hours: 24 * 30 },
];

function hoursAgoISO(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locationHistories, fetchHistory } = useDevicesStore();

  const [device, setDevice] = useState<Device | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [preset, setPreset] = useState(0);

  const history = id ? locationHistories[id] : undefined;
  const records = history?.records ?? [];

  useEffect(() => {
    if (!id) return;
    devicesApi.get(id).then(({ data }) => setDevice(data)).finally(() => setLoadingDevice(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingHistory(true);
    fetchHistory(id, { from: hoursAgoISO(PRESETS[preset].hours) })
      .finally(() => setLoadingHistory(false));
  }, [id, preset, fetchHistory]);

  if (loadingDevice) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  }

  if (!device) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-400">Device not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/devices')} className="text-gray-400 hover:text-gray-700 text-sm">
          ← Devices
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">{device.name}</span>
        {!device.isActive && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
        )}
      </nav>

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-6 gap-6">
        {/* Info row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Device key</p>
            <p className="font-mono text-xs text-gray-700 break-all">{device.deviceKey}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Total points loaded</p>
            <p className="text-2xl font-bold text-gray-900">{records.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Latest record</p>
            <p className="text-sm text-gray-700">
              {records.length > 0 ? formatDate(records[records.length - 1].recordedAt) : '—'}
            </p>
          </div>
        </div>

        {/* Time range picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Show:</span>
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
          {loadingHistory && <span className="text-xs text-gray-400 ml-2">Loading…</span>}
        </div>

        {/* Map */}
        <div className="h-96 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <TrackingMap records={records} />
        </div>

        {/* Location history table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Location history</h2>
          </div>
          {records.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No records for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-left">
                    <th className="px-5 py-3 font-medium">Recorded at</th>
                    <th className="px-5 py-3 font-medium">Latitude</th>
                    <th className="px-5 py-3 font-medium">Longitude</th>
                    <th className="px-5 py-3 font-medium">Speed (m/s)</th>
                    <th className="px-5 py-3 font-medium">Heading (°)</th>
                    <th className="px-5 py-3 font-medium">Accuracy (m)</th>
                    <th className="px-5 py-3 font-medium">Altitude (m)</th>
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
