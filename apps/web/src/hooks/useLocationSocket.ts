import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import type { LocationRecord } from '../api/devices.api';

interface UseLocationSocketResult {
  liveRecord: LocationRecord | null;
  connected: boolean;
}

const WS_URL =
  import.meta.env.MODE === 'development'
    ? 'http://localhost:3000'
    : window.location.origin;

export function useLocationSocket(deviceId: string | undefined): UseLocationSocketResult {
  const token = useAuthStore((s) => s.token);
  const [liveRecord, setLiveRecord] = useState<LocationRecord | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!deviceId || !token) return;

    const socket = io(`${WS_URL}/locations`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe:device', deviceId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('location:update', (record: LocationRecord) => {
      setLiveRecord(record);
    });

    return () => {
      socket.emit('unsubscribe:device', deviceId);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [deviceId, token]);

  return { liveRecord, connected };
}
