import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ── Types ──

export interface SystemMetrics {
  totalUsers: number;
  totalTenants: number;
  healthyServices: number;
  totalServices: number;
  kafkaLag: number;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  level: 'CONTINENTAL' | 'REC' | 'MEMBER_STATE';
  parentId: string | null;
  countryCode: string | null;
  recCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DataContract {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  entityType: string;
  frequency: string;
  slaDeadlineDays: number;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
  complianceRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: { userId: string; role: string; tenantId: string };
  timestamp: string;
  reason: string | null;
  previousVersion: Record<string, unknown> | null;
  newVersion: Record<string, unknown> | null;
  dataClassification: string;
}

export interface ServiceHealth {
  name: string;
  port: number;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  version: string;
}

export interface MasterDataItem {
  id: string;
  type: string;
  code: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ── System Metrics ──

export function useSystemMetrics() {
  return useQuery<SystemMetrics>({
    queryKey: ['admin', 'system-metrics'],
    queryFn: () => apiClient.get('/admin/system/metrics'),
    refetchInterval: 30_000,
    placeholderData: {
      totalUsers: 0,
      totalTenants: 0,
      healthyServices: 0,
      totalServices: 15,
      kafkaLag: 0,
    },
  });
}

// ── Tenants ──

export function useTenants(params?: QueryParams) {
  return useQuery<PaginatedResponse<Tenant>>({
    queryKey: ['admin', 'tenants', params],
    queryFn: () => apiClient.get(`/tenants${buildQuery(params)}`),
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tenant>) => apiClient.post<Tenant>('/tenants', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Tenant>) =>
      apiClient.patch<Tenant>(`/tenants/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });
}

// ── Users ──

export function useUsers(params?: QueryParams) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['admin', 'users', params],
    queryFn: () => apiClient.get(`/credential/users${buildQuery(params)}`),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<User>) =>
      apiClient.patch<User>(`/credential/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// ── Data Contracts ──

export function useDataContracts(params?: QueryParams) {
  return useQuery<PaginatedResponse<DataContract>>({
    queryKey: ['admin', 'data-contracts', params],
    queryFn: () => apiClient.get(`/data-contract/contracts${buildQuery(params)}`),
  });
}

export function useCreateDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DataContract>) =>
      apiClient.post<DataContract>('/data-contract/contracts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'data-contracts'] }),
  });
}

export function useUpdateDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<DataContract>) =>
      apiClient.patch<DataContract>(`/data-contract/contracts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'data-contracts'] }),
  });
}

// ── Audit ──

export function useAuditLog(params?: QueryParams) {
  return useQuery<PaginatedResponse<AuditEntry>>({
    queryKey: ['admin', 'audit', params],
    queryFn: () => apiClient.get(`/admin/audit${buildQuery(params)}`),
  });
}

// ── Monitoring ──

export function useServiceHealth() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['admin', 'service-health'],
    queryFn: () => apiClient.get('/admin/services/health'),
    refetchInterval: 15_000,
  });
}

// ── Master Data ──

export function useMasterDataItems(type: string, params?: QueryParams) {
  return useQuery<PaginatedResponse<MasterDataItem>>({
    queryKey: ['admin', 'master-data', type, params],
    queryFn: () => apiClient.get(`/master-data/${type}${buildQuery(params)}`),
  });
}

export function useUpdateMasterDataItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id, ...data }: { type: string; id: string } & Partial<MasterDataItem>) =>
      apiClient.patch<MasterDataItem>(`/master-data/${type}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'master-data'] }),
  });
}

// ── Dashboard KPIs ──

export interface DashboardStats {
  totalUsers: number;
  activeUsers30d: number;
  totalTenants: number;
  activeTenants: number;
  totalSubmissions: number;
  pendingValidations: number;
  qualityPassRate: number;
  totalDataContracts: number;
  activeContracts: number;
  avgComplianceRate: number;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: () => apiClient.get('/admin/dashboard/stats'),
    placeholderData: {
      totalUsers: 0,
      activeUsers30d: 0,
      totalTenants: 0,
      activeTenants: 0,
      totalSubmissions: 0,
      pendingValidations: 0,
      qualityPassRate: 0,
      totalDataContracts: 0,
      activeContracts: 0,
      avgComplianceRate: 0,
    },
  });
}

// ── System Health (enhanced) ──

export interface DetailedServiceHealth {
  name: string;
  port: number;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  version: string;
  uptime: number;
  memoryUsage: number;
}

export interface KafkaConsumerLag {
  groupId: string;
  topic: string;
  totalLag: number;
  partitions: Array<{ partition: number; currentOffset: number; endOffset: number; lag: number }>;
}

export interface PostgresPoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  maxConnections: number;
}

export interface RedisStats {
  usedMemory: string;
  usedMemoryPeak: string;
  connectedClients: number;
  totalKeys: number;
  hitRate: number;
  uptimeSeconds: number;
}

export interface InfraHealth {
  services: DetailedServiceHealth[];
  kafka: { consumerGroups: KafkaConsumerLag[] };
  postgres: PostgresPoolStats;
  redis: RedisStats;
}

export function useInfraHealth() {
  return useQuery<InfraHealth>({
    queryKey: ['admin', 'infra-health'],
    queryFn: () => apiClient.get('/admin/infra/health'),
    refetchInterval: 15_000,
  });
}

