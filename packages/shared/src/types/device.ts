export interface Device {
  id: string;
  name: string;
  description: string | null;
  deviceKey: string;
  isActive: boolean;
  tenantId: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationRecord {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
  createdAt: string;
}

export interface PushLocationPayload {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}
