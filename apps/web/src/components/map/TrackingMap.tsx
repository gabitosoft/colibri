import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import type { LocationRecord } from '../../api/devices.api';

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
        <div style="
          position:absolute;width:28px;height:28px;border-radius:50%;
          background:rgba(239,68,68,0.25);
          animation:colibri-pulse 1.5s ease-out infinite;
        "></div>
        <div style="
          width:14px;height:14px;border-radius:50%;
          background:#ef4444;border:2px solid white;
          box-shadow:0 1px 6px rgba(0,0,0,0.4);
        "></div>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function createSelectedIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;width:32px;height:32px;border-radius:50%;
          background:rgba(234,179,8,0.25);
          animation:colibri-pulse 1.5s ease-out infinite;
        "></div>
        <div style="
          width:16px;height:16px;border-radius:50%;
          background:#eab308;border:2.5px solid white;
          box-shadow:0 1px 6px rgba(0,0,0,0.45);
        "></div>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
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
    const key = record.recordedAt;
    if (key === prevRef.current) return;
    prevRef.current = key;
    map.panTo([Number(record.latitude), Number(record.longitude)], { animate: true });
  }, [record, map]);
  return null;
}

function PanToSelected({ record }: { record: LocationRecord }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    const key = record.id;
    if (key === prevRef.current) return;
    prevRef.current = key;
    map.flyTo([Number(record.latitude), Number(record.longitude)], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    });
  }, [record, map]);
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const liveIcon = createLiveIcon();
const selectedIcon = createSelectedIcon();

export default function TrackingMap({ records, selectedRecord, liveRecord, connected }: Props) {
  const { t } = useTranslation();
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  // Auto-open the popup whenever selectedRecord changes
  useEffect(() => {
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.openPopup();
    }
  }, [selectedRecord]);

  const hasHistory = records.length > 0;
  const hasLive = liveRecord != null;
  const hasSelected = selectedRecord != null;

  if (!hasHistory && !hasLive) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl text-sm text-gray-400">
        {t('map.noData')}
      </div>
    );
  }

  // API now returns DESC (newest first); reverse to get chronological order for the map
  const ascRecords = hasHistory ? [...records].reverse() : [];
  const allRecords = ascRecords.length > 0 ? ascRecords : [liveRecord!];
  const positions = allRecords.map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number]);
  const historyPositions = ascRecords.map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number]);
  const first = historyPositions[0];
  const last = historyPositions[historyPositions.length - 1];
  // Oldest in ASC = index 0 = newest in DESC = last in records array
  const latest = records[0];
  const center = positions[positions.length - 1];

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes colibri-pulse {
          0%   { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {/* Live / Offline badge */}
      {connected != null && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'white', borderRadius: 20, padding: '4px 10px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 500,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#22c55e' : '#9ca3af',
          }} />
          {connected ? t('map.liveConnected') : t('map.liveDisconnected')}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasHistory && !hasSelected && <FitBounds records={records} />}
        {hasLive && !hasSelected && <PanToLive record={liveRecord!} />}
        {hasSelected && <PanToSelected record={selectedRecord!} />}

        {/* Historical track */}
        {hasHistory && (
          <>
            <Polyline positions={historyPositions} color="#3b82f6" weight={3} opacity={0.8} />

            <CircleMarker center={first} radius={7} color="#22c55e" fillColor="#22c55e" fillOpacity={1}>
              <Popup>{t('map.start')}<br />{formatDate(records[0].recordedAt)}</Popup>
            </CircleMarker>

            <CircleMarker center={last} radius={9} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}>
              <Popup>
                <strong>{t('map.latestPosition')}</strong><br />
                {formatDate(latest.recordedAt)}<br />
                {latest.speed != null && <>{t('map.speed', { value: Number(latest.speed).toFixed(1) })}<br /></>}
                {latest.accuracy != null && <>{t('map.accuracy', { value: Number(latest.accuracy).toFixed(0) })}</>}
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Selected record marker — yellow pulsing dot */}
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
              {selectedRecord!.speed != null && <>{t('map.speed', { value: Number(selectedRecord!.speed).toFixed(1) })}<br /></>}
              {selectedRecord!.accuracy != null && <>{t('map.accuracy', { value: Number(selectedRecord!.accuracy).toFixed(0) })}</>}
            </Popup>
          </Marker>
        )}

        {/* Live position marker — pulsing red dot */}
        {hasLive && (
          <Marker
            position={[Number(liveRecord!.latitude), Number(liveRecord!.longitude)]}
            icon={liveIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <strong style={{ color: '#ef4444' }}>{t('map.livePosition')}</strong><br />
              {formatDate(liveRecord!.recordedAt)}<br />
              {liveRecord!.speed != null && <>{t('map.speed', { value: Number(liveRecord!.speed).toFixed(1) })}<br /></>}
              {liveRecord!.accuracy != null && <>{t('map.accuracy', { value: Number(liveRecord!.accuracy).toFixed(0) })}</>}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