// ── Bulk Import / Export ──

export interface BulkImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  headers: string[];
  preview: Record<string, string>[];
  errors: Array<{ row: number; field: string; message: string }>;
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

export function useBulkImportPreview() {
  return useMutation<BulkImportPreview, Error, { service: string; entity: string; file: File }>({
    mutationFn: async ({ service, entity, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('service', service);
      formData.append('entity', entity);
      const { accessToken } = getTokensFromStorage();
      const res = await fetch(
        `${BASE_URL}/admin/bulk-import/preview`,
        {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: formData,
        },
      );
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
      const json = await res.json();
      return json.data ?? json;
    },
  });
}

export function useBulkImportExecute() {
  return useMutation<BulkImportResult, Error, { service: string; entity: string; file: File; tenantId: string }>({
    mutationFn: async ({ service, entity, file, tenantId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('service', service);
      formData.append('entity', entity);
      formData.append('tenantId', tenantId);
      const { accessToken } = getTokensFromStorage();
      const res = await fetch(
        `${BASE_URL}/admin/bulk-import/execute`,
        {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: formData,
        },
      );
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      const json = await res.json();
      return json.data ?? json;
    },
  });
}

export function useBulkExport() {
  return useMutation<Blob, Error, { service: string; entity: string; tenantId?: string; dateFrom?: string; dateTo?: string }>({
    mutationFn: async (params) => {
      const { accessToken } = getTokensFromStorage();
      const query = buildQuery(params as QueryParams);
      const res = await fetch(
        `${BASE_URL}/admin/bulk-export${query}`,
        {
          method: 'GET',
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
            Accept: 'text/csv',
          },
        },
      );
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      return res.blob();
    },
  });
}

// ── Feature Flags ──

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  tenantOverrides: Record<string, boolean>;
  updatedAt: string;
}

export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: () => apiClient.get('/admin/config/feature-flags'),
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<FeatureFlag>) =>
      apiClient.patch<FeatureFlag>(`/admin/config/feature-flags/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feature-flags'] }),
  });
}

// ── Rate Limits ──

export interface RateLimitOverride {
  id: string;
  tenantId: string;
  tenantName: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  updatedAt: string;
}

export function useRateLimits() {
  return useQuery<RateLimitOverride[]>({
    queryKey: ['admin', 'rate-limits'],
    queryFn: () => apiClient.get('/admin/config/rate-limits'),
  });
}

export function useUpdateRateLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<RateLimitOverride> & { id?: string }) =>
      data.id
        ? apiClient.patch<RateLimitOverride>(`/admin/config/rate-limits/${data.id}`, data)
        : apiClient.post<RateLimitOverride>('/admin/config/rate-limits', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rate-limits'] }),
  });
}

// ── Kafka Topics ──

export interface KafkaTopicInfo {
  name: string;
  partitions: number;
  replicationFactor: number;
  messageCount: number;
  consumerGroups: string[];
}

export function useKafkaTopics() {
  return useQuery<KafkaTopicInfo[]>({
    queryKey: ['admin', 'kafka-topics'],
    queryFn: () => apiClient.get('/admin/config/kafka/topics'),
  });
}

// ── Maintenance Mode ──

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  scheduledEnd: string | null;
  scheduledWindows: MaintenanceWindow[];
}

export interface MaintenanceWindow {
  id: string;
  reason: string;
  startAt: string;
  endAt: string;
  createdBy: string;
}

export function useMaintenanceStatus() {
  return useQuery<MaintenanceStatus>({
    queryKey: ['admin', 'maintenance'],
    queryFn: () => apiClient.get('/admin/maintenance'),
    refetchInterval: 30_000,
  });
}

export function useToggleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean; message?: string; scheduledEnd?: string }) =>
      apiClient.post<MaintenanceStatus>('/admin/maintenance/toggle', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] }),
  });
}

export function useScheduleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string; startAt: string; endAt: string }) =>
      apiClient.post<MaintenanceWindow>('/admin/maintenance/schedule', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] }),
  });
}

export function useDeleteMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/maintenance/schedule/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] }),
  });
}

// ── Audit Log (enhanced) ──

export interface AuditEntryDetailed extends AuditEntry {
  previousVersion: Record<string, unknown> | null;
  newVersion: Record<string, unknown> | null;
}

export function useAuditEntry(id: string) {
  return useQuery<AuditEntryDetailed>({
    queryKey: ['admin', 'audit', 'detail', id],
    queryFn: () => apiClient.get(`/admin/audit/${id}`),
    enabled: !!id,
  });
}

export interface AuditRetentionPolicy {
  retentionDays: number;
  totalEntries: number;
  oldestEntry: string | null;
  storageUsed: string;
}

export function useAuditRetention() {
  return useQuery<AuditRetentionPolicy>({
    queryKey: ['admin', 'audit', 'retention'],
    queryFn: () => apiClient.get('/admin/audit/retention'),
  });
}

// ── Helper for bulk operations (re-export BASE_URL + token access) ──

const BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/api/v1';

function getTokensFromStorage(): { accessToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null };
  try {
    const raw = localStorage.getItem('aris-admin-auth');
    if (!raw) return { accessToken: null };
    const parsed = JSON.parse(raw);
    return { accessToken: parsed.state?.accessToken ?? null };
  } catch {
    return { accessToken: null };
  }
}
