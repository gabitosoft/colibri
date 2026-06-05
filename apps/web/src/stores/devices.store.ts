import { create } from 'zustand';
import { devicesApi } from '../api/devices.api';
import type { Device, LocationHistory, LocationQueryParams } from '../api/devices.api';

interface DevicesState {
  devices: Device[];
  loading: boolean;
  fetchDevices: () => Promise<void>;
  addDevice: (name: string, description?: string) => Promise<Device>;
  removeDevice: (id: string) => Promise<void>;
  locationHistories: Record<string, LocationHistory>;
  fetchHistory: (deviceId: string, params?: LocationQueryParams) => Promise<void>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  loading: false,
  locationHistories: {},

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const { data } = await devicesApi.list();
      set({ devices: data });
    } finally {
      set({ loading: false });
    }
  },

  addDevice: async (name, description) => {
    const { data } = await devicesApi.create({ name, description });
    set((s) => ({ devices: [data, ...s.devices] }));
    return data;
  },

  removeDevice: async (id) => {
    await devicesApi.remove(id);
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
    const { locationHistories } = get();
    const updated = { ...locationHistories };
    delete updated[id];
    set({ locationHistories: updated });
  },

  fetchHistory: async (deviceId, params) => {
    const { data } = await devicesApi.getHistory(deviceId, params);
    set((s) => ({
      locationHistories: { ...s.locationHistories, [deviceId]: data },
    }));
  },
}));
