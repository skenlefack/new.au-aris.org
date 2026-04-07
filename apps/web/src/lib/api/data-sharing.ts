// React Query hooks for the Data Sharing module.
//
// Wraps the data-sharing backend (services/data-sharing) and covers
// agreement CRUD, workflow transitions (submit/accept/reject/revoke),
// access logs, and the continental dashboard.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types (mirror @aris/shared-types data-sharing.dto) ──────────────────────

export const SHARE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

export const SHARE_ACCESS_ACTIONS = [
  'CONSULT',
  'EXPORT',
  'MODIFY',
  'DOWNLOAD',
] as const;
export type ShareAccessAction = (typeof SHARE_ACCESS_ACTIONS)[number];

export interface DataShareScope {
  entities: string[];
  fields?: Record<string, string[]>;
  filters?: Record<string, unknown>;
  geoFilter?: {
    countries?: string[];
    admin1?: string[];
    bbox?: [number, number, number, number];
  };
  timeRange?: {
    from?: string;
    to?: string;
  };
}

export interface DataShareAgreementDto {
  id: string;
  reference: string;
  title: string;
  description?: string | null;

  ownerTenantId: string;
  ownerUserId: string;
  recipientTenantId: string;
  recipientUserId?: string | null;

  dataDomain: string;
  dataScope: DataShareScope;
  dataClassification: string;

  purpose: string;
  legalBasis?: string | null;

  validFrom: string;
  validUntil?: string | null;

  canConsult: boolean;
  canExport: boolean;
  canModify: boolean;
  canRedistribute: boolean;

  maxRecordsPerQuery?: number | null;
  maxExportsPerMonth?: number | null;
  requireMfa: boolean;
  allowedIpRanges: string[];

  status: ShareStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  expiredAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateDataShareAgreementDto {
  title: string;
  description?: string;
  recipientTenantId: string;
  dataDomain: string;
  dataScope: DataShareScope;
  dataClassification?: string;
  purpose: string;
  legalBasis?: string;
  validFrom: string;
  validUntil?: string;
  canConsult?: boolean;
  canExport?: boolean;
  canModify?: boolean;
  canRedistribute?: boolean;
  maxRecordsPerQuery?: number;
  maxExportsPerMonth?: number;
  requireMfa?: boolean;
  allowedIpRanges?: string[];
}

export type UpdateDataShareAgreementDto = Partial<
  Omit<CreateDataShareAgreementDto, 'recipientTenantId' | 'dataDomain'>
>;

export interface DataShareAccessLogDto {
  id: string;
  agreementId: string;
  userId: string;
  tenantId: string;
  action: ShareAccessAction;
  recordCount?: number | null;
  queryFilters?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt: string;
}

export interface DataShareDashboardStats {
  totalAgreements: number;
  byStatus: Record<ShareStatus, number>;
  byDomain: Record<string, number>;
  activeAgreements: number;
  expiringWithin30Days: number;
  totalAccessesLast30Days: number;
  totalExportsLast30Days: number;
  topOwners: Array<{ tenantId: string; count: number }>;
  topRecipients: Array<{ tenantId: string; count: number }>;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; limit: number };
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface AgreementFilters {
  page?: number;
  limit?: number;
  status?: ShareStatus | '';
  dataDomain?: string;
  role?: 'sent' | 'received' | 'all';
}

function toQuery(f?: AgreementFilters): Record<string, string> {
  const qp: Record<string, string> = {};
  if (!f) return qp;
  if (f.page) qp.page = String(f.page);
  if (f.limit) qp.limit = String(f.limit);
  if (f.status) qp.status = f.status;
  if (f.dataDomain) qp.dataDomain = f.dataDomain;
  if (f.role) qp.role = f.role;
  return qp;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useDataShareAgreements(filters: AgreementFilters = {}) {
  return useQuery({
    queryKey: ['data-sharing', 'agreements', filters],
    queryFn: () =>
      apiClient.get<ListResponse<DataShareAgreementDto>>(
        '/data-sharing/agreements',
        toQuery(filters),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useDataShareAgreement(id: string | undefined) {
  return useQuery({
    queryKey: ['data-sharing', 'agreement', id],
    queryFn: () =>
      apiClient.get<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}`,
      ),
    enabled: !!id,
  });
}

export function useDataShareAgreementLogs(
  id: string | undefined,
  page = 1,
  limit = 20,
) {
  return useQuery({
    queryKey: ['data-sharing', 'agreement-logs', id, page, limit],
    queryFn: () =>
      apiClient.get<ListResponse<DataShareAccessLogDto>>(
        `/data-sharing/agreements/${id}/logs`,
        { page: String(page), limit: String(limit) },
      ),
    enabled: !!id,
  });
}

export function useDataShareDashboard() {
  return useQuery({
    queryKey: ['data-sharing', 'dashboard'],
    queryFn: () =>
      apiClient.get<{ data: DataShareDashboardStats }>(
        '/data-sharing/dashboard',
      ),
    staleTime: 60_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDataShareAgreementDto) =>
      apiClient.post<{ data: DataShareAgreementDto }>(
        '/data-sharing/agreements',
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'dashboard'] });
    },
  });
}

export function useUpdateDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateDataShareAgreementDto) =>
      apiClient.put<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}`,
        input,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreement', vars.id] });
    },
  });
}

export function useSubmitDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}/submit`,
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreement', id] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'dashboard'] });
    },
  });
}

export function useAcceptDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}/accept`,
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreement', id] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'dashboard'] });
    },
  });
}

export function useRejectDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      apiClient.post<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}/reject`,
        { rejectionReason },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreement', vars.id] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'dashboard'] });
    },
  });
}

export function useRevokeDataShareAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, revocationReason }: { id: string; revocationReason: string }) =>
      apiClient.post<{ data: DataShareAgreementDto }>(
        `/data-sharing/agreements/${id}/revoke`,
        { revocationReason },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreements'] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'agreement', vars.id] });
      qc.invalidateQueries({ queryKey: ['data-sharing', 'dashboard'] });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const DATA_DOMAINS = [
  'animal-health',
  'livestock-prod',
  'fisheries',
  'wildlife',
  'apiculture',
  'trade-sps',
  'governance',
  'climate-env',
  'knowledge-hub',
] as const;

export const DATA_CLASSIFICATIONS = [
  'PUBLIC',
  'PARTNER',
  'RESTRICTED',
  'CONFIDENTIAL',
] as const;

/** Tailwind classes for status badges */
export function statusBadgeClasses(status: ShareStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'ACCEPTED':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'REVOKED':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'EXPIRED':
      return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
