import { useEffect, useRef, useState } from 'react';

export type LatLng = [number, number]; // [lat, lng]

type MatchStatus = 'idle' | 'loading' | 'ok' | 'fallback';

interface UseMapMatchingResult {
  path: LatLng[];
  status: MatchStatus;
}

/**
 * Snaps a GPS polyline to the road network using the OSRM Map Matching API.
 *
 * - Chunks the input into groups of MAX_WAYPOINTS with a 1-point overlap so
 *   the joined segments are continuous.
 * - Falls back to the original straight-line path if any request fails or
 *   OSRM returns a non-Ok code.
 * - Aborts in-flight requests when the input changes.
 *
 * Docs: https://project-osrm.org/docs/v5.24.0/api/#match-service
 */

const OSRM_BASE = 'https://router.project-osrm.org/match/v1/driving';
const MAX_WAYPOINTS = 99; // public OSRM server hard limit
const MATCH_RADIUS_M = 30; // metres — how far a GPS point may be from the road

function chunk<T>(arr: T[], size: number, overlap = 0): T[][] {
  const chunks: T[][] = [];
  let i = 0;
  while (i < arr.length) {
    chunks.push(arr.slice(i, i + size));
    i += size - overlap;
    if (i + overlap >= arr.length) break;
  }
  // Ensure the last segment always includes the final point
  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    const tail = arr.slice(i);
    if (tail.length > 0) chunks.push([...last.slice(-1), ...tail]);
  }
  return chunks.length ? chunks : [arr];
}

async function matchChunk(
  points: LatLng[],
  signal: AbortSignal,
): Promise<LatLng[]> {
  // OSRM expects lon,lat order
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const radiuses = points.map(() => MATCH_RADIUS_M).join(';');

  const url =
    `${OSRM_BASE}/${coords}` +
    `?overview=full&geometries=geojson&radiuses=${radiuses}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = await res.json();
  if (data.code !== 'Ok' || !data.matchings?.length) {
    throw new Error(`OSRM code: ${data.code}`);
  }

  // Flatten all matching segments back to [lat, lng]
  return (data.matchings as { geometry: { coordinates: [number, number][] } }[])
    .flatMap((m) => m.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng));
}

export function useMapMatching(points: LatLng[]): UseMapMatchingResult {
  const [path, setPath] = useState<LatLng[]>(points);
  const [status, setStatus] = useState<MatchStatus>('idle');
  // Key the effect on a stable serialisation to avoid re-running on every render
  const keyRef = useRef('');

  useEffect(() => {
    if (points.length < 2) {
      setPath(points);
      setStatus('idle');
      return;
    }

    // Cheap identity check — avoid refetching when parent re-renders but data is the same
    const key = `${points[0]}-${points[points.length - 1]}-${points.length}`;
    if (key === keyRef.current) return;
    keyRef.current = key;

    const controller = new AbortController();
    setStatus('loading');

    ;(async () => {
      try {
        const chunks = chunk(points, MAX_WAYPOINTS, 1);
        const results = await Promise.all(
          chunks.map((c) => matchChunk(c, controller.signal)),
        );

        if (controller.signal.aborted) return;

        // Deduplicate the overlap points between consecutive chunks
        const merged: LatLng[] = [];
        for (let i = 0; i < results.length; i++) {
          const seg = i === 0 ? results[i] : results[i].slice(1);
          merged.push(...seg);
        }

        setPath(merged);
        setStatus('ok');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('[useMapMatching] falling back to straight lines:', err);
        setPath(points);
        setStatus('fallback');
      }
    })();

    return () => controller.abort();
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  return { path, status };
}
