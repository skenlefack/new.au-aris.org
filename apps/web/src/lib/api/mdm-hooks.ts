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

// ── Alert Types ──

export interface MdmAlert {
  id: string;
  deviceId: string;
  tenantId: string;
  type: string; // LOW_BATTERY | STORAGE_CRITICAL | SYNC_STALE | COMMAND_FAILED | DEVICE_OFFLINE
  severity: string; // CRITICAL | WARNING | INFO
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  device?: { id: string; deviceName: string; deviceModel: string };
}

// ── Policy Types ──

export interface MdmPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  rules: {
    minAppVersion?: number;
    requireScreenLock?: boolean;
    maxOfflineDays?: number;
    minBatteryForSync?: number;
    gpsRequired?: boolean;
    maxStorageUsagePercent?: number;
  };
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// ── Compliance Types ──

export interface MdmComplianceCheck {
  id: string;
  deviceId: string;
  policyId: string;
  isCompliant: boolean;
  violations: Array<{ rule: string; expected: unknown; actual: unknown; severity: string }> | null;
  checkedAt: string;
}

// ── Location Types ──

export interface MdmLocationPoint {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
}

// ── Update Tracking Types ──

export interface MdmUpdateTrackingEntry {
  id: string;
  deviceId: string;
  releaseId: string;
  status: string;
  downloadProgress: number | null;
  downloadedAt: string | null;
  installedAt: string | null;
  failureReason: string | null;
  device?: { id: string; deviceName: string; deviceModel: string; appVersion: string };
  createdAt: string;
  updatedAt: string;
}

// ── Enrollment Settings ──

export interface MdmEnrollmentSettings {
  tenantId: string;
  enrollmentMode: 'AUTO' | 'APPROVAL_REQUIRED';
}

// ── Alerts ──

export function useMdmAlerts(params?: {
  page?: number; limit?: number; type?: string; severity?: string; isResolved?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 50));
  if (params?.type) qs.set('type', params.type);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.isResolved) qs.set('isResolved', params.isResolved);

  return useQuery<{ data: MdmAlert[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['mdm', 'alerts', params],
    queryFn: () => apiClient.get(`/credential/mdm/alerts?${qs.toString()}`),
    refetchInterval: 30_000,
  });
}

export function useResolveMdmAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId }: { alertId: string }) =>
      apiClient.patch(`/credential/mdm/alerts/${alertId}/resolve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'alerts'] }),
  });
}

// ── Policies ──

export function useMdmPolicies() {
  return useQuery<{ data: MdmPolicy[] }>({
    queryKey: ['mdm', 'policies'],
    queryFn: () => apiClient.get('/credential/mdm/policies'),
    staleTime: 60_000,
  });
}

export function useCreateMdmPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string; description?: string; rules: MdmPolicy['rules'];
      isActive?: boolean; priority?: number;
    }) => apiClient.post('/credential/mdm/policies', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'policies'] }),
  });
}

export function useUpdateMdmPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{
      name: string; description: string; rules: MdmPolicy['rules'];
      isActive: boolean; priority: number;
    }>) => apiClient.patch(`/credential/mdm/policies/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'policies'] }),
  });
}

export function useDeleteMdmPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/credential/mdm/policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'policies'] }),
  });
}

// ── Locations ──

export function useMdmDeviceLocations(deviceId?: string, params?: {
  from?: string; to?: string; limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit) qs.set('limit', String(params.limit));

  return useQuery<{ data: MdmLocationPoint[] }>({
    queryKey: ['mdm', 'devices', deviceId, 'locations', params],
    queryFn: () => apiClient.get(`/credential/mdm/devices/${deviceId}/locations?${qs.toString()}`),
    enabled: !!deviceId,
  });
}

// ── Compliance ──

export function useMdmDeviceCompliance(deviceId?: string) {
  return useQuery<{ data: MdmComplianceCheck[] }>({
    queryKey: ['mdm', 'devices', deviceId, 'compliance'],
    queryFn: () => apiClient.get(`/credential/mdm/devices/${deviceId}/compliance`),
    enabled: !!deviceId,
  });
}

// ── Rollout ──

export function useMdmReleaseRollout(releaseId?: string) {
  return useQuery<{ data: MdmUpdateTrackingEntry[] }>({
    queryKey: ['mdm', 'releases', releaseId, 'rollout'],
    queryFn: () => apiClient.get(`/credential/mdm/releases/${releaseId}/rollout`),
    enabled: !!releaseId,
    refetchInterval: 15_000,
  });
}

// ── Enrollment ──

export function useApproveMdmDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/credential/mdm/devices/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'devices'] }),
  });
}

export function useRejectMdmDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/credential/mdm/devices/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'devices'] }),
  });
}

export function useRevokeMdmDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/credential/mdm/devices/${id}/revoke`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'devices'] }),
  });
}

export function useMdmEnrollmentSettings() {
  return useQuery<{ data: MdmEnrollmentSettings }>({
    queryKey: ['mdm', 'settings'],
    queryFn: () => apiClient.get('/credential/mdm/settings'),
  });
}

export function useUpdateMdmEnrollmentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { enrollmentMode: 'AUTO' | 'APPROVAL_REQUIRED' }) =>
      apiClient.patch('/credential/mdm/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mdm', 'settings'] }),
  });
}

// ── Stats (Phase 6 placeholder) ──

export function useMdmStats() {
  return useQuery({
    queryKey: ['mdm', 'stats'],
    queryFn: () => Promise.resolve({ data: null }),
    enabled: false,
  });
}
