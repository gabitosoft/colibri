import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import type { LocationRecord } from '../../api/devices.api';

interface Props {
  records: LocationRecord[];
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function TrackingMap({ records }: Props) {
  const { t } = useTranslation();

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl text-sm text-gray-400">
        {t('map.noData')}
      </div>
    );
  }

  const positions = records.map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number]);
  const first = positions[0];
  const last = positions[positions.length - 1];
  const latest = records[records.length - 1];

  return (
    <MapContainer
      center={last}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds records={records} />

      <Polyline positions={positions} color="#3b82f6" weight={3} opacity={0.8} />

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
    </MapContainer>
  );
}
