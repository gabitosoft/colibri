import { APIProvider, Map, Polyline, AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocationRecord } from '../../api/devices.api';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface Props {
  records: LocationRecord[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function computeBounds(records: LocationRecord[]) {
  const lats = records.map((r) => Number(r.latitude));
  const lngs = records.map((r) => Number(r.longitude));
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function StartMarker({ record }: { record: LocationRecord }) {
  const { t } = useTranslation();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: Number(record.latitude), lng: Number(record.longitude) }}
        onClick={() => setOpen(true)}
      >
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onClose={() => setOpen(false)}>
          <p style={{ margin: 0 }}>{t('map.start')}</p>
          <p style={{ margin: 0, fontSize: 12 }}>{formatDate(record.recordedAt)}</p>
        </InfoWindow>
      )}
    </>
  );
}

function LatestMarker({ record }: { record: LocationRecord }) {
  const { t } = useTranslation();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: Number(record.latitude), lng: Number(record.longitude) }}
        onClick={() => setOpen(true)}
      >
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onClose={() => setOpen(false)}>
          <strong>{t('map.latestPosition')}</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>{formatDate(record.recordedAt)}</p>
          {record.speed != null && (
            <p style={{ margin: '2px 0 0', fontSize: 12 }}>{t('map.speed', { value: Number(record.speed).toFixed(1) })}</p>
          )}
          {record.accuracy != null && (
            <p style={{ margin: '2px 0 0', fontSize: 12 }}>{t('map.accuracy', { value: Number(record.accuracy).toFixed(0) })}</p>
          )}
        </InfoWindow>
      )}
    </>
  );
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

  const path = records.map((r) => ({ lat: Number(r.latitude), lng: Number(r.longitude) }));
  const bounds = computeBounds(records);
  const latest = records[records.length - 1];

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        defaultBounds={bounds}
        mapId="colibri-tracking"
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <Polyline
          path={path}
          strokeColor="#3b82f6"
          strokeWeight={3}
          strokeOpacity={0.8}
        />
        <StartMarker record={records[0]} />
        {records.length > 1 && <LatestMarker record={latest} />}
      </Map>
    </APIProvider>
  );
}
