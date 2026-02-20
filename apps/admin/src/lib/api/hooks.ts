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
