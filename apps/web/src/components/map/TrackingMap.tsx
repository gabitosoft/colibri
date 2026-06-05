import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import type { LocationRecord } from '../../api/devices.api';
import { useMapMatching, type LatLng } from '../../hooks/useMapMatching';

interface Props {
  records: LocationRecord[];
  /** Record selected from the history table — map pans & highlights it */
  selectedRecord?: LocationRecord | null;
  /** Live record streamed via WebSocket — shown as a pulsing marker */
  liveRecord?: LocationRecord | null;
  /** Whether the WebSocket is currently connected */
  connected?: boolean;
}

function createLiveIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;
          background:rgba(239,68,68,0.25);animation:colibri-pulse 1.5s ease-out infinite;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#ef4444;
          border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4);"></div>
      </div>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
  });
}

function createSelectedIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:32px;height:32px;border-radius:50%;
          background:rgba(234,179,8,0.25);animation:colibri-pulse 1.5s ease-out infinite;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#eab308;
          border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.45);"></div>
      </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
  });
}

function FitBounds({ records }: { records: LocationRecord[] }) {
  const map = useMap();
  useEffect(() => {
    if (records.length === 0) return;
    const lats = records.map((r) => Number(r.latitude));
    const lngs = records.map((r) => Number(r.longitude));
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [32, 32] },
    );
  }, [records, map]);
  return null;
}

function PanToLive({ record }: { record: LocationRecord }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (record.recordedAt === prevRef.current) return;
    prevRef.current = record.recordedAt;
    map.panTo([Number(record.latitude), Number(record.longitude)], { animate: true });
  }, [record, map]);
  return null;
}

function PanToSelected({ record }: { record: LocationRecord }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (record.id === prevRef.current) return;
    prevRef.current = record.id;
    map.flyTo([Number(record.latitude), Number(record.longitude)], Math.max(map.getZoom(), 15), {
      animate: true, duration: 0.8,
    });
  }, [record, map]);
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const liveIcon     = createLiveIcon();
const selectedIcon = createSelectedIcon();

export default function TrackingMap({ records, selectedRecord, liveRecord, connected }: Props) {
  const { t } = useTranslation();
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    selectedMarkerRef.current?.openPopup();
  }, [selectedRecord]);

  const hasHistory = records.length > 0;
  const hasLive    = liveRecord != null;
  const hasSelected = selectedRecord != null;

  // API returns DESC; reverse to chronological ASC for the map
  const ascRecords = useMemo(
    () => (hasHistory ? [...records].reverse() : []),
    [records, hasHistory],
  );

  // GPS points in [lat, lng] order — memoised so useMapMatching only refetches
  // when the actual set of points changes, not on every parent re-render
  const gpsPoints = useMemo<LatLng[]>(
    () => ascRecords.map((r) => [Number(r.latitude), Number(r.longitude)]),
    [ascRecords],
  );

  const { path: routePath, status: matchStatus } = useMapMatching(gpsPoints);

  const first  = gpsPoints[0];
  const last   = gpsPoints[gpsPoints.length - 1];
  const latest = records[0]; // newest in DESC array
  const center = hasHistory ? last : (hasLive ? [Number(liveRecord!.latitude), Number(liveRecord!.longitude)] as LatLng : [0, 0] as LatLng);

  if (!hasHistory && !hasLive) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl text-sm text-gray-400">
        {t('map.noData')}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes colibri-pulse {
          0%   { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {/* Top-right badges */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {/* Road-snap status */}
        {hasHistory && matchStatus !== 'idle' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'white', borderRadius: 20, padding: '4px 10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontSize: 11, fontWeight: 500,
            color: matchStatus === 'fallback' ? '#f59e0b' : matchStatus === 'loading' ? '#6b7280' : '#3b82f6',
          }}>
            {matchStatus === 'loading' && (
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5" />
              </svg>
            )}
            {matchStatus === 'loading'  && t('map.routeMatching')}
            {matchStatus === 'ok'       && `🛣 ${t('map.routeMatched')}`}
            {matchStatus === 'fallback' && `⚠ ${t('map.routeFallback')}`}
          </div>
        )}

        {/* Live / Offline badge */}
        {connected != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'white', borderRadius: 20, padding: '4px 10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 500,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#9ca3af' }} />
            {connected ? t('map.liveConnected') : t('map.liveDisconnected')}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasHistory && !hasSelected && <FitBounds records={ascRecords} />}
        {hasLive    && !hasSelected && <PanToLive record={liveRecord!} />}
        {hasSelected                && <PanToSelected record={selectedRecord!} />}

        {/* Road-snapped route — falls back to straight lines while loading or on error */}
        {hasHistory && routePath.length > 1 && (
          <Polyline
            positions={routePath}
            color="#3b82f6"
            weight={4}
            opacity={matchStatus === 'loading' ? 0.4 : 0.85}
          />
        )}

        {/* Start marker */}
        {hasHistory && first && (
          <CircleMarker center={first} radius={7} color="#22c55e" fillColor="#22c55e" fillOpacity={1}>
            <Popup>{t('map.start')}<br />{formatDate(ascRecords[0].recordedAt)}</Popup>
          </CircleMarker>
        )}

        {/* Latest history marker */}
        {hasHistory && last && ascRecords.length > 1 && (
          <CircleMarker center={last} radius={9} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}>
            <Popup>
              <strong>{t('map.latestPosition')}</strong><br />
              {formatDate(latest.recordedAt)}<br />
              {latest.speed    != null && <>{t('map.speed',    { value: Number(latest.speed).toFixed(1) })}<br /></>}
              {latest.accuracy != null && <>{t('map.accuracy', { value: Number(latest.accuracy).toFixed(0) })}</>}
            </Popup>
          </CircleMarker>
        )}

        {/* Selected record marker */}
        {hasSelected && (
          <Marker
            position={[Number(selectedRecord!.latitude), Number(selectedRecord!.longitude)]}
            icon={selectedIcon}
            zIndexOffset={900}
            ref={(m) => { selectedMarkerRef.current = m; }}
          >
            <Popup>
              <strong style={{ color: '#ca8a04' }}>{t('map.selectedPosition')}</strong><br />
              {formatDate(selectedRecord!.recordedAt)}<br />
              {selectedRecord!.speed    != null && <>{t('map.speed',    { value: Number(selectedRecord!.speed).toFixed(1) })}<br /></>}
              {selectedRecord!.accuracy != null && <>{t('map.accuracy', { value: Number(selectedRecord!.accuracy).toFixed(0) })}</>}
            </Popup>
          </Marker>
        )}

        {/* Live position marker */}
        {hasLive && (
          <Marker
            position={[Number(liveRecord!.latitude), Number(liveRecord!.longitude)]}
            icon={liveIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <strong style={{ color: '#ef4444' }}>{t('map.livePosition')}</strong><br />
              {formatDate(liveRecord!.recordedAt)}<br />
              {liveRecord!.speed    != null && <>{t('map.speed',    { value: Number(liveRecord!.speed).toFixed(1) })}<br /></>}
              {liveRecord!.accuracy != null && <>{t('map.accuracy', { value: Number(liveRecord!.accuracy).toFixed(0) })}</>}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
