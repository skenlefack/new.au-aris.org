'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ── Types ──

export interface MdmDevice {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  deviceName: string;
  deviceModel?: string;
  manufacturer?: string;
  osVersion?: string;
  appVersion?: string;
  appVersionCode?: number;
  screenResolution?: string;
  ramMb?: number;
  storageTotalMb?: number;
  storageFreeMb?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  lastHeartbeatAt?: string;
  lastGpsLat?: number;
  lastGpsLng?: number;
  pendingSyncCount?: number;
  pendingSyncItems?: number;
  enrolledAt?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MdmDeviceDetail extends MdmDevice {
  commands?: MdmCommand[];
  heartbeats?: MdmHeartbeat[];
}

export interface MdmCommand {
  id: string;
  deviceId: string;
  type: string;
  payload?: Record<string, unknown>;
  status: 'PENDING' | 'DELIVERED' | 'EXECUTED' | 'FAILED';
  issuedBy?: string;
  issuedAt: string;
  executedAt?: string;
  result?: string;
}

export interface MdmHeartbeat {
  id: string;
  deviceId: string;
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  timestamp: string;
}

export interface MdmRelease {
  id: string;
  versionName: string;
  versionCode: number;
  fileUrl?: string;
  fileSize?: number;
  sha256?: string;
  releaseNotes?: string;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Devices ──

export function useMdmDevices(params?: {
  page?: number; limit?: number; status?: string; search?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 50));
  if (params?.status) qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);

  return useQuery<{ data: MdmDevice[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['mdm', 'devices', params],
    queryFn: () => apiClient.get(`/credential/mdm/devices?${qs.toString()}`),
    refetchInterval: 30_000,
  });
}

export function useMdmDevice(id: string | null) {
  return useQuery<{ data: MdmDeviceDetail }>({
    queryKey: ['mdm', 'devices', id],
    queryFn: () => apiClient.get(`/credential/mdm/devices/${id}`),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useSendMdmCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, type, payload }: {
      deviceId: string; type: string; payload?: Record<string, unknown>;
    }) => apiClient.post(`/credential/mdm/devices/${deviceId}/commands`, { type, payload }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mdm', 'devices', vars.deviceId] });
      qc.invalidateQueries({ queryKey: ['mdm', 'devices'] });
    },
  });
}

// ── Releases ──

export function useMdmReleases() {
  return useQuery<{ data: MdmRelease[] }>({
    queryKey: ['mdm', 'releases'],
    queryFn: () => apiClient.get('/credential/mdm/releases'),
    staleTime: 60_000,
  });
}

export function useCreateMdmRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      versionName: string; versionCode: number; fileUrl?: string;
      fileSize?: number; sha256?: string; releaseNotes?: string;
      isRequired?: boolean; isActive?: boolean;
    }) => apiClient.post('/credential/mdm/releases', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'releases'] }),
  });
}

export function useUpdateMdmRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{
      versionName: string; versionCode: number; fileUrl: string;
      fileSize: number; sha256: string; releaseNotes: string;
      isRequired: boolean; isActive: boolean;
    }>) => apiClient.patch(`/credential/mdm/releases/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'releases'] }),
  });
}

export function useDeleteMdmRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/credential/mdm/releases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'releases'] }),
  });
}
