import { api } from '../lib/axios';

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

export interface LocationHistory {
  total: number;
  records: LocationRecord[];
}

export interface CreateDevicePayload {
  name: string;
  description?: string;
}

export type SortableColumn = 'recordedAt' | 'latitude' | 'longitude' | 'speed' | 'heading' | 'accuracy' | 'altitude';
export type SortOrder = 'ASC' | 'DESC';

export interface LocationQueryParams {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortableColumn;
  sortOrder?: SortOrder;
}

export const devicesApi = {
  list: () => api.get<Device[]>('/devices'),
  get: (id: string) => api.get<Device>(`/devices/${id}`),
  create: (payload: CreateDevicePayload) => api.post<Device>('/devices', payload),
  update: (id: string, payload: Partial<CreateDevicePayload & { isActive: boolean }>) =>
    api.patch<Device>(`/devices/${id}`, payload),
  remove: (id: string) => api.delete(`/devices/${id}`),
  getHistory: (id: string, params?: LocationQueryParams) =>
    api.get<LocationHistory>(`/devices/${id}/locations`, { params }),
  getLatest: (id: string) =>
    api.get<LocationRecord | null>(`/devices/${id}/locations/latest`),
};
