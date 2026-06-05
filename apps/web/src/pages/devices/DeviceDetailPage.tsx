import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useDevicesStore } from '../../stores/devices.store';
import { devicesApi } from '../../api/devices.api';
import type { Device, LocationRecord, SortableColumn, SortOrder } from '../../api/devices.api';
import TrackingMap from '../../components/map/TrackingMap';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import { useLocationSocket } from '../../hooks/useLocationSocket';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

function hoursAgoISO(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

/**
 * Formats a date as "Wed 27, May 2026, 10:53:08 PM" (en)
 *                  "mié. 27, mayo 2026, 10:53:08 p. m." (es)
 */
function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return `${get('weekday')} ${get('day')}, ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')}`;
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { locationHistories, fetchHistory } = useDevicesStore();

  const [device, setDevice] = useState<Device | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [preset, setPreset] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [sortBy, setSortBy] = useState<SortableColumn>('recordedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [selectedRecord, setSelectedRecord] = useState<LocationRecord | null>(null);
  const { liveRecord, connected } = useLocationSocket(id);
  const mapRef = useRef<HTMLDivElement>(null);

  const PRESETS = [
    { label: t('devices.presets.24h'), hours: 24 },
    { label: t('devices.presets.7d'), hours: 24 * 7 },
    { label: t('devices.presets.30d'), hours: 24 * 30 },
  ];

  const history = id ? locationHistories[id] : undefined;
  const records = history?.records ?? [];
  const total = history?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Load device info
  useEffect(() => {
    if (!id) return;
    setLoadingDevice(true);
    devicesApi
      .get(id)
      .then(({ data }) => setDevice(data))
      .catch(() => setDevice(null))
      .finally(() => setLoadingDevice(false));
  }, [id]);

  // Reset page + selection when preset, device, page size or sort changes
  useEffect(() => {
    setPage(0);
    setSelectedRecord(null);
  }, [id, preset, pageSize, sortBy, sortOrder]);

  // Fetch history whenever device, preset or page changes
  useEffect(() => {
    if (!id) return;
    setLoadingHistory(true);
    setSelectedRecord(null);
    fetchHistory(id, {
      from: hoursAgoISO(PRESETS[preset].hours),
      to: new Date().toISOString(),
      limit: pageSize,
      offset: page * pageSize,
      sortBy,
      sortOrder,
    }).finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, preset, page, pageSize, sortBy, sortOrder, fetchHistory]);

  if (loadingDevice) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">{t('devices.detail.loading')}</div>;
  }

  if (!device) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-400">{t('devices.detail.notFound')}</div>;
  }

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

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
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">{t('devices.detail.latestRecord')}</p>
            <p className="text-sm text-gray-700">
              {records.length > 0 ? formatDate(records[0].recordedAt, locale) : t('devices.detail.noDate')}
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
        <div ref={mapRef} className="h-96 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <TrackingMap records={records} selectedRecord={selectedRecord} liveRecord={liveRecord} connected={connected} />
        </div>

        {/* Location history table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{t('devices.detail.historyTitle')}</h2>
            {total > 0 && (
              <span className="text-xs text-gray-400">
                {t('devices.detail.pagination.total', { count: total })}
              </span>
            )}
          </div>

          {records.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t('devices.detail.noRecords')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      {(
                        [
                          ['recordedAt', 'devices.detail.table.recordedAt'],
                          ['latitude',   'devices.detail.table.latitude'],
                          ['longitude',  'devices.detail.table.longitude'],
                          ['speed',      'devices.detail.table.speed'],
                          ['heading',    'devices.detail.table.heading'],
                          ['accuracy',   'devices.detail.table.accuracy'],
                          ['altitude',   'devices.detail.table.altitude'],
                        ] as [SortableColumn, string][]
                      ).map(([col, labelKey]) => {
                        const isActive = sortBy === col;
                        return (
                          <th
                            key={col}
                            onClick={() => {
                              if (isActive) {
                                setSortOrder((o) => (o === 'DESC' ? 'ASC' : 'DESC'));
                              } else {
                                setSortBy(col);
                                setSortOrder('DESC');
                              }
                            }}
                            className="px-5 py-3 font-medium text-xs cursor-pointer select-none whitespace-nowrap group"
                          >
                            <span className={`inline-flex items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                              {t(labelKey)}
                              <span className="text-[10px] leading-none">
                                {isActive
                                  ? sortOrder === 'DESC' ? '▼' : '▲'
                                  : <span className="opacity-0 group-hover:opacity-40">▼</span>}
                              </span>
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => {
                          setSelectedRecord(r);
                          mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${
                          selectedRecord?.id === r.id
                            ? 'bg-yellow-50 border-l-2 border-l-yellow-400'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.recordedAt, locale)}</td>
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

              {/* Pagination controls */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
                {/* Prev button */}
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!canPrev || loadingHistory}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← {t('devices.detail.pagination.prev')}
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => {
                    const showPage =
                      i === 0 ||
                      i === totalPages - 1 ||
                      Math.abs(i - page) <= 1;
                    const showEllipsisBefore = i === 1 && page > 3;
                    const showEllipsisAfter = i === totalPages - 2 && page < totalPages - 4;

                    if (!showPage) return null;

                    return (
                      <span key={i}>
                        {showEllipsisBefore && (
                          <span className="px-1 text-xs text-gray-400">…</span>
                        )}
                        <button
                          onClick={() => setPage(i)}
                          disabled={loadingHistory}
                          className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                            i === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {i + 1}
                        </button>
                        {showEllipsisAfter && (
                          <span className="px-1 text-xs text-gray-400">…</span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Right side: page-size selector + next button */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 whitespace-nowrap">
                    {t('devices.detail.pagination.rowsPerPage')}
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                    disabled={loadingHistory}
                    className="rounded-lg border border-gray-200 text-xs text-gray-600 px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!canNext || loadingHistory}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('devices.detail.pagination.next')} →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
